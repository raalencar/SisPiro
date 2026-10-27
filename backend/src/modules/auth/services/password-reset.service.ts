import {
  BadRequestException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash, randomBytes } from 'node:crypto';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from '../auth.dto.js';
import { LoginRateLimiterService } from '../login-rate-limiter.service.js';
import { PasswordHasher } from '../password-hasher.js';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
    private readonly rateLimiter: LoginRateLimiterService,
    @Optional()
    @InjectQueue('background')
    private readonly backgroundQueue?: Queue,
  ) {}

  async requestPasswordReset(dto: RequestPasswordResetDto, ip?: string) {
    const clientIp = ip?.trim() || '';
    const rateLimitKeys = [
      clientIp ? `ip:${clientIp}` : '',
      `reset:${dto.email.trim().toLowerCase()}`,
    ].filter(Boolean);

    await this.rateLimiter.assertNotRateLimited(rateLimitKeys);

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
}
