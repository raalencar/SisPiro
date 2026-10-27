import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../database/prisma.module.js';
import { QueueModule } from '../../infrastructure/queue.module.js';
import { redisClientProvider, REDIS_CLIENT } from '../../infrastructure/redis.provider.js';
import { AccessGuard } from './access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { PasswordHasher } from './password-hasher.js';
import { TotpService } from './totp.service.js';
import { UsersController } from './users.controller.js';
import {
  AuthSessionsService,
  AuthTokenService,
  UsersManagementService,
  AuthMfaService,
  AuthMfaVerificationService,
  PasswordResetService,
} from './services/index.js';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('AUTH_JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    redisClientProvider,
    AuthService,
    AuthSessionsService,
    AuthTokenService,
    UsersManagementService,
    AuthMfaService,
    AuthMfaVerificationService,
    PasswordResetService,
    PasswordHasher,
    LoginRateLimiterService,
    TotpService,
    AccessGuard,
    { provide: APP_GUARD, useExisting: AccessGuard },
  ],
  exports: [
    AuthService,
    AuthSessionsService,
    AuthTokenService,
    UsersManagementService,
    AuthMfaService,
    AuthMfaVerificationService,
    PasswordResetService,
    LoginRateLimiterService,
    TotpService,
    REDIS_CLIENT,
  ],
})
export class AuthModule {}
