import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Commercial sales API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const customerIds: string[] = [];
  const blasterIds: string[] = [];
  const productIds: string[] = [];
  const magazineIds: string[] = [];
  const lotIds: string[] = [];
  const priceListIds: string[] = [];
  const saleIds: string[] = [];
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
  });

  afterAll(async () => {
    await prisma.saleReturn.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.serviceOrder.deleteMany({
      where: { id: { in: orderIds } },
    });
    await prisma.stockMovement.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { aggregateId: { in: saleIds } },
          { aggregateId: { in: orderIds } },
          { aggregateId: { in: priceListIds } },
          { aggregateId: { in: customerIds } },
          { aggregateId: { in: blasterIds } },
          { aggregateId: { in: productIds } },
          { aggregateId: { in: lotIds } },
        ],
      },
    });
    await prisma.productLot.deleteMany({ where: { id: { in: lotIds } } });
    await prisma.magazine.deleteMany({ where: { id: { in: magazineIds } } });
    await prisma.priceList.deleteMany({
      where: { id: { in: priceListIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    await prisma.blaster.deleteMany({ where: { id: { in: blasterIds } } });
    await app.close();
  });

  it('validates PCE buyer and completes checkout with price snapshot and stock movement', async () => {
    const product = await createProduct('PCE', true);
    const lot = await createLot(product.body.id as string, `PCE-${suffix}`, 10);
    const list = await createPriceList(product.body.id as string, 12.5);

    const walkInRestrictedSale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(409);
    expect(walkInRestrictedSale.body.message).toContain('CR válido');

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente venda PCE ${suffix}`,
        taxId: makeValidCnpj(),
        hasCr: true,
        crNumber: `CR-VENDA-${suffix}`,
        crExpiresAt: '2099-12-31',
        authorizedPceClasses: ['1.3G'],
      })
      .expect(201);
    customerIds.push(customer.body.id as string);

    const response = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        customerId: customer.body.id,
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(201);
    saleIds.push(response.body.id as string);
    expect(response.body.total).toBe('25');
    expect(response.body.items[0].unitPrice).toBe('12.5');
    expect(response.body.items[0].subtotal).toBe('25');

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/lots/${lot.body.id}`)
      .expect(200);
    expect(stock.body.quantity).toBe('8');

    const history = await request(app.getHttpServer())
      .get(
        `/api/v1/inventory/movements?productLotId=${lot.body.id}&type=SAIDA`,
      )
      .expect(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0].reference).toMatch(/^VENDA-/);

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/sales/${response.body.id}`)
      .expect(200);
    expect(fetched.body.customerId).toBe(customer.body.id);

    const saleItemId = response.body.items[0].id as string;
    const returned = await request(app.getHttpServer())
      .post(`/api/v1/sales/${response.body.id}/returns`)
      .send({
        reason: 'Produto retornado sem uso.',
        items: [{ saleItemId, quantity: 1 }],
      })
      .expect(201);
    expect(returned.body.items[0].quantity).toBe('1');
    expect(returned.body.items[0].subtotal).toBe('12.5');

    await request(app.getHttpServer())
      .post(`/api/v1/sales/${response.body.id}/returns`)
      .send({
        reason: 'Tentativa de devolver acima do restante.',
        items: [{ saleItemId, quantity: 2 }],
      })
      .expect(409);

    const returnedStock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/lots/${lot.body.id}`)
      .expect(200);
    expect(returnedStock.body.quantity).toBe('9');

    const returns = await request(app.getHttpServer())
      .get(`/api/v1/sales/${response.body.id}/returns`)
      .expect(200);
    expect(returns.body).toHaveLength(1);
  });

  it('serializes concurrent checkouts for stock in the same lot', async () => {
    const product = await createProduct('RACE', false);
    const lot = await createLot(product.body.id as string, `RACE-${suffix}`, 10);
    const list = await createPriceList(product.body.id as string, 4);

    const checkouts = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/sales').send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 6 }],
      }),
      request(app.getHttpServer()).post('/api/v1/sales').send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 6 }],
      }),
    ]);
    for (const response of checkouts) {
      if (response.status === 201) {
        saleIds.push(response.body.id as string);
      }
    }
    expect(
      checkouts
        .map((response) => response.status)
        .sort((first, second) => first - second),
    ).toEqual([201, 409]);
  });

  it('does not sell quantities already reserved by an approved service order', async () => {
    const product = await createProduct('RESERVED', false);
    const lot = await createLot(
      product.body.id as string,
      `RESERVED-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 3);
    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente OS venda ${suffix}`,
        taxId: makeValidCnpj(),
      })
      .expect(201);
    customerIds.push(customer.body.id as string);
    const blaster = await request(app.getHttpServer())
      .post('/api/v1/blasters')
      .send({
        name: `Blaster OS venda ${suffix}`,
        taxId: makeValidCpf(),
        licenseNumber: `LIC-OS-VENDA-${suffix}`,
        licenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    blasterIds.push(blaster.body.id as string);

    const order = await request(app.getHttpServer())
      .post('/api/v1/operations/orders')
      .send({
        customerId: customer.body.id,
        eventAt: '2099-12-30T20:00:00-03:00',
        eventLocation: 'Evento teste reserva comercial',
        items: [
          {
            productId: product.body.id,
            productLotId: lot.body.id,
            plannedQuantity: 7,
          },
        ],
      })
      .expect(201);
    orderIds.push(order.body.id as string);
    await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${order.body.id}/approve`)
      .send({ responsibleBlasterId: blaster.body.id })
      .expect(201);

    const sale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 4 }],
      })
      .expect(409);
    expect(sale.body.message).toContain('Estoque disponível insuficiente');

    await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${order.body.id}/cancel`)
      .expect(201);
  });

  async function createProduct(label: string, isPce: boolean) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `SALE-${label}-${suffix}`,
        name: `Produto comercial ${label} ${suffix}`,
        type: 'MERCADORIA',
        isPce,
        ...(isPce ? { riskClass: '1.3G', neqGrams: 100 } : {}),
        unit: 'UN',
      })
      .expect(201);
    productIds.push(response.body.id as string);
    return response;
  }

  async function createLot(productId: string, lotNumber: string, quantity: number) {
    const magazine = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol comercial ${lotNumber}`,
        maxNeqCapacityKg: 100,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magazine.body.id as string);

    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/lots')
      .send({
        productId,
        magazineId: magazine.body.id,
        lotNumber,
        quantity,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fornecedor teste comercial',
      })
      .expect(201);
    lotIds.push(response.body.id as string);
    return response;
  }

  async function createPriceList(productId: string, unitPrice: number) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/pricing/lists')
      .send({
        name: `Tabela balcão ${suffix}`,
        items: [{ productId, unitPrice }],
      })
      .expect(201);
    priceListIds.push(response.body.id as string);
    return response.body as { id: string };
  }
});

function makeValidCnpj(): string {
  const digits = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 10),
  );
  const first = checkDigit(
    digits,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const second = checkDigit(
    [...digits, first],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return [...digits, first, second].join('');
}

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

function checkDigit(digits: number[], weights: number[]): number {
  const remainder =
    digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
