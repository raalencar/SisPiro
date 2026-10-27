import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreateAdminDto,
  LoginDto,
  MfaVerifyLoginDto,
  RefreshTokenDto,
} from '../auth.dto.js';
import { LoginRateLimiterService } from '../login-rate-limiter.service.js';
import { PasswordHasher } from '../password-hasher.js';
import { TotpService } from '../totp.service.js';
import {
  ADMIN_CHANGE_LOCK_ID,
  UserSummary,
  constantTimeEquals,
  hashRefreshSecret,
  parseRefreshToken,
  userSummary,
} from '../auth.common.js';

@Injectable()
export class AuthSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly passwordHasher: PasswordHasher,
    private readonly rateLimiter: LoginRateLimiterService,
    private readonly totp: TotpService,
  ) {}

  async bootstrap(dto: CreateAdminDto, ip?: string) {
    const clientIp = ip?.trim() || '';
    const rateLimitKeys = [
      clientIp ? `ip:${clientIp}` : '',
      'auth:bootstrap',
    ].filter(Boolean);

    await this.rateLimiter.assertNotRateLimited(rateLimitKeys);

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
      await this.rateLimiter.recordSuccess(rateLimitKeys);
      return result;
    } catch (error) {
      if (error instanceof ConflictException) {
        await this.rateLimiter.recordSuccess(rateLimitKeys);
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

    await this.rateLimiter.assertNotRateLimited(rateLimitKeys);

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
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const passwordValid = await this.passwordHasher.verify(
      dto.password,
      user.passwordHash,
    );

    if (!passwordValid || !user.active) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

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

    await this.rateLimiter.recordSuccess(rateLimitKeys);
    const summary = userSummary(user);
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
    const parsed = parseRefreshToken(dto.refreshToken);
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
      const providedHash = hashRefreshSecret(parsed.secret);
      if (!constantTimeEquals(session.refreshTokenHash, providedHash)) {
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
          refreshTokenHash: hashRefreshSecret(refreshSecret),
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
        user: userSummary(session.user),
      };
    });
    if (!result) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }
    return result;
  }

  async logout(dto: RefreshTokenDto) {
    const parsed = parseRefreshToken(dto.refreshToken);
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
        !constantTimeEquals(
          session.refreshTokenHash,
          hashRefreshSecret(parsed.secret),
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
    return { message: 'Sessão encerrada com sucesso.' };
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

    await this.rateLimiter.assertNotRateLimited(rateLimitKeys);

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
      throw new UnauthorizedException(
        'Código de autenticação em dois fatores inválido.',
      );
    }

    await this.rateLimiter.recordSuccess(rateLimitKeys);

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

    const summary = userSummary(user);
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

  async createSession(tx: Prisma.TransactionClient, user: UserSummary) {
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
        refreshTokenHash: hashRefreshSecret(refreshSecret),
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

  async signAccessToken(userId: string, sessionId: string) {
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
}
