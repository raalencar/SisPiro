import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { userSummary } from '../auth.common.js';
import { LoginRateLimiterService } from '../login-rate-limiter.service.js';
import { TotpService } from '../totp.service.js';

export interface MfaCandidateUser {
  id: string;
  name: string;
  email: string;
  roles: any[];
  active: boolean;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaBackupCodes: string[];
}

@Injectable()
export class AuthMfaVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rateLimiter: LoginRateLimiterService,
    private readonly totp: TotpService,
  ) {}

  async verifyTotpOrBackup(user: MfaCandidateUser, code: string): Promise<void> {
    let validMfa = false;
    let usedBackupIndex = -1;

    if (
      user.mfaSecret &&
      this.totp.verifyCode(code, this.totp.decryptSecret(user.mfaSecret))
    ) {
      validMfa = true;
    } else if (user.mfaBackupCodes.length > 0) {
      usedBackupIndex = this.totp.verifyAndConsumeBackupCode(
        code,
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

  async resolveMfaChallenge(
    mfaToken: string,
    code: string,
    ip?: string,
  ) {
    let payload: { sub: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(mfaToken);
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

    await this.verifyTotpOrBackup(user, code);
    await this.rateLimiter.recordSuccess(rateLimitKeys);

    return userSummary(user);
  }
}
