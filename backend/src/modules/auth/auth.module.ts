import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../database/prisma.module.js';
import { AccessGuard } from './access.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [
    PrismaModule,
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
    AuthService,
    PasswordHasher,
    AccessGuard,
    { provide: APP_GUARD, useExisting: AccessGuard },
  ],
})
export class AuthModule {}
