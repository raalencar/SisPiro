import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthenticatedUser } from './auth.constants.js';
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
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { PasswordHasher } from './password-hasher.js';
import { TotpService } from './totp.service.js';
import {
  AuthSessionsService,
  UsersManagementService,
  AuthMfaService,
  PasswordResetService,
} from './services/index.js';

@Injectable()
export class AuthService {
  private readonly sessionsService: AuthSessionsService;
  private readonly usersService: UsersManagementService;
  private readonly mfaService: AuthMfaService;
  private readonly passwordResetService: PasswordResetService;

  constructor(
    @Inject(AuthSessionsService)
    sessionsOrPrisma: AuthSessionsService | PrismaService,
    @Optional()
    @Inject(UsersManagementService)
    usersOrConfig?: UsersManagementService | ConfigService,
    @Optional()
    @Inject(AuthMfaService)
    mfaOrJwt?: AuthMfaService | JwtService,
    @Optional()
    @Inject(PasswordResetService)
    passwordResetOrHasher?: PasswordResetService | PasswordHasher,
    @Optional() rateLimiter?: LoginRateLimiterService,
    @Optional() totp?: TotpService,
    @Optional() @InjectQueue('background') queue?: Queue,
  ) {
    if (sessionsOrPrisma instanceof AuthSessionsService) {
      this.sessionsService = sessionsOrPrisma;
      this.usersService = usersOrConfig as UsersManagementService;
      this.mfaService = mfaOrJwt as AuthMfaService;
      this.passwordResetService = passwordResetOrHasher as PasswordResetService;
    } else {
      const prisma = sessionsOrPrisma as PrismaService;
      const config = usersOrConfig as ConfigService;
      const jwt = mfaOrJwt as JwtService;
      const passwordHasher = passwordResetOrHasher as PasswordHasher;

      this.sessionsService = new AuthSessionsService(
        prisma,
        config,
        jwt,
        passwordHasher,
        rateLimiter!,
        totp!,
      );
      this.usersService = new UsersManagementService(prisma, passwordHasher);
      this.mfaService = new AuthMfaService(prisma, passwordHasher, totp!);
      this.passwordResetService = new PasswordResetService(
        prisma,
        passwordHasher,
        rateLimiter!,
        queue,
      );
    }
  }

  // --- Sessões e Autenticação ---
  async bootstrap(dto: CreateAdminDto, ip?: string) {
    return this.sessionsService.bootstrap(dto, ip);
  }

  async login(dto: LoginDto, ip?: string) {
    return this.sessionsService.login(dto, ip);
  }

  async refresh(dto: RefreshTokenDto) {
    return this.sessionsService.refresh(dto);
  }

  async logout(dto: RefreshTokenDto) {
    return this.sessionsService.logout(dto);
  }

  async verifyMfaLogin(dto: MfaVerifyLoginDto, ip?: string) {
    return this.sessionsService.verifyMfaLogin(dto, ip);
  }

  // --- Gestão de Usuários ---
  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    return this.usersService.changePassword(user, dto);
  }

  async listUsers(query: UsersQueryDto) {
    return this.usersService.listUsers(query);
  }

  async getUser(id: string) {
    return this.usersService.getUser(id);
  }

  async createUser(actor: AuthenticatedUser, dto: CreateUserDto) {
    return this.usersService.createUser(actor, dto);
  }

  async updateUser(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    return this.usersService.updateUser(actor, id, dto);
  }

  // --- MFA (TOTP) ---
  async setupMfa(user: AuthenticatedUser) {
    return this.mfaService.setupMfa(user);
  }

  async enableMfa(user: AuthenticatedUser, dto: MfaEnableDto) {
    return this.mfaService.enableMfa(user, dto);
  }

  async disableMfa(user: AuthenticatedUser, dto: MfaDisableDto) {
    return this.mfaService.disableMfa(user, dto);
  }

  // --- Recuperação de Senha ---
  async requestPasswordReset(dto: RequestPasswordResetDto, ip?: string) {
    return this.passwordResetService.requestPasswordReset(dto, ip);
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    return this.passwordResetService.confirmPasswordReset(dto);
  }
}
