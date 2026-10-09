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

describe('Inventory API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const productIds: string[] = [];
  const magazineIds: string[] = [];
  const lotIds: string[] = [];
  const customerIds: string[] = [];
  const priceListIds: string[] = [];
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
    await prisma.salesQuote.deleteMany({
      where: { id: { in: salesQuoteIds } },
    });
    await prisma.serviceOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.stockMovement.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { aggregateId: { in: productIds } },
          { aggregateId: { in: magazineIds } },
          { aggregateId: { in: lotIds } },
          { aggregateId: { in: customerIds } },
          { aggregateId: { in: priceListIds } },
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
    await app.close();
  });

  it('enforces lot traceability, NEQ capacity, stock balances, and transfer atomicity', async () => {
    const invalidProduct = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `PCE-${suffix}`,
        name: 'PCE sem NEQ',
        type: 'MERCADORIA',
        isPce: true,
        riskClass: '1.3G',
        unit: 'UN',
      })
      .expect(400);
    expect(invalidProduct.body.message).toBeDefined();

    const productResponse = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `PCE-${suffix}`,
        name: 'Produto de teste de estoque',
        type: 'MERCADORIA',
        isPce: true,
        riskClass: '1.3G',
        neqGrams: 100,
        unit: 'UN',
      })
      .expect(201);
    const productId = productResponse.body.id as string;
    productIds.push(productId);

    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'e2e-admin@local.test' },
      select: { id: true },
    });
    const productAudit = await prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'inventory.product.created',
        aggregateId: productId,
      },
    });
    expect(productAudit.actorId).toBe(admin.id);

    const createMagazine = async (name: string, capacity: number) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/magazines')
        .send({
          name: `${name}-${suffix}`,
          maxNeqCapacityKg: capacity,
          fireLicenseExpiresAt: '2099-12-31',
        })
        .expect(201);
      const magazineId = response.body.id as string;
      magazineIds.push(magazineId);
      return magazineId;
    };

    const mainMagazineId = await createMagazine('Paiol principal', 1);
    const smallMagazineId = await createMagazine('Paiol pequeno', 0.2);
    const destinationMagazineId = await createMagazine('Paiol destino', 1);

    const createLot = async (
      lotNumber: string,
      quantity: number,
      magazineId: string,
    ) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/lots')
        .send({
          productId,
          magazineId,
          lotNumber,
          quantity,
          manufacturedAt: '2026-01-01',
          expiresAt: '2099-01-01',
          manufacturerOrImporter: 'Fabricante de teste',
        });
      if (response.status === 201) {
        lotIds.push(response.body.id as string);
      }
      return response;
    };

    const receivedLot = await createLot(`LOTE-${suffix}-1`, 5, mainMagazineId);
    expect(receivedLot.status).toBe(201);
    expect(receivedLot.body.neqKg).toBe('0.5');

    const overCapacity = await createLot(`LOTE-${suffix}-2`, 6, mainMagazineId);
    expect(overCapacity.status).toBe(409);

    const lotId = receivedLot.body.id as string;
    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'SAIDA',
        productLotId: lotId,
        quantity: 6,
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'ENTRADA',
        productLotId: lotId,
        quantity: 1,
        reference: `ENTRADA-${suffix}`,
      })
      .expect(201);

    const blockedTransfer = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'TRANSFERENCIA',
        productLotId: lotId,
        quantity: 6,
        destinationMagazineId: smallMagazineId,
      })
      .expect(409);
    expect(blockedTransfer.body.message).toContain('capacidade NEQ');

    await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'TRANSFERENCIA',
        productLotId: lotId,
        quantity: 6,
        destinationMagazineId,
      })
      .expect(201);

    const movedLot = await request(app.getHttpServer())
      .get(`/api/v1/inventory/lots/${lotId}`)
      .expect(200);
    expect(movedLot.body.magazineId).toBe(destinationMagazineId);
    expect(movedLot.body.quantity).toBe('6');

    const history = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?productLotId=${lotId}`)
      .expect(200);
    expect(history.body.meta.total).toBe(3);

    const raceMagazineId = await createMagazine('Paiol concorrente', 1);
    const concurrentReceipts = await Promise.all([
      createLot(`LOTE-${suffix}-3`, 6, raceMagazineId),
      createLot(`LOTE-${suffix}-4`, 6, raceMagazineId),
    ]);
    expect(
      concurrentReceipts
        .map((response) => response.status)
        .sort((first, second) => first - second),
    ).toEqual([201, 409]);
  });

  it('reports physical, reserved, available, near-expiry, and expired stock', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `STOCK-REPORT-${suffix}`,
        name: `Produto relatório ${suffix}`,
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
        name: `Paiol relatório ${suffix}`,
        maxNeqCapacityKg: 10,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magazine.body.id as string);
    const createLot = async (
      lotNumber: string,
      quantity: number,
      expiresAt: string,
    ) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/lots')
        .send({
          productId: product.body.id,
          magazineId: magazine.body.id,
          lotNumber,
          quantity,
          manufacturedAt: dateOffset(-100),
          expiresAt,
          manufacturerOrImporter: 'Fabricante relatório',
        })
        .expect(201);
      lotIds.push(response.body.id as string);
      return response;
    };
    const nearExpiryLot = await createLot(`NEAR-${suffix}`, 10, dateOffset(15));
    const expiredLot = await createLot(`EXPIRED-${suffix}`, 5, dateOffset(-1));
    const customer = await prisma.customer.create({
      data: {
        legalName: `Cliente relatório ${suffix}`,
        taxId: suffix.replaceAll('-', '').slice(0, 14),
      },
    });
    customerIds.push(customer.id);
    const priceList = await request(app.getHttpServer())
      .post('/api/v1/pricing/lists')
      .send({
        name: `Tabela relatório estoque ${suffix}`,
        items: [{ productId: product.body.id, unitPrice: 10 }],
      })
      .expect(201);
    priceListIds.push(priceList.body.id as string);
    const quote = await prisma.salesQuote.create({
      data: {
        customerId: customer.id,
        priceListId: priceList.body.id,
        total: 30,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        items: {
          create: [
            {
              productId: product.body.id,
              productLotId: nearExpiryLot.body.id,
              quantity: 3,
              unitPrice: 10,
              subtotal: 30,
            },
          ],
        },
      },
    });
    salesQuoteIds.push(quote.id);
    const order = await prisma.serviceOrder.create({
      data: {
        customerId: customer.id,
        contractedAmount: 100,
        eventAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        eventLocation: 'Evento relatório de estoque',
        status: 'APROVADO',
        items: {
          create: [
            {
              productId: product.body.id,
              productLotId: nearExpiryLot.body.id,
              plannedQuantity: 2,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);

    const report = await request(app.getHttpServer())
      .get('/api/v1/inventory/reports/stock-summary')
      .expect(200);
    expect(report.body.expiryWindowDays).toBe(30);
    const productReport = report.body.byProduct.find(
      (item: { productId: string }) => item.productId === product.body.id,
    );
    expect(productReport).toMatchObject({
      lotCount: 2,
      neqKg: '1.5',
      physicalQuantity: '15',
      reservedQuantity: '5',
      availableQuantity: '5',
      expiredQuantity: '5',
      expiringQuantity: '10',
    });
    expect(report.body.expiringLots).toContainEqual(
      expect.objectContaining({
        lotId: nearExpiryLot.body.id,
        physicalQuantity: '10',
        reservedQuantity: '5',
        availableQuantity: '5',
      }),
    );
    expect(report.body.expiredLots).toContainEqual(
      expect.objectContaining({
        lotId: expiredLot.body.id,
        physicalQuantity: '5',
        availableQuantity: '0',
      }),
    );
  });

  it('supports splitting lots between magazines with NEQ validation and reservation checks', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `PCE-SPLIT-${suffix}`,
        name: 'Produto para teste de desmembramento',
        type: 'MERCADORIA',
        isPce: true,
        riskClass: '1.4G',
        neqGrams: 50,
        unit: 'UN',
      })
      .expect(201);
    productIds.push(product.body.id as string);

    const magOrigin = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol Origem Split ${suffix}`,
        maxNeqCapacityKg: 10,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magOrigin.body.id as string);

    const magDest = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol Destino Split ${suffix}`,
        maxNeqCapacityKg: 1,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magDest.body.id as string);

    const parentLot = await request(app.getHttpServer())
      .post('/api/v1/inventory/lots')
      .send({
        productId: product.body.id,
        magazineId: magOrigin.body.id,
        lotNumber: `LOTE-PAI-${suffix}`,
        quantity: 20,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fabricante de teste',
      })
      .expect(201);
    lotIds.push(parentLot.body.id as string);

    await request(app.getHttpServer())
      .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
      .send({
        destinationMagazineId: magDest.body.id,
        newLotNumber: `LOTE-FILHO-1-${suffix}`,
        quantity: 20,
      })
      .expect(409);

    const tinyMag = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol Minúsculo ${suffix}`,
        maxNeqCapacityKg: 0.1,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(tinyMag.body.id as string);

    await request(app.getHttpServer())
      .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
      .send({
        destinationMagazineId: tinyMag.body.id,
        newLotNumber: `LOTE-EXCEDE-${suffix}`,
        quantity: 5,
      })
      .expect(409);

    const customer = await prisma.customer.create({
      data: {
        legalName: `Cliente Reserva Split ${suffix}`,
        taxId: randomUUID().replaceAll('-', '').slice(0, 14),
      },
    });
    customerIds.push(customer.id);

    const order = await prisma.serviceOrder.create({
      data: {
        customerId: customer.id,
        contractedAmount: 500,
        eventAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        eventLocation: 'Evento reserva split',
        status: 'APROVADO',
        items: {
          create: [
            {
              productId: product.body.id,
              productLotId: parentLot.body.id,
              plannedQuantity: 15,
            },
          ],
        },
      },
    });
    orderIds.push(order.id);

    await request(app.getHttpServer())
      .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
      .send({
        destinationMagazineId: magDest.body.id,
        newLotNumber: `LOTE-FALHA-${suffix}`,
        quantity: 8,
      })
      .expect(409);

    const splitRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
      .send({
        destinationMagazineId: magDest.body.id,
        newLotNumber: `LOTE-FILHO-OK-${suffix}`,
        quantity: 3,
      })
      .expect(201);

    expect(splitRes.body.parentLot.quantity).toBe('17');
    expect(splitRes.body.childLot.quantity).toBe('3');
    expect(splitRes.body.childLot.magazineId).toBe(magDest.body.id);
    expect(splitRes.body.childLot.lotNumber).toBe(`LOTE-FILHO-OK-${suffix}`);
    lotIds.push(splitRes.body.childLot.id as string);

    await request(app.getHttpServer())
      .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
      .send({
        destinationMagazineId: magDest.body.id,
        newLotNumber: `LOTE-FILHO-OK-${suffix}`,
        quantity: 1,
      })
      .expect(409);

    // Concorrência adversarial: 2 divisões simultâneas de 2 unidades sobre saldo disponível restante de 2 (2 + 2 = 4 > 2)
    const [splitRace1, splitRace2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
        .send({
          destinationMagazineId: magDest.body.id,
          newLotNumber: `R1-${suffix.slice(0, 8)}`,
          quantity: 2,
        }),
      request(app.getHttpServer())
        .post(`/api/v1/inventory/lots/${parentLot.body.id}/split`)
        .send({
          destinationMagazineId: magDest.body.id,
          newLotNumber: `R2-${suffix.slice(0, 8)}`,
          quantity: 2,
        }),
    ]);
    const splitRaceStatuses = [splitRace1.status, splitRace2.status].sort(
      (a, b) => a - b,
    );
    expect(splitRaceStatuses).toEqual([201, 409]);
    if (splitRace1.status === 201) lotIds.push(splitRace1.body.childLot.id as string);
    if (splitRace2.status === 201) lotIds.push(splitRace2.body.childLot.id as string);
  });

  it('enforces zero balance invariant for magazine deactivation', async () => {
    const magActive = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol com Saldo ${suffix}`,
        maxNeqCapacityKg: 5,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(magActive.body.id as string);

    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `PROD-MAG-${suffix}`,
        name: 'Produto para teste de paiol',
        type: 'MERCADORIA',
        isPce: false,
        unit: 'UN',
      })
      .expect(201);
    productIds.push(product.body.id as string);

    const lot = await request(app.getHttpServer())
      .post('/api/v1/inventory/lots')
      .send({
        productId: product.body.id,
        magazineId: magActive.body.id,
        lotNumber: `LOTE-MAG-${suffix}`,
        quantity: 10,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fabricante de teste',
      })
      .expect(201);
    lotIds.push(lot.body.id as string);

    const deactivateBlocked = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/magazines/${magActive.body.id}/status`)
      .send({ active: false })
      .expect(409);
    expect(deactivateBlocked.body.message).toContain('saldo de estoque ativo');

    const emptyMag = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol Vazio ${suffix}`,
        maxNeqCapacityKg: 5,
        fireLicenseExpiresAt: '2099-12-31',
      })
      .expect(201);
    magazineIds.push(emptyMag.body.id as string);

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/magazines/${emptyMag.body.id}/status`)
      .send({ active: false })
      .expect(200);
    expect(deactivated.body.active).toBe(false);

    await request(app.getHttpServer())
      .post('/api/v1/inventory/lots')
      .send({
        productId: product.body.id,
        magazineId: emptyMag.body.id,
        lotNumber: `LOTE-INATIVO-${suffix}`,
        quantity: 5,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fabricante de teste',
      })
      .expect(409);

    const reactivated = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/magazines/${emptyMag.body.id}/status`)
      .send({ active: true })
      .expect(200);
    expect(reactivated.body.active).toBe(true);
  });

  it('enforces lot quarantine, blocking, reason traceability, and movement restrictions', async () => {
    const product = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send({
        sku: `SKU-QUAR-${suffix}`,
        name: `Bomba Quarentena ${suffix}`,
        type: 'MERCADORIA',
        isPce: true,
        riskClass: '1.3G',
        neqGrams: 200,
        unit: 'UN',
      })
      .expect(201);
    productIds.push(product.body.id as string);

    const magazine = await request(app.getHttpServer())
      .post('/api/v1/inventory/magazines')
      .send({
        name: `Paiol Quarentena ${suffix}`,
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
        lotNumber: `LOTE-QUAR-${suffix}`,
        quantity: 20,
        manufacturedAt: '2026-01-01',
        expiresAt: '2099-12-31',
        manufacturerOrImporter: 'Fabricante de teste',
      })
      .expect(201);
    lotIds.push(lot.body.id as string);

    // Colocar em quarentena sem motivo deve falhar (validação DTO)
    await request(app.getHttpServer())
      .patch(`/api/v1/inventory/lots/${lot.body.id}/status`)
      .send({ status: 'QUARENTENA' })
      .expect(400);

    // Colocar em quarentena com motivo
    const quarantined = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/lots/${lot.body.id}/status`)
      .send({
        status: 'QUARENTENA',
        reason: 'Inspeção de conformidade SFPC em andamento',
      })
      .expect(200);
    expect(quarantined.body.status).toBe('QUARENTENA');
    expect(quarantined.body.statusReason).toBe(
      'Inspeção de conformidade SFPC em andamento',
    );

    // Tentativa de saída deve ser bloqueada
    const movementBlocked = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'SAIDA',
        productLotId: lot.body.id,
        quantity: 5,
        reference: 'TENTATIVA_SAIDA_QUARENTENA',
      })
      .expect(409);
    expect(movementBlocked.body.message).toContain('QUARENTENA');

    // Tentativa de split deve ser bloqueada
    const splitBlocked = await request(app.getHttpServer())
      .post(`/api/v1/inventory/lots/${lot.body.id}/split`)
      .send({
        destinationMagazineId: magazine.body.id,
        newLotNumber: `LOTE-QS-${suffix}`,
        quantity: 5,
      })
      .expect(409);
    expect(splitBlocked.body.message).toContain('QUARENTENA');

    // Mudar para BLOQUEADO
    const blocked = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/lots/${lot.body.id}/status`)
      .send({
        status: 'BLOQUEADO',
        reason: 'Lote retido por divergência documental',
      })
      .expect(200);
    expect(blocked.body.status).toBe('BLOQUEADO');

    // Entrada em lote bloqueado deve ser rejeitada
    const entradaBlocked = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'ENTRADA',
        productLotId: lot.body.id,
        quantity: 2,
        reference: 'TENTATIVA_ENTRADA_BLOQUEADO',
      })
      .expect(409);
    expect(entradaBlocked.body.message).toContain('Lote bloqueado');

    // Ajuste em lote bloqueado deve ser rejeitado
    const ajusteBlocked = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'AJUSTE',
        productLotId: lot.body.id,
        quantity: 1,
        reference: 'TENTATIVA_AJUSTE_BLOQUEADO',
      })
      .expect(409);
    expect(ajusteBlocked.body.message).toContain('BLOQUEADO');

    // Liberar de volta para DISPONIVEL
    const restored = await request(app.getHttpServer())
      .patch(`/api/v1/inventory/lots/${lot.body.id}/status`)
      .send({ status: 'DISPONIVEL' })
      .expect(200);
    expect(restored.body.status).toBe('DISPONIVEL');

    // Agora saída é permitida
    const movementOk = await request(app.getHttpServer())
      .post('/api/v1/inventory/movements')
      .send({
        type: 'SAIDA',
        productLotId: lot.body.id,
        quantity: 2,
        reference: 'SAIDA_APOS_LIBERACAO',
      })
      .expect(201);
    expect(movementOk.body.quantity).toBe('2');
  });

  it('generates SFPC monthly balance map with regulatory tracking for Army compliance', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/reports/sfpc-monthly-map?year=2026&month=10')
      .expect(200);

    expect(response.body).toHaveProperty('year', 2026);
    expect(response.body).toHaveProperty('month', 10);
    expect(response.body).toHaveProperty('totals');
    expect(response.body.totals).toHaveProperty('productCount');
    expect(response.body.totals).toHaveProperty('initialBalanceNeqKg');
    expect(response.body.totals).toHaveProperty('inflowNeqKg');
    expect(response.body.totals).toHaveProperty('outflowNeqKg');
    expect(response.body.totals).toHaveProperty('finalBalanceNeqKg');
    expect(Array.isArray(response.body.byRiskClass)).toBe(true);
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
