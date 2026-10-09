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
  const promotionIds: string[] = [];
  const saleIds: string[] = [];
  const saleReturnIds: string[] = [];
  const salesQuoteIds: string[] = [];
  const orderIds: string[] = [];
  const financialEntryIds: string[] = [];

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
    const validSaleIds = saleIds.filter((id): id is string => Boolean(id));
    const validReturnIds = saleReturnIds.filter((id): id is string =>
      Boolean(id),
    );
    const validQuoteIds = salesQuoteIds.filter((id): id is string =>
      Boolean(id),
    );
    const validPriceListIds = priceListIds.filter((id): id is string =>
      Boolean(id),
    );
    const saleEntries = await prisma.financialEntry.findMany({
      where: {
        OR: [
          { saleId: { in: validSaleIds } },
          { sale: { priceListId: { in: validPriceListIds } } },
          { saleReturn: { saleId: { in: validSaleIds } } },
          { id: { in: financialEntryIds.filter((id): id is string => Boolean(id)) } },
        ],
      },
      select: { id: true },
    });
    financialEntryIds.push(...saleEntries.map((entry) => entry.id));
    const validFinancialEntryIds = [
      ...new Set(financialEntryIds.filter((id): id is string => Boolean(id))),
    ];
    await prisma.financialPayment.deleteMany({
      where: { entryId: { in: validFinancialEntryIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { aggregateId: { in: validFinancialEntryIds } },
    });
    await prisma.financialEntry.deleteMany({
      where: { id: { in: validFinancialEntryIds } },
    });
    await prisma.saleReturnItem.deleteMany({
      where: {
        OR: [
          { saleReturn: { saleId: { in: validSaleIds } } },
          { returnId: { in: validReturnIds } },
          { productLotId: { in: lotIds } },
        ],
      },
    });
    await prisma.saleReturn.deleteMany({
      where: {
        OR: [
          { saleId: { in: validSaleIds } },
          { id: { in: validReturnIds } },
        ],
      },
    });
    await prisma.saleItem.deleteMany({
      where: {
        OR: [
          { saleId: { in: validSaleIds } },
          { productLotId: { in: lotIds } },
        ],
      },
    });
    await prisma.sale.updateMany({
      where: { quoteId: { in: validQuoteIds } },
      data: { quoteId: null },
    });
    await prisma.sale.deleteMany({
      where: {
        OR: [
          { id: { in: validSaleIds } },
          { priceListId: { in: priceListIds } },
        ],
      },
    });
    await prisma.salesQuoteItem.deleteMany({
      where: {
        OR: [
          { quoteId: { in: validQuoteIds } },
          { productLotId: { in: lotIds } },
        ],
      },
    });
    await prisma.salesQuote.deleteMany({
      where: {
        OR: [
          { id: { in: validQuoteIds } },
          { priceListId: { in: priceListIds } },
        ],
      },
    });
    await prisma.serviceOrderItem.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.productPromotion.deleteMany({
      where: { id: { in: promotionIds } },
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
          { aggregateId: { in: validSaleIds } },
          { aggregateId: { in: validQuoteIds } },
          {
            aggregateId: {
              in: orderIds.filter((id): id is string => Boolean(id)),
            },
          },
          { aggregateId: { in: validFinancialEntryIds } },
          { aggregateId: { in: validReturnIds } },
          {
            aggregateId: {
              in: priceListIds.filter((id): id is string => Boolean(id)),
            },
          },
          {
            aggregateId: {
              in: promotionIds.filter((id): id is string => Boolean(id)),
            },
          },
          {
            aggregateId: {
              in: customerIds.filter((id): id is string => Boolean(id)),
            },
          },
          {
            aggregateId: {
              in: blasterIds.filter((id): id is string => Boolean(id)),
            },
          },
          {
            aggregateId: {
              in: productIds.filter((id): id is string => Boolean(id)),
            },
          },
          {
            aggregateId: {
              in: lotIds.filter((id): id is string => Boolean(id)),
            },
          },
        ],
      },
    });
    await prisma.productLot.deleteMany({ where: { id: { in: lotIds } } });
    await prisma.magazine.deleteMany({ where: { id: { in: magazineIds } } });
    await prisma.priceListItem.deleteMany({
      where: { priceListId: { in: priceListIds } },
    });
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
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
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
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(201);
    saleIds.push(response.body.id as string);
    expect(response.body.total).toBe('25');
    expect(response.body.items[0].unitPrice).toBe('12.5');
    expect(response.body.items[0].subtotal).toBe('25');
    expect(response.body.financialEntry).toMatchObject({
      direction: 'RECEBER',
      amount: '25',
      status: 'PAGO',
      saleId: response.body.id,
    });
    expect(response.body.financialEntry.payments).toHaveLength(1);
    expect(response.body.financialEntry.payments[0].method).toBe('DINHEIRO');

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
        dueDate: '2099-12-31',
        items: [{ saleItemId, quantity: 1 }],
      })
      .expect(201);
    expect(returned.body.items[0].quantity).toBe('1');
    expect(returned.body.items[0].subtotal).toBe('12.5');
    expect(returned.body.creditApplied).toBe('0');
    expect(returned.body.refundAmount).toBe('12.5');
    expect(returned.body.refundEntry).toMatchObject({
      direction: 'PAGAR',
      amount: '12.5',
      status: 'ABERTO',
      dueDate: '2099-12-31T00:00:00.000Z',
    });

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

  it('reports gross sales and returns by product and customer', async () => {
    const productA = await createProduct('REPORT-A', false);
    const productB = await createProduct('REPORT-B', false);
    const lotA = await createLot(
      productA.body.id as string,
      `REPORT-A-${suffix}`,
      10,
    );
    const lotB = await createLot(
      productB.body.id as string,
      `REPORT-B-${suffix}`,
      10,
    );
    const list = await request(app.getHttpServer())
      .post('/api/v1/pricing/lists')
      .send({
        name: `Tabela relatório ${suffix}`,
        items: [
          { productId: productA.body.id, unitPrice: 10 },
          { productId: productB.body.id, unitPrice: 20 },
        ],
      })
      .expect(201);
    priceListIds.push(list.body.id as string);
    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente relatório ${suffix}`,
        taxId: makeValidCnpj(),
      })
      .expect(201);
    customerIds.push(customer.body.id as string);

    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const baseline = await request(app.getHttpServer())
      .get(`/api/v1/sales/reports/summary?from=${today}&to=${tomorrow}`)
      .expect(200);
    const customerSale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        customerId: customer.body.id,
        priceListId: list.body.id,
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
        items: [
          { productLotId: lotA.body.id, quantity: 2 },
          { productLotId: lotB.body.id, quantity: 1 },
        ],
      })
      .expect(201);
    saleIds.push(customerSale.body.id as string);
    const walkInSale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.body.id,
        condition: 'IMEDIATO',
        paymentMethod: 'PIX',
        items: [{ productLotId: lotA.body.id, quantity: 1 }],
      })
      .expect(201);
    saleIds.push(walkInSale.body.id as string);
    await prisma.sale.update({
      where: { id: customerSale.body.id },
      data: { createdAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    const returned = await request(app.getHttpServer())
      .post(`/api/v1/sales/${customerSale.body.id}/returns`)
      .send({
        reason: 'Devolução usada no relatório de vendas.',
        dueDate: '2099-12-31',
        items: [{ saleItemId: customerSale.body.items[0].id, quantity: 1 }],
      })
      .expect(201);
    saleReturnIds.push(returned.body.id as string);

    const report = await request(app.getHttpServer())
      .get(`/api/v1/sales/reports/summary?from=${today}&to=${tomorrow}`)
      .expect(200);
    expect(report.body.basis).toEqual({
      sales: 'data de finalização da venda',
      returns: 'data de registro da devolução',
    });
    expect(report.body.totals).toEqual({
      salesCount: baseline.body.totals.salesCount + 1,
      returnsCount: baseline.body.totals.returnsCount + 1,
      grossSales: String(Number(baseline.body.totals.grossSales) + 10),
      returned: String(Number(baseline.body.totals.returned) + 10),
      netSales: String(Number(baseline.body.totals.netSales)),
    });
    const productReport = report.body.byProduct.find(
      (item: { productId: string }) => item.productId === productA.body.id,
    );
    expect(productReport).toMatchObject({
      soldQuantity: '1',
      returnedQuantity: '1',
      netQuantity: '0',
      grossSales: '10',
      returned: '10',
      netSales: '0',
    });
    const customerReport = report.body.byCustomer.find(
      (item: { customerId: string }) => item.customerId === customer.body.id,
    );
    expect(customerReport).toMatchObject({
      salesCount: 0,
      returnsCount: 1,
      grossSales: '0',
      returned: '10',
      netSales: '-10',
    });
    const baselineWalkIn = baseline.body.byCustomer.find(
      (item: { customerId: string | null }) => item.customerId === null,
    );
    const expectedWalkInGross = String(
      Number(baselineWalkIn?.grossSales ?? 0) + 10,
    );
    expect(
      report.body.byCustomer.some(
        (item: { customerId: string | null; grossSales: string }) =>
          item.customerId === null && item.grossSales === expectedWalkInGross,
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .get(`/api/v1/sales/reports/summary?from=${tomorrow}&to=${today}`)
      .expect(400);
  });

  it('applies fixed product promotions and preserves quoted promotional prices', async () => {
    const product = await createProduct('PROMO', false);
    const lot = await createLot(
      product.body.id as string,
      `PROMO-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 20);
    const today = new Date().toISOString().slice(0, 10);
    const promotion = await request(app.getHttpServer())
      .post('/api/v1/pricing/promotions')
      .send({
        name: `Promoção sazonal ${suffix}`,
        effectiveFrom: today,
        effectiveUntil: '2099-12-31',
        items: [{ productId: product.body.id, promotionalPrice: 12 }],
      })
      .expect(201);
    promotionIds.push(promotion.body.id as string);

    const sale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        condition: 'IMEDIATO',
        paymentMethod: 'PIX',
        items: [{ productLotId: lot.body.id, quantity: 1 }],
      })
      .expect(201);
    saleIds.push(sale.body.id as string);
    expect(sale.body.items[0].unitPrice).toBe('12');
    expect(sale.body.total).toBe('12');

    const quote = await createSalesQuote(list.id, lot.body.id as string, 1);
    salesQuoteIds.push(quote.body.id as string);
    expect(quote.body.items[0].unitPrice).toBe('12');
    expect(quote.body.total).toBe('12');

    await request(app.getHttpServer())
      .patch(`/api/v1/pricing/promotions/${promotion.body.id}`)
      .send({ active: false })
      .expect(200);
    const regularPriceSale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        condition: 'IMEDIATO',
        paymentMethod: 'PIX',
        items: [{ productLotId: lot.body.id, quantity: 1 }],
      })
      .expect(201);
    saleIds.push(regularPriceSale.body.id as string);
    expect(regularPriceSale.body.items[0].unitPrice).toBe('20');

    const secondPromotion = await request(app.getHttpServer())
      .post('/api/v1/pricing/promotions')
      .send({
        name: `Promoção alternativa ${suffix}`,
        effectiveFrom: today,
        effectiveUntil: '2099-12-31',
        items: [{ productId: product.body.id, promotionalPrice: 30 }],
      })
      .expect(201);
    promotionIds.push(secondPromotion.body.id as string);
    await request(app.getHttpServer())
      .get(
        `/api/v1/pricing/promotions?active=true&productId=${product.body.id}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(secondPromotion.body.id);
      });
    const higherPromotionSale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        condition: 'IMEDIATO',
        paymentMethod: 'PIX',
        items: [{ productLotId: lot.body.id, quantity: 1 }],
      })
      .expect(201);
    saleIds.push(higherPromotionSale.body.id as string);
    expect(higherPromotionSale.body.items[0].unitPrice).toBe('20');
    await request(app.getHttpServer())
      .patch(`/api/v1/pricing/promotions/${promotion.body.id}`)
      .send({ active: true })
      .expect(409);

    const converted = await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quote.body.id}/convert`)
      .send({ condition: 'IMEDIATO', paymentMethod: 'PIX' })
      .expect(201);
    saleIds.push(converted.body.sale.id as string);
    expect(converted.body.sale.items[0].unitPrice).toBe('12');
    expect(converted.body.sale.total).toBe('12');
  });

  it('serializes overlapping promotion creation for the same product', async () => {
    const product = await createProduct('PRACE', false);
    const today = new Date().toISOString().slice(0, 10);
    const attempts = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/pricing/promotions')
        .send({
          name: `Promoção concorrente A ${suffix}`,
          effectiveFrom: today,
          effectiveUntil: '2099-12-31',
          items: [{ productId: product.body.id, promotionalPrice: 9 }],
        }),
      request(app.getHttpServer())
        .post('/api/v1/pricing/promotions')
        .send({
          name: `Promoção concorrente B ${suffix}`,
          effectiveFrom: today,
          effectiveUntil: '2099-12-31',
          items: [{ productId: product.body.id, promotionalPrice: 8 }],
        }),
    ]);
    for (const attempt of attempts) {
      if (attempt.status === 201) {
        promotionIds.push(attempt.body.id as string);
      }
    }
    expect(
      attempts
        .map((attempt) => attempt.status)
        .sort((first, second) => first - second),
    ).toEqual([201, 409]);
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
          condition: 'IMEDIATO',
          paymentMethod: 'PIX',
          items: [{ productLotId: lot.body.id, quantity: 6 }],
        }),
      request(app.getHttpServer())
        .post('/api/v1/sales')
        .send({
          priceListId: list.id,
          condition: 'IMEDIATO',
          paymentMethod: 'PIX',
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

  it('creates an open receivable for credit sales and requires a customer', async () => {
    const product = await createProduct('CREDIT', false);
    const lot = await createLot(
      product.body.id as string,
      `CREDIT-${suffix}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 15);
    const walkInCredit = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        condition: 'PRAZO',
        dueDate: '2099-12-31',
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(400);
    expect(walkInCredit.body.message).toContain('cliente cadastrado');

    const customer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send({
        legalName: `Cliente venda a prazo ${suffix}`,
        taxId: makeValidCnpj(),
      })
      .expect(201);
    customerIds.push(customer.body.id as string);

    const sale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        customerId: customer.body.id,
        priceListId: list.id,
        condition: 'PRAZO',
        dueDate: '2099-12-31',
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(201);
    saleIds.push(sale.body.id as string);
    expect(sale.body.financialEntry).toMatchObject({
      direction: 'RECEBER',
      amount: '30',
      status: 'ABERTO',
      customerId: customer.body.id,
      saleId: sale.body.id,
      dueDate: '2099-12-31T00:00:00.000Z',
      payments: [],
    });
    const financeEntry = await request(app.getHttpServer())
      .get(`/api/v1/finance/entries/${sale.body.financialEntry.id}`)
      .expect(200);
    expect(financeEntry.body).toMatchObject({
      paid: '0',
      outstanding: '30',
      creditedAmount: '0',
      status: 'ABERTO',
    });
    expect(financeEntry.body.sale).toMatchObject({
      id: sale.body.id,
      code: sale.body.code,
    });
    const saleItemId = sale.body.items[0].id as string;
    const partialReturn = await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.body.id}/returns`)
      .send({
        reason: 'Crédito aplicado ao saldo a prazo.',
        items: [{ saleItemId, quantity: 1 }],
      })
      .expect(201);
    expect(partialReturn.body).toMatchObject({
      creditApplied: '15',
      refundAmount: '0',
      refundEntry: null,
    });
    const partiallyCredited = await request(app.getHttpServer())
      .get(`/api/v1/finance/entries/${sale.body.financialEntry.id}`)
      .expect(200);
    expect(partiallyCredited.body).toMatchObject({
      creditedAmount: '15',
      outstanding: '15',
      status: 'PARCIAL',
    });

    const fullReturn = await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.body.id}/returns`)
      .send({
        reason: 'Crédito total do saldo restante.',
        items: [{ saleItemId, quantity: 1 }],
      })
      .expect(201);
    expect(fullReturn.body).toMatchObject({
      creditApplied: '15',
      refundAmount: '0',
    });
    const fullyCredited = await request(app.getHttpServer())
      .get(`/api/v1/finance/entries/${sale.body.financialEntry.id}`)
      .expect(200);
    expect(fullyCredited.body).toMatchObject({
      creditedAmount: '30',
      outstanding: '0',
      status: 'COMPENSADO',
    });

    const splitSale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        customerId: customer.body.id,
        priceListId: list.id,
        condition: 'PRAZO',
        dueDate: '2099-12-31',
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(201);
    saleIds.push(splitSale.body.id as string);
    await request(app.getHttpServer())
      .post(
        `/api/v1/finance/entries/${splitSale.body.financialEntry.id}/payments`,
      )
      .send({ amount: 20, method: 'PIX' })
      .expect(201);
    const splitSaleItemId = splitSale.body.items[0].id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/sales/${splitSale.body.id}/returns`)
      .send({
        reason: 'Sem vencimento de reembolso.',
        items: [{ saleItemId: splitSaleItemId, quantity: 1 }],
      })
      .expect(400);
    const splitReturn = await request(app.getHttpServer())
      .post(`/api/v1/sales/${splitSale.body.id}/returns`)
      .send({
        reason: 'Aplicação parcial e reembolso do excedente.',
        dueDate: '2099-12-31',
        items: [{ saleItemId: splitSaleItemId, quantity: 1 }],
      })
      .expect(201);
    expect(splitReturn.body).toMatchObject({
      creditApplied: '10',
      refundAmount: '5',
      refundEntry: {
        direction: 'PAGAR',
        amount: '5',
        status: 'ABERTO',
      },
    });
    const splitReceivable = await request(app.getHttpServer())
      .get(`/api/v1/finance/entries/${splitSale.body.financialEntry.id}`)
      .expect(200);
    expect(splitReceivable.body).toMatchObject({
      paid: '20',
      creditedAmount: '10',
      outstanding: '0',
      status: 'PAGO',
    });
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
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
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
        condition: 'IMEDIATO',
        paymentMethod: 'PIX',
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
      .send({ condition: 'IMEDIATO', paymentMethod: 'PIX' })
      .expect(201);
    saleIds.push(converted.body.sale.id as string);
    expect(converted.body.quote.status).toBe('CONVERTIDO');
    expect(converted.body.sale.quoteId).toBe(quote.body.id);
    expect(converted.body.sale.total).toBe('29');
    expect(converted.body.sale.items[0].unitPrice).toBe('7.25');
    expect(converted.body.sale.financialEntry.status).toBe('PAGO');

    await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quote.body.id}/convert`)
      .send({ condition: 'IMEDIATO', paymentMethod: 'PIX' })
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
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
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
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
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
      .send({ condition: 'IMEDIATO', paymentMethod: 'PIX' })
      .expect(409);
    expect(
      await prisma.sale.count({ where: { quoteId: quote.body.id as string } }),
    ).toBe(0);
  });

  it('updates sales quote items, recalculating reservations and rejecting when converted or expired', async () => {
    const product = await createProduct('QUPD', false);
    const lot = await createLot(
      product.body.id as string,
      `QUPD-${suffix.slice(0, 8)}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 100);

    // Cria orçamento de 6 unidades
    const quote = await createSalesQuote(list.id, lot.body.id as string, 6);
    salesQuoteIds.push(quote.body.id as string);
    expect(quote.body.total).toBe('600');

    // Atualiza orçamento para 8 unidades (sucesso: 8 <= 10, não compete contra si mesmo)
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/commercial/sales/quotes/${quote.body.id}`)
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 8 }],
      })
      .expect(200);
    expect(updated.body.total).toBe('800');
    expect(updated.body.items[0].quantity).toBe('8');

    // Tenta atualizar para 11 unidades (excede 10 disponíveis) -> 409
    await request(app.getHttpServer())
      .put(`/api/v1/commercial/sales/quotes/${quote.body.id}`)
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 11 }],
      })
      .expect(409);

    // Converte orçamento
    const sale = await request(app.getHttpServer())
      .post(`/api/v1/sales/quotes/${quote.body.id}/convert`)
      .send({ condition: 'IMEDIATO', paymentMethod: 'DINHEIRO' })
      .expect(201);
    saleIds.push(sale.body.id as string);

    // Tentativa de editar orçamento já convertido -> 409
    await request(app.getHttpServer())
      .put(`/api/v1/commercial/sales/quotes/${quote.body.id}`)
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(409);
  });

  it('rejects editing a sales quote that has already expired', async () => {
    const product = await createProduct('QEXP', false);
    const lot = await createLot(
      product.body.id as string,
      `QEXP-${suffix.slice(0, 8)}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 100);

    const quote = await createSalesQuote(list.id, lot.body.id as string, 4);
    salesQuoteIds.push(quote.body.id as string);

    await prisma.salesQuote.update({
      where: { id: quote.body.id as string },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .put(`/api/v1/commercial/sales/quotes/${quote.body.id}`)
      .send({
        priceListId: list.id,
        items: [{ productLotId: lot.body.id, quantity: 2 }],
      })
      .expect(409);
  });

  it('sends sales quote dispatching notification and logging audit', async () => {
    const product = await createProduct('QSEND', false);
    const lot = await createLot(
      product.body.id as string,
      `QSEND-${suffix.slice(0, 8)}`,
      5,
    );
    const list = await createPriceList(product.body.id as string, 80);

    const quote = await createSalesQuote(list.id, lot.body.id as string, 2);
    salesQuoteIds.push(quote.body.id as string);

    // Tenta enviar sem e-mail -> 400
    await request(app.getHttpServer())
      .post(`/api/v1/commercial/sales/quotes/${quote.body.id}/send`)
      .send({})
      .expect(400);

    // Envia com e-mail válido -> 201
    const sendResponse = await request(app.getHttpServer())
      .post(`/api/v1/commercial/sales/quotes/${quote.body.id}/send`)
      .send({ recipientEmail: 'cliente.teste@pirotecnia.com.br' })
      .expect(201);
    expect(sendResponse.body.success).toBe(true);
    expect(sendResponse.body.recipientEmail).toBe(
      'cliente.teste@pirotecnia.com.br',
    );

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'sales-quote.sent',
        aggregateId: quote.body.id as string,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('applies percentage-based promotional discount and enforces clear precedence (lowest effective price)', async () => {
    const productA = await createProduct('PPERC', false);
    const lotA = await createLot(
      productA.body.id as string,
      `PPERC-${suffix.slice(0, 8)}`,
      10,
    );
    const productB = await createProduct('PFIX', false);
    const lotB = await createLot(
      productB.body.id as string,
      `PFIX-${suffix.slice(0, 8)}`,
      10,
    );

    // Tabela: Produto A = 100, Produto B = 50
    const listResponse = await request(app.getHttpServer())
      .post('/api/v1/pricing/lists')
      .send({
        name: `Tabela Promocao ${suffix}`,
        items: [
          { productId: productA.body.id, unitPrice: 100 },
          { productId: productB.body.id, unitPrice: 50 },
        ],
      })
      .expect(201);
    priceListIds.push(listResponse.body.id as string);

    // Promoção:
    // Produto A: desconto percentual de 20% -> preço esperado 80
    // Produto B: preço fixo promocional de 60 -> como tabela é 50, prevalece menor preço: 50
    const promoResponse = await request(app.getHttpServer())
      .post('/api/v1/pricing/promotions')
      .send({
        name: `Promoção Black Week ${suffix}`,
        effectiveFrom: '2026-01-01',
        effectiveUntil: '2099-12-31',
        items: [
          {
            productId: productA.body.id,
            discountType: 'PERCENTUAL',
            discountPercent: 20,
          },
          {
            productId: productB.body.id,
            discountType: 'PRECO_FIXO',
            promotionalPrice: 60,
          },
        ],
      })
      .expect(201);
    promotionIds.push(promoResponse.body.id as string);

    const quote = await request(app.getHttpServer())
      .post('/api/v1/sales/quotes')
      .send({
        priceListId: listResponse.body.id,
        items: [
          { productLotId: lotA.body.id, quantity: 2 },
          { productLotId: lotB.body.id, quantity: 1 },
        ],
      })
      .expect(201);
    salesQuoteIds.push(quote.body.id as string);

    // 2 * 80 + 1 * 50 = 210
    expect(quote.body.total).toBe('210');
    const itemA = quote.body.items.find(
      (i: { productId: string }) => i.productId === productA.body.id,
    );
    const itemB = quote.body.items.find(
      (i: { productId: string }) => i.productId === productB.body.id,
    );
    expect(itemA.unitPrice).toBe('80');
    expect(itemB.unitPrice).toBe('50');
  });

  it('handles legacy sale return without financial entry gracefully and idempotently', async () => {
    const product = await createProduct('RLEG', false);
    const lot = await createLot(
      product.body.id as string,
      `RLEG-${suffix.slice(0, 8)}`,
      10,
    );
    const list = await createPriceList(product.body.id as string, 50);

    // Cria venda balcão
    const sale = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .send({
        priceListId: list.id,
        condition: 'IMEDIATO',
        paymentMethod: 'DINHEIRO',
        items: [{ productLotId: lot.body.id, quantity: 4 }],
      })
      .expect(201);
    saleIds.push(sale.body.id as string);

    // Simula venda legada sem financialEntry
    const entry = await prisma.financialEntry.findUnique({
      where: { saleId: sale.body.id as string },
    });
    if (entry) {
      await prisma.financialPayment.deleteMany({
        where: { entryId: entry.id },
      });
      await prisma.financialEntry.delete({
        where: { id: entry.id },
      });
    }

    // Devolução parcial (2 itens) sem dueDate (venda legada sem financeiro: aceita sem gerar conta a pagar)
    const returnResponse = await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.body.id}/returns`)
      .send({
        reason: 'Devolução legada balcão sem financeiro',
        items: [{ saleItemId: sale.body.items[0].id, quantity: 2 }],
      })
      .expect(201);
    saleReturnIds.push(returnResponse.body.id as string);
    expect(returnResponse.body.refundAmount).toBe('0');
    expect(returnResponse.body.items[0].quantity).toBe('2');

    // Lote recuperou 2 unidades (10 - 4 = 6; agora 6 + 2 = 8)
    const lotCheck = await prisma.productLot.findUnique({
      where: { id: lot.body.id as string },
    });
    expect(lotCheck?.quantity.toString()).toBe('8');

    // Tentativa de devolver mais 3 itens (só restam 2): falha com 409
    await request(app.getHttpServer())
      .post(`/api/v1/sales/${sale.body.id}/returns`)
      .send({
        reason: 'Tentativa de devolver a mais',
        items: [{ saleItemId: sale.body.items[0].id, quantity: 3 }],
      })
      .expect(409);
  });

  it('generates quotes conversion report with accurate metrics', async () => {
    const report = await request(app.getHttpServer())
      .get(
        '/api/v1/commercial/reports/quotes-conversion?from=2026-01-01&to=2026-12-31',
      )
      .expect(200);

    expect(report.body.period).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
    const totals = report.body.totals;
    expect(totals.quotesCount).toBeGreaterThanOrEqual(1);
    expect(totals.conversionRatePercent).toBeDefined();
    expect(Number(totals.conversionRatePercent)).toBeGreaterThanOrEqual(0);

    // conversionRatePercent precisa ser exatamente (convertidos/total)*100,
    // arredondado a 2 casas — confere a conta, não só o sinal.
    const expectedRate =
      Math.round((totals.convertedCount / totals.quotesCount) * 100 * 100) /
      100;
    expect(Number(totals.conversionRatePercent)).toBeCloseTo(expectedRate, 2);

    // averageTicket precisa ser exatamente convertedAmount/convertedCount
    // (ou zero sem conversões) — confere a relação entre os três campos.
    if (totals.convertedCount > 0) {
      const expectedAverageTicket =
        Number(totals.convertedAmount) / totals.convertedCount;
      expect(Number(totals.averageTicket)).toBeCloseTo(
        expectedAverageTicket,
        2,
      );
    } else {
      expect(Number(totals.averageTicket)).toBe(0);
    }
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
