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
  const salesQuoteIds: string[] = [];
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
    await prisma.saleReturn.deleteMany({ where: { saleId: { in: saleIds } } });
    await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.salesQuote.deleteMany({
      where: { id: { in: salesQuoteIds } },
    });
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
          { aggregateId: { in: salesQuoteIds } },
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
      .get(`/api/v1/inventory/movements?productLotId=${lot.body.id}&type=SAIDA`)
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
    const lot = await createLot(
      product.body.id as string,
      `RACE-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 4);

    const checkouts = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({
          priceListId: list.id,
          items: [{ productLotId: lot.body.id, quantity: 6 }],
        }),
      request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({
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
        contractedAmount: 1000,
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

  it('reserves quoted stock for seven days and converts atomically at snapshot prices', async () => {
    const product = await createProduct('QCONV', false);
    const lot = await createLot(
      product.body.id as string,
      `QUOTE-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 7.25);
    const quote = await createSalesQuote(list.id, lot.body.id as string, 4);
    salesQuoteIds.push(quote.body.id as string);

    expect(quote.body.status).toBe('EMITIDO');
    expect(quote.body.total).toBe('29');
    expect(new Date(quote.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    );
    expect(new Date(quote.body.expiresAt).getTime()).toBeLessThan(
      Date.now() + 8 * 24 * 60 * 60 * 1000,
    );

    await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 7 }],
      })
      .expect(409);
    await request(app.getHttpServer())
      .get('/api/v1/sales/quotes?status=EMITIDO')
      .expect(200)
      .expect(({ body }) => {
        expect(
          body.data.some((item: { id: string }) => item.id === quote.body.id),
        ).toBe(true);
      });

    const converted = await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quote.body.id}/convert`)
      .expect(201);
    saleIds.push(converted.body.sale.id as string);
    expect(converted.body.quote.status).toBe('CONVERTIDO');
    expect(converted.body.sale.quoteId).toBe(quote.body.id);
    expect(converted.body.sale.total).toBe('29');
    expect(converted.body.sale.items[0].unitPrice).toBe('7.25');

    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quote.body.id}/convert`)
      .expect(409);
    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/lots/${lot.body.id}`)
      .expect(200);
    expect(stock.body.quantity).toBe('6');
  });

  it('releases stock when a quote is cancelled or expired', async () => {
    const product = await createProduct('QREL', false);
    const cancelledLot = await createLot(
      product.body.id as string,
      `CANCEL-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 2);
    const cancelledQuote = await createSalesQuote(
      list.id,
      cancelledLot.body.id as string,
      6,
    );
    salesQuoteIds.push(cancelledQuote.body.id as string);
    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${cancelledQuote.body.id}/cancel`)
      .expect(201);
    const saleAfterCancel = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        items: [{ productLotId: cancelledLot.body.id, quantity: 10 }],
      })
      .expect(201);
    saleIds.push(saleAfterCancel.body.id as string);

    const expiredLot = await createLot(
      product.body.id as string,
      `EXPIRE-${suffix}`,
      5,
    );
    const expiredQuote = await createSalesQuote(
      list.id,
      expiredLot.body.id as string,
      4,
    );
    salesQuoteIds.push(expiredQuote.body.id as string);
    await prisma.salesQuote.update({
      where: { id: expiredQuote.body.id as string },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/sales/quotes/${expiredQuote.body.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('EXPIRADO');
      });
    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${expiredQuote.body.id}/cancel`)
      .expect(409);
    const saleAfterExpiry = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        items: [{ productLotId: expiredLot.body.id, quantity: 5 }],
      })
      .expect(201);
    saleIds.push(saleAfterExpiry.body.id as string);
  });

  it('serializes concurrent quote reservations for the same lot', async () => {
    const product = await createProduct('QRACE', false);
    const lot = await createLot(
      product.body.id as string,
      `QRACE-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 5);

    const quotes = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/sales/quotes')
        .send({
          priceListId: list.id,
          items: [{ productLotId: lot.body.id, quantity: 6 }],
        }),
      request(app.getHttpServer())
        .post('/api/v1/sales/quotes')
        .send({
          priceListId: list.id,
          items: [{ productLotId: lot.body.id, quantity: 6 }],
        }),
    ]);
    for (const response of quotes) {
      if (response.status === 201) {
        salesQuoteIds.push(response.body.id as string);
      }
    }
    expect(
      quotes
        .map((response) => response.status)
        .sort((first, second) => first - second),
    ).toEqual([201, 409]);
  });

  it('protects quoted stock from manual movements and service-order approval', async () => {
    const product = await createProduct('QLOCK', false);
    const lot = await createLot(
      product.body.id as string,
      `QLOCK-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 3);
    const quote = await createSalesQuote(list.id, lot.body.id as string, 6);
    salesQuoteIds.push(quote.body.id as string);

    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'SAIDA',
        productLotId: lot.body.id,
        quantity: 5,
        reference: `QUOTE-LOCK-${suffix}`,
      })
      .expect(409);

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente OS orçamento ${suffix}`,
        taxId: makeValidCnpj(),
      })
      .expect(201);
    customerIds.push(customer.body.id as string);
    const blaster = await request(app.getHttpServer())
      .post('/api/v1/blasters')
      .send({
        name: `Blaster OS orçamento ${suffix}`,
        taxId: makeValidCpf(),
        licenseNumber: `LIC-QUOTE-${suffix}`,
        licenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    blasterIds.push(blaster.body.id as string);
    const order = await request(app.getHttpServer())
      .post('/api/v1/operations/orders')
      .send({
        customerId: customer.body.id,
        contractedAmount: 1000,
        eventAt: '2099-12-30T20:00:00-03:00',
        eventLocation: 'Evento reservado por orçamento comercial',
        items: [
          {
            productId: product.body.id,
            productLotId: lot.body.id,
            plannedQuantity: 5,
          },
        ],
      })
      .expect(201);
    orderIds.push(order.body.id as string);

    await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${order.body.id}/approve`)
      .send({ responsibleBlasterId: blaster.body.id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/operations/orders/${order.body.id}/cancel`)
      .expect(201);
  });

  it('requires an authorized buyer when issuing a PCE sales quote', async () => {
    const product = await createProduct('QPCE', true);
    const lot = await createLot(product.body.id as string, `QPCE-${suffix}`, 5);
    const list = await createPriceList(product.body.id as string, 8);

    await request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 1 }],
      })
      .expect(409);

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente orçamento PCE ${suffix}`,
        taxId: makeValidCnpj(),
        hasCr: true,
        crNumber: `CR-QUOTE-${suffix}`,
        crExpiresAt: '2099-12-31',
        authorizedPceClasses: ['1.3G'],
      })
      .expect(201);
    customerIds.push(customer.body.id as string);

    const quote = await request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .send({
        customerId: customer.body.id,
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 1 }],
      })
      .expect(201);
    salesQuoteIds.push(quote.body.id as string);
    await request(app.getHttpServer())
      .patch(`/api/v1/customers/${customer.body.id}`)
      .send({ active: false })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quote.body.id}/convert`)
      .expect(409);
    expect(
      await prisma.sale.count({ where: { quoteId: quote.body.id as string } }),
    ).toBe(0);
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

  async function createLot(
    productId: string,
    lotNumber: string,
    quantity: number,
  ) {
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

  function createSalesQuote(
    priceListId: string,
    productLotId: string,
    quantity: number,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .send({
        priceListId,
        items: [{ productLotId, quantity }],
      })
      .expect(201);
  }
});

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
