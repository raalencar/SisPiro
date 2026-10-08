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
        ],
      },
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
    const closed = await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${firstOrder.body.id}/close`)
      .send({
        items: [{ itemId, firedQuantity: 5 }],
        reportNotes: 'Queima concluída no teste automatizado.',
      })
      .expect(201);
    expect(closed.body.status).toBe('EXECUTADO');
    expect(closed.body.reservationActive).toBe(false);
    expect(closed.body.items[0].firedQuantity).toBe('5');

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
