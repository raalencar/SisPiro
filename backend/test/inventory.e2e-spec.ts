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
    await prisma.stockMovement.deleteMany({
      where: { productLotId: { in: lotIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { aggregateId: { in: productIds } },
          { aggregateId: { in: magazineIds } },
          { aggregateId: { in: lotIds } },
        ],
      },
    });
    await prisma.productLot.deleteMany({ where: { id: { in: lotIds } } });
    await prisma.magazine.deleteMany({ where: { id: { in: magazineIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
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
});
