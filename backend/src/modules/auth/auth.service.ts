import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, UserRole } from '@prisma/client';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { createAuditLog } from '../../common/audit-log.js';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ChangePasswordDto,
  ConfirmPasswordResetDto,
  CreateAdminDto,
  CreateUserDto,
  LoginDto,
  MfaDisableDto,
  MfaEnableDto,
  MfaVerifyLoginDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  UpdateUserDto,
  UsersQueryDto,
} from './auth.dto.js';
import { AuthenticatedUser } from './auth.constants.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { PasswordHasher } from './password-hasher.js';
import { TotpService } from './totp.service.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_CHANGE_LOCK_ID = 8217340621;

type UserSummary = {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly passwordHasher: PasswordHasher,
    private readonly rateLimiter: LoginRateLimiterService,
    private readonly totp: TotpService,
    @Optional()
    @InjectQueue('background')
    private readonly backgroundQueue?: Queue,
  ) {}

  async bootstrap(dto: CreateAdminDto, ip?: string) {
    const clientIp = ip?.trim() || '';
    const rateLimitKeys = [
      clientIp ? `ip:${clientIp}` : '',
      'auth:bootstrap',
    ].filter(Boolean);

    this.rateLimiter.assertNotRateLimited(rateLimitKeys);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(${ADMIN_CHANGE_LOCK_ID})::text AS "lock"
        `;
        if ((await tx.user.count()) > 0) {
          throw new ConflictException('O administrador inicial já foi criado.');
        }
        const passwordHash = await this.passwordHasher.hash(dto.password);
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            roles: [UserRole.ADMIN],
          },
          select: { id: true, name: true, email: true, roles: true },
        });
        const tokens = await this.createSession(tx, user);
        await createAuditLog(tx, {
          data: {
            actorId: user.id,
            action: 'auth.bootstrap.completed',
            aggregateType: 'User',
            aggregateId: user.id,
            after: { email: user.email, roles: user.roles },
          },
        });
        const { sessionId: _sessionId, ...publicTokens } = tokens;
        return { ...publicTokens, user };
      });
      this.rateLimiter.recordSuccess(rateLimitKeys);
      return result;
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        this.rateLimiter.recordFailure(rateLimitKeys);
      }
      throw error;
    }
  }

  async login(dto: LoginDto, ip?: string) {
    const clientIp = ip?.trim() || '';
    const normalizedEmail = dto.email.trim().toLowerCase();
    const rateLimitKeys = [
      clientIp ? `ip:${clientIp}` : '',
      `email:${normalizedEmail}`,
    ].filter(Boolean);

    this.rateLimiter.assertNotRateLimited(rateLimitKeys);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        roles: true,
        active: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user) {
      await this.passwordHasher.hash(dto.password);
      this.rateLimiter.recordFailure(rateLimitKeys);
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const passwordValid = await this.passwordHasher.verify(
      dto.password,
      user.passwordHash,
    );

    if (!passwordValid || !user.active) {
      this.rateLimiter.recordFailure(rateLimitKeys);
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    // Validação de MFA se ativo
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        const mfaToken = await this.jwt.signAsync(
          { sub: user.id, purpose: 'mfa_challenge' },
          { expiresIn: '5m' },
        );
        return {
          mfaRequired: true,
          mfaToken,
          message: 'Autenticação de dois fatores necessária.',
        };
      }

      let validMfa = false;
      let usedBackupIndex = -1;

      if (
        user.mfaSecret &&
        this.totp.verifyCode(
          dto.mfaCode,
          this.totp.decryptSecret(user.mfaSecret),
        )
      ) {
        validMfa = true;
      } else if (user.mfaBackupCodes.length > 0) {
        usedBackupIndex = this.totp.verifyAndConsumeBackupCode(
          dto.mfaCode,
          user.mfaBackupCodes,
        );
        if (usedBackupIndex !== -1) {
          validMfa = true;
        }
      }

      if (!validMfa) {
        this.rateLimiter.recordFailure(rateLimitKeys);
        throw new UnauthorizedException(
          'Código de autenticação em dois fatores inválido.',
        );
      }

      if (usedBackupIndex !== -1) {
        const remainingBackupCodes = [...user.mfaBackupCodes];
        remainingBackupCodes.splice(usedBackupIndex, 1);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mfaBackupCodes: remainingBackupCodes },
        });
        await createAuditLog(this.prisma, {
          data: {
            actorId: user.id,
            action: 'auth.mfa.backup_code_used',
            aggregateType: 'User',
            aggregateId: user.id,
          },
        });
      }
    }

    this.rateLimiter.recordSuccess(rateLimitKeys);
    const summary = this.userSummary(user);
    return this.prisma.$transaction(async (tx) => {
      const tokens = await this.createSession(tx, summary);
      await createAuditLog(tx, {
        data: {
          actorId: user.id,
          action: 'auth.session.created',
          aggregateType: 'AuthSession',
          aggregateId: tokens.sessionId,
          after: { userId: user.id },
        },
      });
      const { sessionId: _sessionId, ...publicTokens } = tokens;
      return { ...publicTokens, user: summary };
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const parsed = this.parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Refresh token inválido.');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sessoes_autenticacao"
        WHERE "id" = ${parsed.sessionId}::uuid
        FOR UPDATE
      `;
      if (!locked.length) {
        return null;
      }
      const session = await tx.authSession.findUnique({
        where: { id: parsed.sessionId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              roles: true,
              active: true,
            },
          },
        },
      });
      if (!session || session.revokedAt) {
        return null;
      }
      const providedHash = this.hashRefreshSecret(parsed.secret);
      if (!this.constantTimeEquals(session.refreshTokenHash, providedHash)) {
        const previouslyUsed = await tx.usedRefreshToken.findUnique({
          where: {
            sessionId_tokenHash: {
              sessionId: session.id,
              tokenHash: providedHash,
            },
          },
        });
        if (previouslyUsed) {
          await tx.authSession.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          });
          await createAuditLog(tx, {
            data: {
              actorId: session.userId,
              action: 'auth.refresh.reuse_detected',
              aggregateType: 'AuthSession',
              aggregateId: session.id,
            },
          });
        }
        return null;
      }
      if (session.expiresAt <= new Date() || !session.user.active) {
        await tx.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
        return null;
      }
      const refreshSecret = randomBytes(48).toString('base64url');
      const refreshToken = `${session.id}.${refreshSecret}`;
      const expiresAt = session.expiresAt;
      await tx.usedRefreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: session.refreshTokenHash,
        },
      });
      await tx.authSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: this.hashRefreshSecret(refreshSecret),
          lastUsedAt: new Date(),
        },
      });
      const accessToken = await this.signAccessToken(
        session.user.id,
        session.id,
      );
      await createAuditLog(tx, {
        data: {
          actorId: session.userId,
          action: 'auth.session.refreshed',
          aggregateType: 'AuthSession',
          aggregateId: session.id,
        },
      });
      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.accessTokenTtlSeconds(),
        refreshExpiresAt: expiresAt.toISOString(),
        user: this.userSummary(session.user),
      };
    });
    if (!result) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }
    return result;
  }

  async logout(dto: RefreshTokenDto) {
    const parsed = this.parseRefreshToken(dto.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Refresh token inválido.');
    }
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "sessoes_autenticacao"
        WHERE "id" = ${parsed.sessionId}::uuid
        FOR UPDATE
      `;
      if (!locked.length) {
        return;
      }
      const session = await tx.authSession.findUnique({
        where: { id: parsed.sessionId },
      });
      if (
        !session ||
        session.revokedAt ||
        !this.constantTimeEquals(
          session.refreshTokenHash,
          this.hashRefreshSecret(parsed.secret),
        )
      ) {
        return;
      }
      await tx.authSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      await createAuditLog(tx, {
        data: {
          actorId: session.userId,
          action: 'auth.session.revoked',
          aggregateType: 'AuthSession',
          aggregateId: session.id,
        },
      });
    });
    return { message: 'Sessão encerrada.' };
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "usuarios" WHERE "id" = ${user.id}::uuid FOR UPDATE
      `;
      const current = await tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, passwordHash: true },
      });
      if (
        !current ||
        !(await this.passwordHasher.verify(
          dto.currentPassword,
          current.passwordHash,
        ))
      ) {
        throw new UnauthorizedException('Senha atual inválida.');
      }
      if (
        await this.passwordHasher.verify(dto.newPassword, current.passwordHash)
      ) {
        throw new BadRequestException(
          'A nova senha deve ser diferente da senha atual.',
        );
      }
      const passwordHash = await this.passwordHasher.hash(dto.newPassword);
      await tx.user.update({
        where: { id: current.id },
        data: { passwordHash },
      });
      await tx.authSession.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await createAuditLog(tx, {
        data: {
          actorId: current.id,
          action: 'auth.password.changed',
          aggregateType: 'User',
          aggregateId: current.id,
        },
      });
    });
    return { message: 'Senha alterada. Entre novamente para continuar.' };
  }

  async listUsers(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          active: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { email: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async createUser(actor: AuthenticatedUser, dto: CreateUserDto) {
    try {
      const passwordHash = await this.passwordHasher.hash(dto.password);
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            passwordHash,
            roles: dto.roles,
          },
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
            active: true,
            createdAt: true,
          },
        });
        await createAuditLog(tx, {
          data: {
            actorId: actor.id,
            action: 'auth.user.created',
            aggregateType: 'User',
            aggregateId: user.id,
            after: { email: user.email, roles: user.roles },
          },
        });
        return user;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async updateUser(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(${ADMIN_CHANGE_LOCK_ID})::text AS "lock"
      `;
      const current = await tx.user.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException('Usuário não encontrado.');
      }
      if (
        dto.name === undefined &&
        dto.roles === undefined &&
        dto.active === undefined
      ) {
        throw new BadRequestException(
          'Informe ao menos um campo para atualizar.',
        );
      }
      const roles = dto.roles ?? current.roles;
      const active = dto.active ?? current.active;
      if (
        current.active &&
        current.roles.includes(UserRole.ADMIN) &&
        (!active || !roles.includes(UserRole.ADMIN))
      ) {
        const activeAdmins = await tx.user.count({
          where: { active: true, roles: { has: UserRole.ADMIN } },
        });
        if (activeAdmins <= 1) {
          throw new ConflictException(
            'Não é possível desativar ou rebaixar o último administrador ativo.',
          );
        }
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.roles === undefined ? {} : { roles: dto.roles }),
          ...(dto.active === undefined ? {} : { active: dto.active }),
        },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          active: true,
          createdAt: true,
        },
      });
      if (!updated.active) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await createAuditLog(tx, {
        data: {
          actorId: actor.id,
          action: 'auth.user.updated',
          aggregateType: 'User',
          aggregateId: id,
          before: {
            name: current.name,
            roles: current.roles,
            active: current.active,
          },
          after: {
            name: updated.name,
            roles: updated.roles,
            active: updated.active,
          },
        },
      });
      return updated;
    });
  }

  async verifyMfaLogin(dto: MfaVerifyLoginDto, ip?: string) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(dto.mfaToken);
    } catch {
      throw new UnauthorizedException('Desafio MFA inválido ou expirado.');
    }

    if (payload.purpose !== 'mfa_challenge' || !payload.sub) {
      throw new UnauthorizedException('Desafio MFA inválido.');
    }

    const clientIp = ip?.trim() || '';
    const rateLimitKeys = [
      clientIp ? `ip:${clientIp}` : '',
      `mfa:${payload.sub}`,
    ].filter(Boolean);

    this.rateLimiter.assertNotRateLimited(rateLimitKeys);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        active: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user || !user.active || !user.mfaEnabled) {
      throw new UnauthorizedException('Usuário inválido ou MFA não ativo.');
    }

    let validMfa = false;
    let usedBackupIndex = -1;

    if (
      user.mfaSecret &&
      this.totp.verifyCode(dto.code, this.totp.decryptSecret(user.mfaSecret))
    ) {
      validMfa = true;
    } else if (user.mfaBackupCodes.length > 0) {
      usedBackupIndex = this.totp.verifyAndConsumeBackupCode(
        dto.code,
        user.mfaBackupCodes,
      );
      if (usedBackupIndex !== -1) {
        validMfa = true;
      }
    }

    if (!validMfa) {
      this.rateLimiter.recordFailure(rateLimitKeys);
      throw new UnauthorizedException(
        'Código de autenticação em dois fatores inválido.',
      );
    }

    this.rateLimiter.recordSuccess(rateLimitKeys);

    if (usedBackupIndex !== -1) {
      const remainingBackupCodes = [...user.mfaBackupCodes];
      remainingBackupCodes.splice(usedBackupIndex, 1);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaBackupCodes: remainingBackupCodes },
      });
      await createAuditLog(this.prisma, {
        data: {
          actorId: user.id,
          action: 'auth.mfa.backup_code_used',
          aggregateType: 'User',
          aggregateId: user.id,
        },
      });
    }

    const summary = this.userSummary(user);
    return this.prisma.$transaction(async (tx) => {
      const tokens = await this.createSession(tx, summary);
      await createAuditLog(tx, {
        data: {
          actorId: user.id,
          action: 'auth.session.created',
          aggregateType: 'AuthSession',
          aggregateId: tokens.sessionId,
          after: { userId: user.id },
        },
      });
      const { sessionId: _sessionId, ...publicTokens } = tokens;
      return { ...publicTokens, user: summary };
    });
  }

  async setupMfa(user: AuthenticatedUser) {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (existing.mfaEnabled) {
      throw new ConflictException('MFA já está habilitado nesta conta.');
    }

    const secret = this.totp.generateSecret();
    const otpAuthUrl = this.totp.generateOtpAuthUrl(existing.email, secret);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: this.totp.encryptSecret(secret) },
    });

    return { secret, otpAuthUrl };
  }

  async enableMfa(user: AuthenticatedUser, dto: MfaEnableDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    if (existing.mfaEnabled) {
      throw new ConflictException('MFA já está habilitado nesta conta.');
    }
    if (!existing.mfaSecret) {
      throw new BadRequestException(
        'Solicitação de MFA não iniciada. Execute o setup primeiro.',
      );
    }

    const valid = this.totp.verifyCode(
      dto.code,
      this.totp.decryptSecret(existing.mfaSecret),
    );
    if (!valid) {
      throw new BadRequestException('Código TOTP inválido.');
    }

    const backupCodes = this.totp.generateBackupCodes(8);
    const backupHashes = backupCodes.map((code) =>
      this.totp.hashBackupCode(code),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaBackupCodes: backupHashes,
        },
      });
      await createAuditLog(tx, {
        data: {
          actorId: user.id,
          action: 'auth.mfa.enabled',
          aggregateType: 'User',
          aggregateId: user.id,
        },
      });
    });

    return {
      message:
        'MFA ativado com sucesso. Guarde os códigos de backup em local seguro.',
      backupCodes,
    };
  }

  async disableMfa(user: AuthenticatedUser, dto: MfaDisableDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true, mfaEnabled: true },
    });
    if (!existing) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    const passwordValid = await this.passwordHasher.verify(
      dto.currentPassword,
      existing.passwordHash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Senha incorreta.');
    }
    if (!existing.mfaEnabled) {
      throw new BadRequestException('MFA não está ativo para esta conta.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: [],
        },
      });
      await createAuditLog(tx, {
        data: {
          actorId: user.id,
          action: 'auth.mfa.disabled',
          aggregateType: 'User',
          aggregateId: user.id,
        },
      });
    });

    return { message: 'MFA desativado com sucesso.' };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto, ip?: string) {
    const clientIp = ip?.trim() || '';
    const rateLimitKeys = [
      clientIp ? `ip:${clientIp}` : '',
      `reset:${dto.email.trim().toLowerCase()}`,
    ].filter(Boolean);

    this.rateLimiter.assertNotRateLimited(rateLimitKeys);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true, email: true, active: true },
    });

    if (user && user.active) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      await this.prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        });

        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });

        await createAuditLog(tx, {
          data: {
            actorId: user.id,
            action: 'auth.password_reset.requested',
            aggregateType: 'User',
            aggregateId: user.id,
            after: { email: user.email },
          },
        });
      });

      if (this.backgroundQueue) {
        try {
          await this.backgroundQueue.add(
            'auth.password-reset',
            {
              userId: user.id,
              email: user.email,
              token: rawToken,
              expiresAt: expiresAt.toISOString(),
            },
            { removeOnComplete: true, attempts: 3 },
          );
        } catch {
          // Ignora falha de fila em ambientes isolados de teste
        }
      }
    } else {
      await this.passwordHasher.hash('timing-safe-dummy-protection');
    }

    return {
      message:
        'Se o e-mail informado estiver cadastrado, as instruções para redefinição de senha foram enviadas.',
    };
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    const tokenHash = createHash('sha256')
      .update(dto.token.trim())
      .digest('hex');

    await this.prisma.$transaction(async (tx) => {
      const lockedTokens = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "tokens_recuperacao_senha"
        WHERE "token_hash" = ${tokenHash}
          AND "usado_em" IS NULL
          AND "expira_em" > CURRENT_TIMESTAMP
        FOR UPDATE
      `;

      if (!lockedTokens.length) {
        throw new BadRequestException(
          'Token de recuperação de senha inválido ou expirado.',
        );
      }

      const tokenRecord = await tx.passwordResetToken.findUnique({
        where: { id: lockedTokens[0].id },
        include: {
          user: {
            select: { id: true, passwordHash: true, active: true },
          },
        },
      });

      if (!tokenRecord || !tokenRecord.user || !tokenRecord.user.active) {
        throw new BadRequestException(
          'Token de recuperação de senha inválido ou expirado.',
        );
      }

      await tx.$queryRaw`
        SELECT "id" FROM "usuarios"
        WHERE "id" = ${tokenRecord.user.id}::uuid
        FOR UPDATE
      `;

      if (
        await this.passwordHasher.verify(
          dto.newPassword,
          tokenRecord.user.passwordHash,
        )
      ) {
        throw new BadRequestException(
          'A nova senha deve ser diferente da senha anterior.',
        );
      }

      const newPasswordHash = await this.passwordHasher.hash(dto.newPassword);

      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: tokenRecord.user.id },
        data: { passwordHash: newPasswordHash },
      });

      await tx.authSession.updateMany({
        where: {
          userId: tokenRecord.user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await createAuditLog(tx, {
        data: {
          actorId: tokenRecord.user.id,
          action: 'auth.password_reset.completed',
          aggregateType: 'User',
          aggregateId: tokenRecord.user.id,
        },
      });
    });

    return {
      message: 'Senha redefinida com sucesso. Faça login com a nova senha.',
    };
  }

  private async createSession(tx: Prisma.TransactionClient, user: UserSummary) {
    await tx.authSession.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });
    const sessionId = randomUUID();
    const refreshSecret = randomBytes(48).toString('base64url');
    const refreshToken = `${sessionId}.${refreshSecret}`;
    const expiresAt = this.refreshExpiresAt();
    await tx.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashRefreshSecret(refreshSecret),
        expiresAt,
      },
    });
    return {
      sessionId,
      accessToken: await this.signAccessToken(user.id, sessionId),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenTtlSeconds(),
      refreshExpiresAt: expiresAt.toISOString(),
    };
  }

  private async signAccessToken(userId: string, sessionId: string) {
    return this.jwt.signAsync(
      { sid: sessionId },
      {
        subject: userId,
        expiresIn: this.accessTokenTtlSeconds(),
      },
    );
  }

  private accessTokenTtlSeconds() {
    return this.config.getOrThrow<number>('AUTH_ACCESS_TOKEN_TTL_SECONDS');
  }

  private refreshExpiresAt() {
    const days = this.config.getOrThrow<number>('AUTH_REFRESH_TOKEN_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private hashRefreshSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private constantTimeEquals(left: string, right: string) {
    const leftBytes = Buffer.from(left, 'hex');
    const rightBytes = Buffer.from(right, 'hex');
    return (
      leftBytes.length === rightBytes.length &&
      timingSafeEqual(leftBytes, rightBytes)
    );
  }

  private parseRefreshToken(value: string) {
    const separator = value.indexOf('.');
    if (separator < 0) {
      return null;
    }
    const sessionId = value.slice(0, separator);
    const secret = value.slice(separator + 1);
    if (!UUID_PATTERN.test(sessionId) || !/^[A-Za-z0-9_-]{64}$/.test(secret)) {
      return null;
    }
    return { sessionId, secret };
  }

  private userSummary(user: UserSummary): UserSummary {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    };
  }
}
