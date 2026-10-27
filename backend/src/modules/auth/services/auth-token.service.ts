import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { UserSummary, hashRefreshSecret } from '../auth.common.js';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

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

  accessTokenTtlSeconds() {
    return this.config.getOrThrow<number>('AUTH_ACCESS_TOKEN_TTL_SECONDS');
  }

  refreshExpiresAt() {
    const days = this.config.getOrThrow<number>('AUTH_REFRESH_TOKEN_TTL_DAYS');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
