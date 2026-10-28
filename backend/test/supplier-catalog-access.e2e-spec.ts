import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { App } from 'supertest/types.js';
import {
  authenticateE2eAdmin,
  request,
} from './helpers/authenticated-request.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Supplier catalog authorization (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const userIds: string[] = [];
  let supplierId: string | undefined;
  let itemId: string | undefined;

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

    const supplier = await prisma.supplier.create({
      data: {
        legalName: `Fornecedor acesso catálogo ${suffix}`,
        taxId: suffix.replace(/\D/g, '').padEnd(14, '0').slice(0, 14),
      },
    });
    supplierId = supplier.id;
    const item = await prisma.supplierCatalogItem.create({
      data: {
        supplierId,
        externalId: `access-${suffix}`.slice(0, 50),
        name: `Item acesso ${suffix}`,
        importedAt: new Date(),
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: { in: userIds } },
            { aggregateId: { in: userIds } },
          ],
        },
      });
      if (itemId) {
        await prisma.supplierCatalogItem.deleteMany({ where: { id: itemId } });
      }
      if (supplierId) {
        await prisma.supplier.deleteMany({ where: { id: supplierId } });
      }
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it.each(['COMERCIAL', 'OPERACOES'])(
    'denies %s access to every catalog route',
    async (role) => {
      const token = await tokenFor(role);
      const base = '/api/v1/procurement/supplier-catalog';
      for (const path of [
        base,
        `${base}/categories`,
        `${base}/${itemId}`,
        `${base}/${itemId}/images/0`,
      ]) {
        await supertest(app.getHttpServer())
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
      }
    },
  );

  it('lets COMPRAS read the catalog but not create a linked product', async () => {
    const token = await tokenFor('COMPRAS');
    await supertest(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const sku = `CAT-ACL-${randomUUID()}`;
    await supertest(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku,
        name: 'Produto sem permissão',
        type: 'MERCADORIA',
        unit: 'UN',
        supplierCatalogItemId: itemId,
      })
      .expect(403);

    expect(await prisma.product.count({ where: { sku } })).toBe(0);
    const item = await prisma.supplierCatalogItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.productId).toBeNull();
  });

  async function tokenFor(role: string) {
    const email = `catalogo-${role.toLowerCase()}-${suffix}@local.test`;
    const password = `Catalogo ${role} Password 2026`;
    const user = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({ name: `Usuário ${role}`, email, password, roles: [role] })
      .expect(201);
    userIds.push(user.body.id as string);
    const login = await supertest(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return login.body.accessToken as string;
  }
});
