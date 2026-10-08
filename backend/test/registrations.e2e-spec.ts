import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import {
  authenticateE2eAdmin,
  request,
} from './helpers/authenticated-request.js';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Customer and blaster APIs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const customerIds: string[] = [];
  const blasterIds: string[] = [];

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
    await authenticateE2eAdmin(app);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { aggregateId: { in: customerIds } },
          { aggregateId: { in: blasterIds } },
        ],
      },
    });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.blaster.deleteMany({ where: { id: { in: blasterIds } } });
    await app.close();
  });

  it('validates customer identity/CR and evaluates requested PCE classes', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: 'Documento inválido',
        taxId: '11111111111',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: 'CR incompleto',
        taxId: '52998224725',
        hasCr: true,
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente de teste ${suffix}`,
        taxId: '11.222.333/0001-81',
        hasCr: true,
        crNumber: `CR-${suffix}`,
        crExpiresAt: '2099-12-31',
        authorizedPceClasses: ['1.3G', 'CLASSE_C'],
      })
      .expect(201);
    const customerId = created.body.id as string;
    customerIds.push(customerId);
    expect(created.body.taxId).toBe('11222333000181');

    const eligible = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/pce-eligibility`)
      .send({ classes: ['1.3G', 'CLASSE_C'] })
      .expect(201);
    expect(eligible.body.eligible).toBe(true);

    const restricted = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/pce-eligibility`)
      .send({ classes: ['1.1'] })
      .expect(201);
    expect(restricted.body.eligible).toBe(false);
    expect(restricted.body.unauthorizedClasses).toEqual(['1.1']);

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: 'Documento duplicado',
        taxId: '11222333000181',
      })
      .expect(409);
    expect(duplicate.body.message).toContain('dados únicos');

    await request(app.getHttpServer())
      .get(`/api/v1/customers/${customerId}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customerId}`)
      .send({ hasCr: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.hasCr).toBe(false);
        expect(body.crNumber).toBeNull();
        expect(body.authorizedPceClasses).toEqual([]);
      });

    const nowIneligible = await request(app.getHttpServer())
      .post(`/api/v1/customers/${customerId}/pce-eligibility`)
      .send({ classes: ['1.3G'] })
      .expect(201);
    expect(nowIneligible.body.eligible).toBe(false);
  });

  it('validates blaster CPF and checks license validity against event date', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/blasters')
      .send({
        name: 'CPF inválido',
        taxId: '11111111111',
        licenseNumber: 'LIC-INVALIDA',
        licenseExpiresAt: '2099-12-31',
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/api/v1/blasters')
      .send({
        name: `Blaster de teste ${suffix}`,
        taxId: '529.982.247-25',
        licenseNumber: `BL-${suffix}`,
        licenseExpiresAt: '2099-12-31',
        category: 'BLASTER_SHOW',
      })
      .expect(201);
    const blasterId = created.body.id as string;
    blasterIds.push(blasterId);
    expect(created.body.taxId).toBe('52998224725');

    const eligible = await request(app.getHttpServer())
      .post(`/api/v1/blasters/${blasterId}/eligibility`)
      .send({ eventAt: '2099-12-30T20:00:00-03:00' })
      .expect(201);
    expect(eligible.body.eligible).toBe(true);

    const expiredAtEvent = await request(app.getHttpServer())
      .post(`/api/v1/blasters/${blasterId}/eligibility`)
      .send({ eventAt: '2100-01-01T00:00:00Z' })
      .expect(201);
    expect(expiredAtEvent.body.eligible).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/v1/blasters/${blasterId}`)
      .send({ active: false })
      .expect(200);
    const inactive = await request(app.getHttpServer())
      .post(`/api/v1/blasters/${blasterId}/eligibility`)
      .send({ eventAt: '2099-12-30T20:00:00-03:00' })
      .expect(201);
    expect(inactive.body.eligible).toBe(false);

    await request(app.getHttpServer())
      .get('/api/v1/blasters?active=true')
      .expect(200)
      .expect(({ body }) => {
        expect(
          body.data.every((item: { active: boolean }) => item.active),
        ).toBe(true);
      });
  });
});
