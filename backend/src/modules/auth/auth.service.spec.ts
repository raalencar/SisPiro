import { BadRequestException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { LoginRateLimiterService } from './login-rate-limiter.service.js';
import { PasswordHasher } from './password-hasher.js';
import { TotpService } from './totp.service.js';

describe('AuthService (Unit & Domain Logic)', () => {
  let authService: AuthService;
  let rateLimiter: LoginRateLimiterService;
  let totp: TotpService;
  let passwordHasher: PasswordHasher;
  let jwt: JwtService;
  let config: ConfigService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prismaMock: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let queueMock: any;

  beforeEach(() => {
    rateLimiter = new LoginRateLimiterService();
    passwordHasher = new PasswordHasher();
    jwt = new JwtService({ secret: 'test-jwt-secret-for-e2e-testing-only-12345' });
    config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'AUTH_ACCESS_TOKEN_TTL_SECONDS') return 900;
        if (key === 'AUTH_REFRESH_TOKEN_TTL_DAYS') return 30;
        return 'test-secret';
      }),
    } as unknown as ConfigService;
    totp = new TotpService(config);

    queueMock = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    prismaMock = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      authSession: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      passwordResetToken: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'token-id-1', lock: '1' }]),
    };

    authService = new AuthService(
      prismaMock,
      config,
      jwt,
      passwordHasher,
      rateLimiter,
      totp,
      queueMock,
    );
  });

  describe('1.1 Rate limiting on login', () => {
    it('blocks after exceeding maximum failed login attempts', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const loginDto = { email: 'victim@test.local', password: 'WrongPassword123' };

      // 5 tentativas falhas
      for (let i = 0; i < 5; i++) {
        await expect(authService.login(loginDto, '192.168.1.100')).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // 6ª tentativa deve ser bloqueada com 429
      await expect(authService.login(loginDto, '192.168.1.100')).rejects.toThrow(
        HttpException,
      );

      try {
        await authService.login(loginDto, '192.168.1.100');
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('resets rate limit on successful authentication', async () => {
      const password = 'CorrectPassword123';
      const passwordHash = await passwordHasher.hash(password);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Usuário Teste',
        email: 'user@test.local',
        passwordHash,
        roles: [UserRole.ESTOQUE],
        active: true,
        mfaEnabled: false,
      });

      // 2 tentativas falhas
      await rateLimiter.assertNotRateLimited(['email:user@test.local']);
      await rateLimiter.assertNotRateLimited(['email:user@test.local']);

      // Login com sucesso
      const result = await authService.login({ email: 'user@test.local', password });
      expect(result.accessToken).toBeDefined();

      // Contador deve estar limpo
      await expect(
        rateLimiter.assertNotRateLimited(['email:user@test.local']),
      ).resolves.toBeUndefined();
    });
  });

  describe('1.2 Password recovery flow', () => {
    it('returns generic safe message and dispatches queue job when user exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-reset-1',
        email: 'reset@test.local',
        active: true,
      });

      const response = await authService.requestPasswordReset({
        email: 'reset@test.local',
      });

      expect(response.message).toContain(
        'as instruções para redefinição de senha foram enviadas',
      );
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalled();
      expect(queueMock.add).toHaveBeenCalledWith(
        'auth.password-reset',
        expect.objectContaining({
          userId: 'user-reset-1',
          email: 'reset@test.local',
        }),
        expect.anything(),
      );
    });

    it('returns same generic message without leaking information when user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await authService.requestPasswordReset({
        email: 'nonexistent@test.local',
      });

      expect(response.message).toContain(
        'as instruções para redefinição de senha foram enviadas',
      );
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(queueMock.add).not.toHaveBeenCalled();
    });

    it('confirms password reset, updates password, and revokes all active sessions', async () => {
      const oldHash = await passwordHasher.hash('OldPassword123!');
      const rawToken = 'a'.repeat(64);
      prismaMock.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-id-1',
        userId: 'user-1',
        user: {
          id: 'user-1',
          passwordHash: oldHash,
          active: true,
        },
      });

      const result = await authService.confirmPasswordReset({
        token: rawToken,
        newPassword: 'BrandNewSecurePassword2026!',
      });

      expect(result.message).toContain('Senha redefinida com sucesso');
      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'token-id-1' },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ passwordHash: expect.any(String) }),
        }),
      );
      // Revogação de sessões ativas
      expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', revokedAt: null },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects expired or already used reset tokens', async () => {
      prismaMock.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        authService.confirmPasswordReset({
          token: 'invalid-or-used-token',
          newPassword: 'BrandNewSecurePassword2026!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('1.3 MFA (TOTP) flow', () => {
    it('sets up MFA generating secret and otpauth url', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-mfa-1',
        email: 'mfa@test.local',
        mfaEnabled: false,
      });

      const setup = await authService.setupMfa({
        id: 'user-mfa-1',
        email: 'mfa@test.local',
        roles: [UserRole.ADMIN],
        sessionId: 'sess-1',
      });

      expect(setup.secret).toBeDefined();
      expect(setup.otpAuthUrl).toContain('otpauth://totp/');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-mfa-1' },
          data: expect.objectContaining({ mfaSecret: expect.any(String) }),
        }),
      );
      // O segredo persistido nunca é o texto plano gerado.
      const persistedSecret = prismaMock.user.update.mock.calls[0][0].data
        .mfaSecret as string;
      expect(persistedSecret).not.toBe(setup.secret);
      expect(totp.decryptSecret(persistedSecret)).toBe(setup.secret);
    });

    it('enables MFA with valid TOTP code and generates single-use backup codes', async () => {
      const secret = totp.generateSecret();
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-mfa-1',
        mfaEnabled: false,
        mfaSecret: totp.encryptSecret(secret),
      });

      const validCode = totp.generateCode(secret);
      const enabled = await authService.enableMfa(
        { id: 'user-mfa-1', email: 'mfa@test.local', roles: [], sessionId: 's-1' },
        { code: validCode },
      );

      expect(enabled.backupCodes).toHaveLength(8);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-mfa-1' },
          data: expect.objectContaining({
            mfaEnabled: true,
            mfaBackupCodes: expect.any(Array),
          }),
        }),
      );
    });

    it('requires MFA challenge during login when MFA is active', async () => {
      const password = 'PasswordMfa2026!';
      const passwordHash = await passwordHasher.hash(password);
      const secret = totp.generateSecret();

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-mfa-active',
        name: 'MFA User',
        email: 'mfa-active@test.local',
        passwordHash,
        roles: [UserRole.ADMIN],
        active: true,
        mfaEnabled: true,
        mfaSecret: totp.encryptSecret(secret),
        mfaBackupCodes: [],
      });

      // Login sem fornecer mfaCode
      const loginChallenge = await authService.login({
        email: 'mfa-active@test.local',
        password,
      });

      expect(loginChallenge).toEqual(
        expect.objectContaining({
          mfaRequired: true,
          mfaToken: expect.any(String),
        }),
      );

      // Agora conclui login fornecendo mfaCode direto
      const validCode = totp.generateCode(secret);
      const completedLogin = await authService.login({
        email: 'mfa-active@test.local',
        password,
        mfaCode: validCode,
      });

      expect(completedLogin.accessToken).toBeDefined();
    });

    it('consumes single-use backup code during login', async () => {
      const password = 'PasswordMfa2026!';
      const passwordHash = await passwordHasher.hash(password);
      const secret = totp.generateSecret();
      const backupCodes = totp.generateBackupCodes(8);
      const backupHashes = backupCodes.map((c) => totp.hashBackupCode(c));

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-backup-code',
        name: 'Backup Code User',
        email: 'backup@test.local',
        passwordHash,
        roles: [UserRole.ADMIN],
        active: true,
        mfaEnabled: true,
        mfaSecret: totp.encryptSecret(secret),
        mfaBackupCodes: [...backupHashes],
      });

      // Usa o primeiro código de backup
      const login = await authService.login({
        email: 'backup@test.local',
        password,
        mfaCode: backupCodes[0],
      });

      expect(login.accessToken).toBeDefined();
      // Deve ter atualizado o usuário removendo o código consumido
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-backup-code' },
          data: {
            mfaBackupCodes: expect.arrayContaining([backupHashes[1]]),
          },
        }),
      );
    });

    it('disables MFA only with valid current password', async () => {
      const password = 'CurrentPassword123!';
      const passwordHash = await passwordHasher.hash(password);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-mfa-disable',
        passwordHash,
        mfaEnabled: true,
      });

      // Senha errada deve falhar
      await expect(
        authService.disableMfa(
          { id: 'user-mfa-disable', email: 'test@local', roles: [], sessionId: 's-1' },
          { currentPassword: 'WrongPassword' },
        ),
      ).rejects.toThrow(UnauthorizedException);

      // Senha correta deve desativar
      const result = await authService.disableMfa(
        { id: 'user-mfa-disable', email: 'test@local', roles: [], sessionId: 's-1' },
        { currentPassword: password },
      );

      expect(result.message).toContain('MFA desativado');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-mfa-disable' },
          data: {
            mfaEnabled: false,
            mfaSecret: null,
            mfaBackupCodes: [],
          },
        }),
      );
    });
  });
});
