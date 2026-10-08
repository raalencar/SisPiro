import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  ChangePasswordDto,
  CreateAdminDto,
  CreateUserDto,
  LoginDto,
  RefreshTokenDto,
  UpdateUserDto,
  UsersQueryDto,
} from './auth.dto.js';
import { AuthenticatedUser } from './auth.constants.js';
import { PasswordHasher } from './password-hasher.js';

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
  ) {}

  async bootstrap(dto: CreateAdminDto) {
    return this.prisma.$transaction(async (tx) => {
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
      await tx.auditLog.create({
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
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        roles: true,
        active: true,
      },
    });
    if (!user) {
      await this.passwordHasher.hash(dto.password);
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const passwordValid = await this.passwordHasher.verify(
      dto.password,
      user.passwordHash,
    );
    if (!passwordValid || !user.active) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    const summary = this.userSummary(user);
    return this.prisma.$transaction(async (tx) => {
      const tokens = await this.createSession(tx, summary);
      await tx.auditLog.create({
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
          await tx.auditLog.create({
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
      await tx.auditLog.create({
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
      await tx.auditLog.create({
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
      await tx.auditLog.create({
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
        await tx.auditLog.create({
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
      await tx.auditLog.create({
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
