import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Procurement API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const supplierIds: string[] = [];
  const productIds: string[] = [];
  const magazineIds: string[] = [];
  const purchaseIds: string[] = [];
  const lotIds: string[] = [];

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
    const receiptBatches = await prisma.purchaseReceiptBatch.findMany({
      where: { purchaseId: { in: purchaseIds } },
      select: { id: true },
    });
    const receiptBatchIds = receiptBatches.map((batch) => batch.id);
    await prisma.financialEntry.deleteMany({
      where: { receiptBatchId: { in: receiptBatchIds } },
    });
    await prisma.purchaseReceipt.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.purchaseReceiptBatch.deleteMany({
      where: { id: { in: receiptBatchIds } },
    });
    await prisma.purchase.deleteMany({
      where: { id: { in: purchaseIds } },
    });
    await prisma.stockMovement.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { aggregateId: { in: purchaseIds } },
          { aggregateId: { in: supplierIds } },
          { aggregateId: { in: lotIds } },
        ],
      },
    });
    await prisma.productLot.deleteMany({ where: { id: { in: lotIds } } });
    await prisma.magazine.deleteMany({ where: { id: { in: magazineIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } });
    await app.close();
  });

  it('supports partial receipts, creates traceable lots, and prevents receiving above the order', async () => {
    const supplier = await createSupplier(`Fornecedor ${suffix}`);
    const product = await createProduct(false);
    const purchase = await createPurchase(supplier.body.id, product.body.id);

    expect(purchase.body.status).toBe('PENDENTE');
    const itemId = purchase.body.items[0].id as string;
    const magazine = await createMagazine(`Paiol compra ${suffix}`, 10);

    const partial = await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchase.body.id}/receive`)
      .send({
        dueDate: '2026-11-15',
        invoiceReference: `NF-PART-${suffix}`,
        items: [
          {
            purchaseItemId: itemId,
            magazineId: magazine.body.id,
            lotNumber: `PART-${suffix.slice(0, 30)}`,
            quantity: 4,
            manufacturedAt: '2026-01-01',
            expiresAt: '2099-12-31',
            manufacturerOrImporter: 'Fornecedor teste',
          },
        ],
      })
      .expect(201);
    expect(partial.body.status).toBe('PARCIAL');
    expect(partial.body.receivedLots).toHaveLength(1);
    expect(partial.body.financialEntry.amount).toBe('21');
    expect(partial.body.financialEntry.dueDate).toContain('2026-11-15');
    expect(partial.body.financialEntry.reference).toBe(`NF-PART-${suffix}`);
    expect(partial.body.financialEntry.counterparty).toBe(
      supplier.body.legalName,
    );
    const firstPayableId = partial.body.financialEntry.id as string;
    lotIds.push(partial.body.receivedLots[0].lot.id as string);

    const received = await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchase.body.id}/receive`)
      .send({
        dueDate: '2026-12-15',
        invoiceReference: `NF-FINAL-${suffix}`,
        items: [
          {
            purchaseItemId: itemId,
            magazineId: magazine.body.id,
            lotNumber: `FINAL-${suffix.slice(0, 30)}`,
            quantity: 6,
            manufacturedAt: '2026-01-01',
            expiresAt: '2099-12-31',
            manufacturerOrImporter: 'Fornecedor teste',
          },
        ],
      })
      .expect(201);
    expect(received.body.status).toBe('RECEBIDO');
    expect(received.body.receivedLots).toHaveLength(1);
    expect(received.body.financialEntry.amount).toBe('31.5');
    expect(received.body.financialEntry.id).not.toBe(firstPayableId);
    expect(received.body.financialEntry.supplierId).toBe(supplier.body.id);
    expect(received.body.financialEntry.dueDate).toContain('2026-12-15');
    expect(received.body.financialEntry.reference).toBe(`NF-FINAL-${suffix}`);
    const payableDetails = await request(app.getHttpServer())
      .get(`/api/v1/finance/entries/${received.body.financialEntry.id}`)
      .expect(200);
    expect(payableDetails.body.supplier.legalName).toBe(
      supplier.body.legalName,
    );
    expect(payableDetails.body.receiptBatch.invoiceReference).toBe(
      `NF-FINAL-${suffix}`,
    );
    expect(payableDetails.body.receiptBatch.purchase.id).toBe(
      purchase.body.id,
    );
    const lotId = received.body.receivedLots[0].lot.id as string;
    lotIds.push(lotId);
    expect(received.body.items[0].receipts).toHaveLength(2);
    expect(received.body.receivedLots[0].movement.reference).toMatch(
      /^COMPRA-/,
    );

    const stock = await request(app.getHttpServer())
      .get(`/api/v1/inventory/lots/${lotId}`)
      .expect(200);
    expect(stock.body.quantity).toBe('6');

    const movements = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?productLotId=${lotId}&type=ENTRADA`)
      .expect(200);
    expect(movements.body.data).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchase.body.id}/receive`)
      .send({
        dueDate: '2026-12-15',
        invoiceReference: `NF-EXTRA-${suffix}`,
        items: [
          {
            purchaseItemId: itemId,
            magazineId: magazine.body.id,
            lotNumber: `DUP-${suffix.slice(0, 30)}`,
            quantity: 1,
            manufacturedAt: '2026-01-01',
            expiresAt: '2099-12-31',
            manufacturerOrImporter: 'Fornecedor teste',
          },
        ],
      })
      .expect(409);

    expect(
      await prisma.financialEntry.count({
        where: { receiptBatch: { purchaseId: purchase.body.id } },
      }),
    ).toBe(2);

    const list = await request(app.getHttpServer())
      .get('/api/v1/purchases?status=RECEBIDO')
      .expect(200);
    expect(
      list.body.data.some(
        (item: { id: string }) => item.id === purchase.body.id,
      ),
    ).toBe(true);
  });

  it('blocks PCE purchases from a supplier without valid CR authorization', async () => {
    const supplier = await createSupplier(`Fornecedor sem CR ${suffix}`);
    const product = await createProduct(true);
    const purchase = await createPurchase(supplier.body.id, product.body.id);
    const magazine = await createMagazine(`Paiol PCE compra ${suffix}`, 5);

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchase.body.id}/receive`)
      .send({
        dueDate: '2026-11-30',
        invoiceReference: `NF-PCE-${suffix}`,
        items: [
          {
            purchaseItemId: purchase.body.items[0].id,
            magazineId: magazine.body.id,
            lotNumber: `PCE-${suffix.slice(0, 30)}`,
            quantity: 10,
            manufacturedAt: '2026-01-01',
            expiresAt: '2099-12-31',
            manufacturerOrImporter: 'Fornecedor teste',
          },
        ],
      })
      .expect(409);

    const current = await request(app.getHttpServer())
      .get(`/api/v1/purchases/${purchase.body.id}`)
      .expect(200);
    expect(current.body.status).toBe('PENDENTE');
    expect(current.body.items[0].receipts).toHaveLength(0);
    expect(
      await prisma.purchaseReceiptBatch.count({
        where: { purchaseId: purchase.body.id },
      }),
    ).toBe(0);
    expect(
      await prisma.financialEntry.count({
        where: { receiptBatch: { purchaseId: purchase.body.id } },
      }),
    ).toBe(0);

    await request(app.getHttpServer())
      .patch(`/api/v1/suppliers/${supplier.body.id}`)
      .send({
        hasCr: true,
        crNumber: `CR-${suffix}`,
        crExpiresAt: '2099-12-31',
        authorizedPceClasses: ['1.3G'],
      })
      .expect(200);

    const authorizedReceipt = await request(app.getHttpServer())
      .post(`/api/v1/purchases/${purchase.body.id}/receive`)
      .send({
        dueDate: '2026-11-30',
        invoiceReference: `NF-PCE-OK-${suffix}`,
        items: [
          {
            purchaseItemId: purchase.body.items[0].id,
            magazineId: magazine.body.id,
            lotNumber: `PCE-OK-${suffix.slice(0, 30)}`,
            quantity: 10,
            manufacturedAt: '2026-01-01',
            expiresAt: '2099-12-31',
            manufacturerOrImporter: 'Fornecedor autorizado teste',
          },
        ],
      })
      .expect(201);
    lotIds.push(authorizedReceipt.body.receivedLots[0].lot.id as string);
    expect(authorizedReceipt.body.status).toBe('RECEBIDO');
  });

  it('serializes concurrent partial receipts against remaining ordered quantity', async () => {
    const supplier = await createSupplier(`Fornecedor concorrente ${suffix}`);
    const product = await createProduct(false);
    const purchase = await createPurchase(supplier.body.id, product.body.id);
    const magazine = await createMagazine(`Paiol concorrente ${suffix}`, 1);
    const itemId = purchase.body.items[0].id as string;
    const receipts = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/purchases/${purchase.body.id}/receive`)
        .send({
          dueDate: '2026-11-30',
          invoiceReference: `NF-RACE-A-${suffix}`,
          items: [
            {
              purchaseItemId: itemId,
              magazineId: magazine.body.id,
              lotNumber: `RACE-A-${suffix.slice(0, 25)}`,
              quantity: 6,
              manufacturedAt: '2026-01-01',
              expiresAt: '2099-12-31',
              manufacturerOrImporter: 'Fornecedor teste',
            },
          ],
        }),
      request(app.getHttpServer())
        .post(`/api/v1/purchases/${purchase.body.id}/receive`)
        .send({
          dueDate: '2026-11-30',
          invoiceReference: `NF-RACE-B-${suffix}`,
          items: [
            {
              purchaseItemId: itemId,
              magazineId: magazine.body.id,
              lotNumber: `RACE-B-${suffix.slice(0, 25)}`,
              quantity: 6,
              manufacturedAt: '2026-01-01',
              expiresAt: '2099-12-31',
              manufacturerOrImporter: 'Fornecedor teste',
            },
          ],
        }),
    ]);
    const successful = receipts.find((response) => response.status === 201);
    expect(successful).toBeDefined();
    expect(successful!.body.status).toBe('PARCIAL');
    lotIds.push(successful!.body.receivedLots[0].lot.id as string);
    expect(
      receipts
        .map((response) => response.status)
        .sort((first, second) => first - second),
    ).toEqual([201, 409]);

    const current = await request(app.getHttpServer())
      .get(`/api/v1/purchases/${purchase.body.id}`)
      .expect(200);
    expect(current.body.items[0].receipts).toHaveLength(1);
    expect(current.body.items[0].receipts[0].quantity).toBe('6');
  });

  async function createSupplier(name: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .send({ legalName: name, taxId: makeValidCnpj() })
      .expect(201);
    supplierIds.push(response.body.id as string);
    return response;
  }

  async function createProduct(isPce: boolean) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `PURCHASE-${isPce ? 'PCE' : 'STD'}-${randomUUID()}`,
        name: `Produto compra ${suffix}`,
        type: 'MERCADORIA',
        isPce,
        ...(isPce ? { riskClass: '1.3G', neqGrams: 100 } : {}),
        unit: 'UN',
      })
      .expect(201);
    productIds.push(response.body.id as string);
    return response;
  }

  async function createPurchase(supplierId: string, productId: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/purchases')
      .send({
        supplierId,
        reference: `PEDIDO-${suffix}`,
        items: [{ productId, orderedQuantity: 10, unitCost: 5.25 }],
      })
      .expect(201);
    purchaseIds.push(response.body.id as string);
    return response;
  }

  async function createMagazine(name: string, capacity: number) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name,
        maxNeqCapacityKg: capacity,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(response.body.id as string);
    return response;
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

function checkDigit(digits: number[], weights: number[]): number {
  const remainder =
    digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
