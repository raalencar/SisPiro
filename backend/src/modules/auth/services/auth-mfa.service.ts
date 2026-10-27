import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { MfaDisableDto, MfaEnableDto } from '../auth.dto.js';
import { AuthenticatedUser } from '../auth.constants.js';
import { PasswordHasher } from '../password-hasher.js';
import { TotpService } from '../totp.service.js';

@Injectable()
export class AuthMfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
    private readonly totp: TotpService,
  ) {}

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
}
