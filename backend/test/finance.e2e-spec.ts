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
    await authenticateE2eAdmin(app);
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
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = dateOffset(1);
    const flowBefore = await request(app.getHttpServer())
      .get(`/api/v1/finance/cash-flow?from=${today}&to=${tomorrow}`)
      .expect(200);

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

    const flow = await request(app.getHttpServer())
      .get(`/api/v1/finance/cash-flow?from=${today}&to=${tomorrow}`)
      .expect(200);
    expect(
      Number(flow.body.totals.received) -
        Number(flowBefore.body.totals.received),
    ).toBe(100);
    expect(
      Number(flow.body.totals.paid) - Number(flowBefore.body.totals.paid),
    ).toBe(0);
    expect(
      Number(flow.body.totals.net) - Number(flowBefore.body.totals.net),
    ).toBe(100);
    expect(flow.body.days.length).toBeGreaterThanOrEqual(1);

    const createEntry = async (
      direction: 'PAGAR' | 'RECEBER',
      amount: number,
      dueDate: string,
      category = 'Teste de relatório',
    ) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/finance/entries')
        .send({
          direction,
          description: `Resumo financeiro ${randomUUID()}`,
          category,
          counterparty: 'Contraparte de teste',
          amount,
          dueDate,
        })
        .expect(201);
      return { id: response.body.id as string };
    };
    const dashboardBefore = await request(app.getHttpServer())
      .get(`/api/v1/finance/dashboard?from=${today}&to=${tomorrow}`)
      .expect(200);
    const [dueBeforePeriod, dueReceivable, duePayable, dueAfterPeriod, voided] =
      await Promise.all([
        createEntry('PAGAR', 45, dateOffset(-1)),
        createEntry('RECEBER', 100, tomorrow),
        createEntry('PAGAR', 90, tomorrow),
        createEntry('RECEBER', 400, dateOffset(10)),
        createEntry('PAGAR', 500, tomorrow),
      ]);
    entryIds.push(
      dueBeforePeriod.id,
      dueReceivable.id,
      duePayable.id,
      dueAfterPeriod.id,
      voided.id,
    );
    await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${voided.id}/cancel`)
      .expect(201);
    await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/finance/entries/${dueReceivable.id}/payments`)
        .send({ amount: 30, method: 'PIX' })
        .expect(201),
      request(app.getHttpServer())
        .post(`/api/v1/finance/entries/${duePayable.id}/payments`)
        .send({ amount: 10, method: 'DINHEIRO' })
        .expect(201),
    ]);
    const dashboard = await request(app.getHttpServer())
      .get(`/api/v1/finance/dashboard?from=${today}&to=${tomorrow}`)
      .expect(200);
    expect(dashboard.body.period).toEqual({ from: today, to: tomorrow });
    expect(dashboard.body.openBalances.asOf).toEqual(expect.any(String));
    expect(dashboard.body.openBalances.dueBeforePeriod.payable).toBe(
      String(
        Number(dashboardBefore.body.openBalances.dueBeforePeriod.payable) + 45,
      ),
    );
    expect(dashboard.body.openBalances.dueInPeriod.receivable).toBe(
      String(
        Number(dashboardBefore.body.openBalances.dueInPeriod.receivable) + 70,
      ),
    );
    expect(dashboard.body.openBalances.dueInPeriod.payable).toBe(
      String(
        Number(dashboardBefore.body.openBalances.dueInPeriod.payable) + 80,
      ),
    );
    expect(
      Number(dashboard.body.realized.totals.received) -
        Number(dashboardBefore.body.realized.totals.received),
    ).toBe(30);
    expect(
      Number(dashboard.body.realized.totals.paid) -
        Number(dashboardBefore.body.realized.totals.paid),
    ).toBe(10);
    await request(app.getHttpServer())
      .get(`/api/v1/finance/dashboard?from=${tomorrow}&to=${today}`)
      .expect(400);

    const paymentReportBefore = await request(app.getHttpServer())
      .get(
        `/api/v1/finance/reports/payment-breakdown?from=${today}&to=${tomorrow}`,
      )
      .expect(200);
    const receivableCategory = `Recebimentos teste ${randomUUID()}`;
    const payableCategory = `Pagamentos teste ${randomUUID()}`;
    const categorizedReceivable = await createEntry(
      'RECEBER',
      100,
      tomorrow,
      receivableCategory,
    );
    const categorizedPayable = await createEntry(
      'PAGAR',
      20,
      tomorrow,
      payableCategory,
    );
    entryIds.push(categorizedReceivable.id, categorizedPayable.id);
    await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/finance/entries/${categorizedReceivable.id}/payments`)
        .send({ amount: 25, method: 'PIX' })
        .expect(201),
      request(app.getHttpServer())
        .post(`/api/v1/finance/entries/${categorizedPayable.id}/payments`)
        .send({ amount: 8, method: 'BOLETO' })
        .expect(201),
    ]);
    await request(app.getHttpServer())
      .post(`/api/v1/finance/entries/${categorizedReceivable.id}/payments`)
      .send({ amount: 10, method: 'DINHEIRO' })
      .expect(201);
    const paymentReport = await request(app.getHttpServer())
      .get(
        `/api/v1/finance/reports/payment-breakdown?from=${today}&to=${tomorrow}`,
      )
      .expect(200);
    expect(paymentReport.body.basis).toBe(
      'pagamentos e recebimentos pela data de ocorrência',
    );
    expect(paymentReport.body.totals.paymentCount).toBe(
      paymentReportBefore.body.totals.paymentCount + 3,
    );
    expect(
      Number(paymentReport.body.totals.received) -
        Number(paymentReportBefore.body.totals.received),
    ).toBe(35);
    expect(
      Number(paymentReport.body.totals.paid) -
        Number(paymentReportBefore.body.totals.paid),
    ).toBe(8);
    const receivedCategory = paymentReport.body.byCategory.find(
      (item: { category: string }) => item.category === receivableCategory,
    );
    expect(receivedCategory).toMatchObject({
      paymentCount: 2,
      received: '35',
      paid: '0',
      net: '35',
    });
    const paymentMethod = paymentReport.body.byMethod.find(
      (item: { method: string }) => item.method === 'BOLETO',
    );
    const previousPaymentMethod = paymentReportBefore.body.byMethod.find(
      (item: { method: string }) => item.method === 'BOLETO',
    );
    expect(
      Number(paymentMethod.paid) - Number(previousPaymentMethod.paid),
    ).toBe(8);
    expect(
      paymentReport.body.byCategoryAndMethod.some(
        (item: { category: string; method: string; paid: string }) =>
          item.category === payableCategory &&
          item.method === 'BOLETO' &&
          item.paid === '8',
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .get(
        `/api/v1/finance/reports/payment-breakdown?from=${tomorrow}&to=${today}`,
      )
      .expect(400);

    const filtered = await request(app.getHttpServer())
      .get('/api/v1/finance/entries?direction=RECEBER&status=PAGO')
      .expect(200);
    expect(
      filtered.body.data.some(
        (entry: { id: string }) => entry.id === receivable.body.id,
      ),
    ).toBe(true);
  });

  it('generates aging report with correct maturity buckets for payable and receivable', async () => {
    // Cria um título vencido há 15 dias (overdue1to30)
    const overdue15 = await request(app.getHttpServer())
      .post('/api/v1/finance/entries')
      .send({
        direction: 'RECEBER',
        description: `Aging teste vencido ${randomUUID()}`,
        category: 'Aging',
        counterparty: 'Cliente Aging',
        amount: 200,
        dueDate: dateOffset(-15),
      })
      .expect(201);
    entryIds.push(overdue15.body.id as string);

    // Cria um título a vencer daqui a 10 dias (current)
    const current10 = await request(app.getHttpServer())
      .post('/api/v1/finance/entries')
      .send({
        direction: 'PAGAR',
        description: `Aging teste a vencer ${randomUUID()}`,
        category: 'Aging',
        counterparty: 'Fornecedor Aging',
        amount: 300,
        dueDate: dateOffset(10),
      })
      .expect(201);
    entryIds.push(current10.body.id as string);

    const aging = await request(app.getHttpServer())
      .get('/api/v1/finance/reports/aging')
      .expect(200);

    expect(aging.body.receivable.overdue1to30.count).toBeGreaterThanOrEqual(1);
    expect(Number(aging.body.receivable.overdue1to30.amount)).toBeGreaterThanOrEqual(200);
    expect(aging.body.payable.current.count).toBeGreaterThanOrEqual(1);
    expect(Number(aging.body.payable.current.amount)).toBeGreaterThanOrEqual(300);

    // Valida também via alias /api/v1/financial/reports/aging
    const agingAlias = await request(app.getHttpServer())
      .get('/api/v1/financial/reports/aging')
      .expect(200);
    expect(agingAlias.body.referenceDate).toBe(aging.body.referenceDate);

    // Valida o contrato documentado: referenceDate (não asOf) como query string
    const explicitReferenceDate = dateOffset(5);
    const agingWithExplicitDate = await request(app.getHttpServer())
      .get(
        `/api/v1/financial/reports/aging?referenceDate=${explicitReferenceDate}`,
      )
      .expect(200);
    expect(agingWithExplicitDate.body.referenceDate).toBe(
      explicitReferenceDate,
    );

    // O nome de query string documentado anteriormente (asOf) não é aceito
    // pelo ValidationPipe (whitelist estrito) e deve ser rejeitado com 400.
    await request(app.getHttpServer())
      .get(`/api/v1/financial/reports/aging?asOf=${explicitReferenceDate}`)
      .expect(400);
  });
});

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
