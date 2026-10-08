import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import {
  authenticateE2eAdmin,
  request,
} from './helpers/authenticated-request.js';
import supertest from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Service order APIs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const customerIds: string[] = [];
  const blasterIds: string[] = [];
  const productIds: string[] = [];
  const magazineIds: string[] = [];
  const lotIds: string[] = [];
  const orderIds: string[] = [];
  const financialEntryIds: string[] = [];
  const operationalUserIds: string[] = [];

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
    const entries = await prisma.financialEntry.findMany({
      where: { serviceOrderId: { in: orderIds } },
      select: { id: true },
    });
    financialEntryIds.push(...entries.map((entry) => entry.id));
    await prisma.auditLog.deleteMany({
      where: { aggregateId: { in: financialEntryIds } },
    });
    await prisma.financialEntry.deleteMany({
      where: { id: { in: financialEntryIds } },
    });
    await prisma.serviceOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.stockMovement.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { aggregateId: { in: orderIds } },
          { aggregateId: { in: customerIds } },
          { aggregateId: { in: blasterIds } },
          { aggregateId: { in: productIds } },
          { aggregateId: { in: magazineIds } },
          { aggregateId: { in: lotIds } },
          { aggregateId: { in: operationalUserIds } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { id: { in: operationalUserIds } },
    });
    await prisma.productLot.deleteMany({ where: { id: { in: lotIds } } });
    await prisma.magazine.deleteMany({ where: { id: { in: magazineIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.blaster.deleteMany({ where: { id: { in: blasterIds } } });
    await app.close();
  });

  it('reserves stock on approval, protects reservations, consumes actual burn, and releases leftovers', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `OS-PCE-${suffix}`,
        name: 'Produto PCE para teste de OS',
        type: 'MERCADORIA',
        isPce: true,
        riskClass: '1.3G',
        neqGrams: 100,
        unit: 'UN',
      })
      .expect(201);
    productIds.push(product.body.id as string);

    const magazine = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol OS ${suffix}`,
        maxNeqCapacityKg: 10,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magazine.body.id as string);

    const lot = await request(app.getHttpServer())
      .post('/api/v1/inventory/lots')
      .send({
        productId: product.body.id,
        magazineId: magazine.body.id,
        lotNumber: `OS-LOTE-${suffix}`,
        quantity: 10,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fabricante de teste',
      })
      .expect(201);
    lotIds.push(lot.body.id as string);

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente OS ${suffix}`,
        taxId: makeValidCnpj(),
        hasCr: true,
        crNumber: `CR-OS-${suffix}`,
        crExpiresAt: '2099-12-31',
        authorizedPceClasses: ['1.3G'],
      })
      .expect(201);
    customerIds.push(customer.body.id as string);

    const blaster = await request(app.getHttpServer())
      .post('/api/v1/blasters')
      .send({
        name: `Blaster OS ${suffix}`,
        taxId: makeValidCpf(),
        licenseNumber: `LIC-OS-${suffix}`,
        licenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    blasterIds.push(blaster.body.id as string);

    const createOrder = async (quantity: number) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/operations/orders')
        .send({
          customerId: customer.body.id,
          contractedAmount: 1500,
          eventAt: '2099-12-30T20:00:00-03:00',
          eventLocation: 'Local de teste de OS',
          items: [
            {
              productId: product.body.id,
              productLotId: lot.body.id,
              plannedQuantity: quantity,
            },
          ],
        });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      orderIds.push(response.body.id as string);
      return response;
    };

    const approveOrder = (orderId: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/operations/orders/${orderId}/approve`)
        .send({ responsibleBlasterId: blaster.body.id });

    const firstOrder = await createOrder(7);
    expect(firstOrder.body.status).toBe('ORCAMENTO');
    expect(firstOrder.body.contractedAmount).toBe('1500');
    const approved = await approveOrder(firstOrder.body.id).expect(201);
    expect(approved.body.status).toBe('APROVADO');
    expect(approved.body.reservationActive).toBe(true);
    expect(approved.body.reservedNeqKg).toBe('0.7');

    const bypassReservation = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'SAIDA',
        productLotId: lot.body.id,
        quantity: 4,
      })
      .expect(409);
    expect(bypassReservation.body.message).toContain('reservado');

    const competingOrder = await createOrder(4);
    const noAvailability = await approveOrder(competingOrder.body.id).expect(
      409,
    );
    expect(noAvailability.body.message).toContain('Estoque disponível');

    const started = await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${firstOrder.body.id}/start`)
      .expect(201);
    expect(started.body.status).toBe('EM_MONTAGEM');

    const itemId = firstOrder.body.items[0].id as string;
    expect(
      await prisma.financialEntry.count({
        where: { serviceOrderId: firstOrder.body.id },
      }),
    ).toBe(0);
    const closed = await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${firstOrder.body.id}/close`)
      .send({
        dueDate: '2099-12-31',
        items: [{ itemId, firedQuantity: 5 }],
        reportNotes: 'Queima concluída no teste automatizado.',
      })
      .expect(201);
    expect(closed.body.status).toBe('EXECUTADO');
    expect(closed.body.reservationActive).toBe(false);
    expect(closed.body.items[0].firedQuantity).toBe('5');
    expect(closed.body.financialEntry).toMatchObject({
      amount: '1500',
      dueDate: '2099-12-31',
      status: 'ABERTO',
    });
    const receivable = await request(app.getHttpServer())
      .get(`/api/v1/finance/entries/${closed.body.financialEntry.id}`)
      .expect(200);
    expect(receivable.body).toMatchObject({
      direction: 'RECEBER',
      amount: '1500',
      customerId: customer.body.id,
      serviceOrderId: firstOrder.body.id,
      serviceOrder: {
        id: firstOrder.body.id,
      },
    });

    const afterBurn = await request(app.getHttpServer())
      .get(`/api/v1/inventory/lots/${lot.body.id}`)
      .expect(200);
    expect(afterBurn.body.quantity).toBe('5');

    const approvedCompetingOrder = await approveOrder(
      competingOrder.body.id,
    ).expect(201);
    expect(approvedCompetingOrder.body.reservationActive).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${competingOrder.body.id}/cancel`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'SAIDA',
        productLotId: lot.body.id,
        quantity: 5,
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/operations/orders?status=EXECUTADO')
      .expect(200);
    expect(
      list.body.data.some(
        (order: { id: string }) => order.id === firstOrder.body.id,
      ),
    ).toBe(true);

    const report = await request(app.getHttpServer())
      .get(
        '/api/v1/operations/orders/reports/summary?from=2099-12-30&to=2099-12-30',
      )
      .expect(200);
    expect(report.body.period).toEqual({
      from: '2099-12-30',
      to: '2099-12-30',
      basis: 'data do evento',
    });
    expect(report.body.totals).toEqual({
      orderCount: 2,
      ordersWithoutContractedAmount: 0,
      contractedAmount: '3000',
    });
    expect(report.body.byStatus).toEqual([
      {
        status: 'ORCAMENTO',
        orderCount: 0,
        ordersWithoutContractedAmount: 0,
        contractedAmount: '0',
      },
      {
        status: 'APROVADO',
        orderCount: 0,
        ordersWithoutContractedAmount: 0,
        contractedAmount: '0',
      },
      {
        status: 'EM_MONTAGEM',
        orderCount: 0,
        ordersWithoutContractedAmount: 0,
        contractedAmount: '0',
      },
      {
        status: 'EXECUTADO',
        orderCount: 1,
        ordersWithoutContractedAmount: 0,
        contractedAmount: '1500',
      },
      {
        status: 'CANCELADO',
        orderCount: 1,
        ordersWithoutContractedAmount: 0,
        contractedAmount: '1500',
      },
    ]);
    await request(app.getHttpServer())
      .get(
        '/api/v1/operations/orders/reports/summary?from=2099-12-31&to=2099-12-30',
      )
      .expect(400);
  });

  it('serializes concurrent approvals competing for the same lot', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `OS-RACE-${suffix}`,
        name: 'Produto para concorrência de OS',
        type: 'MERCADORIA',
        isPce: false,
        unit: 'UN',
      })
      .expect(201);
    productIds.push(product.body.id as string);

    const magazine = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol concorrente OS ${suffix}`,
        maxNeqCapacityKg: 1,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magazine.body.id as string);

    const lot = await request(app.getHttpServer())
      .post('/api/v1/inventory/lots')
      .send({
        productId: product.body.id,
        magazineId: magazine.body.id,
        lotNumber: `OS-RACE-LOTE-${suffix}`,
        quantity: 10,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fabricante de teste',
      })
      .expect(201);
    lotIds.push(lot.body.id as string);

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente concorrente OS ${suffix}`,
        taxId: makeValidCnpj(),
      })
      .expect(201);
    customerIds.push(customer.body.id as string);

    const blaster = await request(app.getHttpServer())
      .post('/api/v1/blasters')
      .send({
        name: `Blaster concorrente OS ${suffix}`,
        taxId: makeValidCpf(),
        licenseNumber: `LIC-RACE-${suffix}`,
        licenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    blasterIds.push(blaster.body.id as string);

    const createOrder = async (location: string) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/operations/orders')
        .send({
          customerId: customer.body.id,
          contractedAmount: 2000,
          eventAt: '2099-12-30T20:00:00-03:00',
          eventLocation: location,
          items: [
            {
              productId: product.body.id,
              productLotId: lot.body.id,
              plannedQuantity: 6,
            },
          ],
        });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      orderIds.push(response.body.id as string);
      return response.body.id as string;
    };

    const orderIdsForRace = await Promise.all([
      createOrder('Evento concorrente A'),
      createOrder('Evento concorrente B'),
    ]);
    const approvals = await Promise.all(
      orderIdsForRace.map((id) =>
        request(app.getHttpServer())
          .post(`/api/v1/operations/orders/${id}/approve`)
          .send({ responsibleBlasterId: blaster.body.id }),
      ),
    );
    expect(
      approvals
        .map((response) => response.status)
        .sort((first, second) => first - second),
    ).toEqual([201, 409]);
  });

  it('allows operations users only the minimal OS reference reads', async () => {
    const password = `OS e2e Operacoes ${suffix}`;
    const user = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        name: 'Usuário de operações E2E',
        email: `operacoes-${suffix}@local.test`,
        password,
        roles: ['OPERACOES'],
      })
      .expect(201);
    operationalUserIds.push(user.body.id as string);

    const login = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `operacoes-${suffix}@local.test`, password })
      .expect(200);
    const asOperations = () => {
      const client = supertest(app.getHttpServer());
      const authorization = `Bearer ${login.body.accessToken as string}`;
      return {
        get: (path: string) =>
          client.get(path).set('Authorization', authorization),
        post: (path: string) =>
          client.post(path).set('Authorization', authorization),
      };
    };

    const operationalRequest = asOperations();
    const customers = await operationalRequest
      .get('/api/v1/customers/operational-options')
      .expect(200);
    const customer = customers.body.data.find(
      (entry: { id: string }) => entry.id === customerIds[0],
    );
    expect(customer).toBeDefined();
    expect(customer).not.toHaveProperty('taxId');
    expect(customer).not.toHaveProperty('crNumber');

    const blasters = await operationalRequest
      .get('/api/v1/blasters/operational-options')
      .expect(200);
    const blaster = blasters.body.data.find(
      (entry: { id: string }) => entry.id === blasterIds[0],
    );
    expect(blaster).toBeDefined();
    expect(blaster).not.toHaveProperty('taxId');

    const lots = await operationalRequest
      .get('/api/v1/inventory/operational-lots')
      .expect(200);
    const lot = lots.body.data.find(
      (entry: { id: string }) => entry.id === lotIds[0],
    );
    expect(lot).toBeDefined();
    expect(lot).not.toHaveProperty('manufacturerOrImporter');

    await operationalRequest.get('/api/v1/operations/orders').expect(200);
    await operationalRequest.get('/api/v1/customers').expect(403);
    await operationalRequest.get('/api/v1/inventory/products').expect(403);
    await operationalRequest.get('/api/v1/inventory/lots').expect(403);
    await operationalRequest.post('/api/v1/customers').send({}).expect(403);
    await operationalRequest
      .post('/api/v1/inventory/products')
      .send({})
      .expect(403);
  });
});

function makeValidCpf(): string {
  const digits = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 10),
  );
  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(
    [...digits, first],
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return [...digits, first, second].join('');
}

function makeValidCnpj(): string {
  const digits = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 10),
  );
  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(
    [...digits, first],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return [...digits, first, second].join('');
}

function checkDigit(digits: number[], weights: number[]): number {
  const remainder =
    digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
