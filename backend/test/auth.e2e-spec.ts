import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { LoginRateLimiterService } from '../src/modules/auth/login-rate-limiter.service.js';
import { TotpService } from '../src/modules/auth/totp.service.js';
import { authenticateE2eAdmin } from './helpers/authenticated-request.js';

describe('Authentication and users API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  const totp = new TotpService({
    getOrThrow: () => 'e2e-test-only-mfa-encryption-key-32-chars-min',
  } as unknown as ConfigService);
  const userIds: string[] = [];
  const suffix = randomUUID();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    await app.init();
    adminToken = await authenticateE2eAdmin(app);
  });

  afterAll(async () => {
    const sessions = await prisma.authSession.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const sessionIds = sessions.map((session) => session.id);
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: userIds } },
          { aggregateId: { in: userIds } },
          { aggregateId: { in: sessionIds } },
        ],
      },
    });
    await prisma.passwordResetToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('bootstraps once, protects private routes, and enforces module roles', async () => {
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/bootstrap')
      .send({
        name: 'Segundo administrador',
        email: `second-${suffix}@local.test`,
        password: 'Another Safe Password 2026',
      })
      .expect(409);

    const missingToken = await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
    expect(missingToken.body.message).toBe('Token de acesso obrigatório.');
    await supertest(app.getHttpServer()).get('/api/v1/health/live').expect(200);

    const created = await supertest(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Financeiro E2E',
        email: `finance-${suffix}@local.test`,
        password: 'Finance Test Password 2026',
        roles: ['FINANCEIRO'],
      })
      .expect(201);
    userIds.push(created.body.id as string);
    expect(created.body).not.toHaveProperty('passwordHash');
    await supertest(app.getHttpServer())
      .get(`/api/v1/users/${created.body.id as string}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.email).toBe(`finance-${suffix}@local.test`);
        expect(body).not.toHaveProperty('passwordHash');
      });

    const login = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: `finance-${suffix}@local.test`,
        password: 'Finance Test Password 2026',
      })
      .expect(200);
    const financeToken = login.body.accessToken as string;
    expect(login.body.user.roles).toEqual(['FINANCEIRO']);
    await supertest(app.getHttpServer())
      .get('/api/v1/finance/entries')
      .set('Authorization', `Bearer ${financeToken}`)
      .expect(200);
    await supertest(app.getHttpServer())
      .get('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${financeToken}`)
      .expect(403);
    await supertest(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${financeToken}`)
      .expect(403);
    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${financeToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.email).toBe(`finance-${suffix}@local.test`);
        expect(body).not.toHaveProperty('passwordHash');
      });
  });

  it('rotates refresh tokens and revokes the session on token reuse', async () => {
    const user = await createUser('OPERACOES');
    const login = await loginAs(user.email, user.password);
    const refreshed = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    const [sessionId] = (refreshed.body.refreshToken as string).split('.');
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: `${sessionId}.${'A'.repeat(64)}` })
      .expect(401);
    const secondRotation = await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(200);

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondRotation.body.accessToken}`)
      .expect(401);
  });

  it('changes passwords, revokes sessions, and blocks inactive users', async () => {
    const user = await createUser('COMERCIAL');
    const login = await loginAs(user.email, user.password);
    const newPassword = 'Updated E2E Password 2026';

    await supertest(app.getHttpServer())
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        currentPassword: user.password,
        newPassword,
      })
      .expect(200);
    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(401);
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    const newLogin = await loginAs(user.email, newPassword);
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: newLogin.body.refreshToken })
      .expect(200);
    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newLogin.body.accessToken}`)
      .expect(401);

    const activeLogin = await loginAs(user.email, newPassword);
    await supertest(app.getHttpServer())
      .patch(`/api/v1/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ active: false })
      .expect(200);
    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${activeLogin.body.accessToken}`)
      .expect(401);
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: newPassword })
      .expect(401);
  });

  it('prevents removing the final active administrator', async () => {
    const otherAdminIds = (
      await prisma.user.findMany({
        where: {
          email: { not: 'e2e-admin@local.test' },
          active: true,
          roles: { has: 'ADMIN' },
        },
        select: { id: true },
      })
    ).map((user) => user.id);
    await prisma.user.updateMany({
      where: { id: { in: otherAdminIds } },
      data: { active: false },
    });

    try {
      const currentAdmin = await supertest(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await supertest(app.getHttpServer())
        .patch(`/api/v1/users/${currentAdmin.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(409);
      await supertest(app.getHttpServer())
        .patch(`/api/v1/users/${currentAdmin.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['FINANCEIRO'] })
        .expect(409);
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: otherAdminIds } },
        data: { active: true },
      });
    }
  });

  it('enforces login rate limiting without revealing user existence (429)', async () => {
    const targetEmail = `rate-limit-${suffix}@local.test`;
    for (let i = 0; i < 5; i++) {
      await supertest(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'WrongPassword123' })
        .expect(401);
    }

    const rateLimited = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password: 'WrongPassword123' })
      .expect(429);

    expect(rateLimited.body.message).toContain('Muitas tentativas');
    await app.get(LoginRateLimiterService).clearAll();
  });

  it('handles password recovery request and confirmation with session revocation', async () => {
    const user = await createUser('ESTOQUE');
    const initialLogin = await loginAs(user.email, user.password);
    expect(initialLogin.body.accessToken).toBeDefined();

    const reqResponse = await supertest(app.getHttpServer())
      .post('/api/v1/auth/password-reset/request')
      .send({ email: user.email })
      .expect(200);

    expect(reqResponse.body.message).toContain(
      'as instruções para redefinição de senha foram enviadas',
    );

    const resetRawToken = randomBytes(32).toString('hex');
    const resetHash = createHash('sha256').update(resetRawToken).digest('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const newPassword = 'NewSecretPassword2026!';
    await supertest(app.getHttpServer())
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: resetRawToken, newPassword })
      .expect(200);

    await supertest(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${initialLogin.body.accessToken}`)
      .expect(401);

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    const newLogin = await loginAs(user.email, newPassword);
    expect(newLogin.body.accessToken).toBeDefined();

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: resetRawToken, newPassword: 'AnotherPassword2026!' })
      .expect(400);
  });

  it('serializes concurrent password reset confirmations with pessimistic locks preventing double-use', async () => {
    const user = await createUser('ESTOQUE');
    const resetRawToken = randomBytes(32).toString('hex');
    const resetHash = createHash('sha256').update(resetRawToken).digest('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: resetHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const [req1, req2] = await Promise.all([
      supertest(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: resetRawToken, newPassword: 'FirstConcurrentPassword2026!' }),
      supertest(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: resetRawToken, newPassword: 'SecondConcurrentPassword2026!' }),
    ]);

    const statuses = [req1.status, req2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);
  });

  it('handles complete MFA lifecycle (setup, enable, challenge/verify, backup codes, disable)', async () => {
    const user = await createUser('ADMIN');
    const login = await loginAs(user.email, user.password);
    const token = login.body.accessToken as string;

    const setup = await supertest(app.getHttpServer())
      .post('/api/v1/auth/mfa/setup')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(setup.body.secret).toBeDefined();
    expect(setup.body.otpAuthUrl).toContain('otpauth://totp/');

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: '000000' })
      .expect(400);

    const validCode = totp.generateCode(setup.body.secret);
    const enabled = await supertest(app.getHttpServer())
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: validCode })
      .expect(200);

    expect(enabled.body.backupCodes).toHaveLength(8);
    const backupCode = enabled.body.backupCodes[0] as string;

    const challenge = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(200);

    expect(challenge.body.mfaRequired).toBe(true);
    expect(challenge.body.mfaToken).toBeDefined();

    const nextCode = totp.generateCode(setup.body.secret);
    const mfaLogin = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login/mfa')
      .send({ mfaToken: challenge.body.mfaToken, code: nextCode })
      .expect(200);

    expect(mfaLogin.body.accessToken).toBeDefined();

    const backupLogin = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password, mfaCode: backupCode })
      .expect(200);

    expect(backupLogin.body.accessToken).toBeDefined();

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password, mfaCode: backupCode })
      .expect(401);

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/mfa/disable')
      .set('Authorization', `Bearer ${backupLogin.body.accessToken}`)
      .send({ currentPassword: 'WrongPassword' })
      .expect(401);

    await supertest(app.getHttpServer())
      .post('/api/v1/auth/mfa/disable')
      .set('Authorization', `Bearer ${backupLogin.body.accessToken}`)
      .send({ currentPassword: user.password })
      .expect(200);

    const directLogin = await loginAs(user.email, user.password);
    expect(directLogin.body.accessToken).toBeDefined();
    expect(directLogin.body.mfaRequired).toBeUndefined();
  });

  async function createUser(role: string) {
    const email = `${role.toLowerCase()}-${randomUUID()}@local.test`;
    const password = `${role} Test Password 2026`;
    const response = await supertest(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Usuário ${role}`, email, password, roles: [role] })
      .expect(201);
    userIds.push(response.body.id as string);
    return { id: response.body.id as string, email, password };
  }

  function loginAs(email: string, password: string) {
    return supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
  }
});
