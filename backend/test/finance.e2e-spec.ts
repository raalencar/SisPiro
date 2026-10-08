import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Finance API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const entryIds: string[] = [];

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
  });

  afterAll(async () => {
    await prisma.financialPayment.deleteMany({
      where: { entryId: { in: entryIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { aggregateId: { in: entryIds } },
    });
    await prisma.financialEntry.deleteMany({
      where: { id: { in: entryIds } },
    });
    await app.close();
  });

  it('tracks partial settlement, prevents overpayment, and reports realized cash flow', async () => {
    const receivable = await request(app.getHttpServer())
      .post('/api/v1/finance/entries')
      .send({
        direction: 'RECEBER',
        description: `Serviço financeiro ${randomUUID()}`,
        category: 'Serviços',
        counterparty: 'Cliente de teste',
        amount: 100,
        dueDate: dateOffset(7),
        reference: `FIN-${randomUUID()}`,
      })
      .expect(201);
    entryIds.push(receivable.body.id as string);
    expect(receivable.body.status).toBe('ABERTO');
    expect(receivable.body.outstanding).toBe('100');

    const partial = await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${receivable.body.id}/payments`)
      .send({ amount: 40, method: 'PIX' })
      .expect(201);
    expect(partial.body.status).toBe('PARCIAL');
    expect(partial.body.paid).toBe('40');
    expect(partial.body.outstanding).toBe('60');

    const overpayment = await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${receivable.body.id}/payments`)
      .send({ amount: 61, method: 'PIX' })
      .expect(409);
    expect(overpayment.body.message).toContain('excede o saldo');

    const settled = await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${receivable.body.id}/payments`)
      .send({ amount: 60, method: 'TRANSFERENCIA' })
      .expect(201);
    expect(settled.body.status).toBe('PAGO');
    expect(settled.body.outstanding).toBe('0');

    await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${receivable.body.id}/payments`)
      .send({ amount: 1, method: 'DINHEIRO' })
      .expect(409);

    const payable = await request(app.getHttpServer())
      .post('/api/v1/finance/entries')
      .send({
        direction: 'PAGAR',
        description: `Compra financeira ${randomUUID()}`,
        category: 'Fornecedores',
        counterparty: 'Fornecedor de teste',
        amount: 50,
        dueDate: dateOffset(10),
      })
      .expect(201);
    entryIds.push(payable.body.id as string);

    const invalidCustomerPayable = await request(app.getHttpServer())
      .post('/api/v1/finance/entries')
      .send({
        direction: 'PAGAR',
        description: 'Conta inválida',
        category: 'Teste',
        counterparty: 'Teste',
        customerId: randomUUID(),
        amount: 10,
        dueDate: dateOffset(10),
      })
      .expect(400);
    expect(invalidCustomerPayable.body.message).toContain(
      'não pode ser vinculada',
    );

    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${payable.body.id}/cancel`)
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELADO');

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = dateOffset(1);
    const flow = await request(app.getHttpServer())
      .get(`/api/v1/finance/cash-flow?from=${today}&to=${tomorrow}`)
      .expect(200);
    expect(flow.body.totals.received).toBe('100');
    expect(flow.body.totals.paid).toBe('0');
    expect(flow.body.totals.net).toBe('100');
    expect(flow.body.days).toHaveLength(1);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/finance/entries?direction=RECEBER&status=PAGO')
      .expect(200);
    expect(
      filtered.body.data.some(
        (entry: { id: string }) => entry.id === receivable.body.id,
      ),
    ).toBe(true);
  });
});

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
