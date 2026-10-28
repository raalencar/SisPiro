import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import supertest from 'supertest';
import { App } from 'supertest/types.js';
import {
  authenticateE2eAdmin,
  request,
} from './helpers/authenticated-request.js';
import { PrismaService } from '../src/database/prisma.service.js';

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Supplier catalog API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = randomUUID();
  const workDir = mkdtempSync(join(tmpdir(), 'sispiro-catalog-'));
  const catalogDir = join(workDir, 'catalogo');
  const productIds: string[] = [];
  let supplierId: string;
  const item: Record<string, string> = {};
  const category = `Tortas E2E ${suffix}`;

  beforeAll(async () => {
    mkdirSync(join(catalogDir, 'e2e', 'imagens'), { recursive: true });
    writeFileSync(join(catalogDir, 'e2e', 'imagens', 'ok.png'), PNG_BYTES);
    writeFileSync(join(workDir, 'segredo.png'), PNG_BYTES);
    writeFileSync(join(catalogDir, 'e2e', 'imagens', 'vetor.svg'), '<svg/>');
    symlinkSync(
      join(workDir, 'segredo.png'),
      join(catalogDir, 'e2e', 'imagens', 'link.png'),
    );
    // ConfigModule valida o ambiente ao carregar o AppModule; o diretório precisa existir antes.
    process.env.SUPPLIER_CATALOG_DIR = catalogDir;
    const { AppModule } = await import('../src/app.module.js');

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

    const supplier = await request(app.getHttpServer())
      .post('/api/v1/suppliers')
      .send({ legalName: `Fornecedor catálogo ${suffix}`, taxId: makeValidCnpj() })
      .expect(201);
    supplierId = supplier.body.id as string;

    const fixtures: Array<[string, Record<string, unknown>]> = [
      [
        'withImage',
        {
          supplierCode: 'AMZ 0509',
          name: `Placa leque ${suffix}`,
          effect: 'Red Green Strobe Mine',
          categories: [category, 'Placas'],
          imagePaths: ['e2e/imagens/ok.png', 'e2e/imagens/ok.png'],
        },
      ],
      [
        'sameCode',
        {
          supplierCode: 'AMZ 0509',
          name: `Fumaça de solo ${suffix}`,
          effect: 'Fumaça verde',
          categories: ['Linha Fumaças'],
        },
      ],
      [
        'traversal',
        {
          name: `Traversal ${suffix}`,
          imagePaths: [
            '../segredo.png',
            join(workDir, 'segredo.png'),
            'e2e/imagens/link.png',
            'e2e/imagens/vetor.svg',
            'e2e/imagens/inexistente.png',
          ],
        },
      ],
    ];
    for (const [key, data] of fixtures) {
      const created = await prisma.supplierCatalogItem.create({
        data: {
          supplierId,
          externalId: `${key}-${suffix}`.slice(0, 50),
          importedAt: new Date(),
          ...data,
        } as never,
      });
      item[key] = created.id;
    }
  });

  afterAll(async () => {
    if (prisma) {
      const itemIds = Object.values(item);
      await prisma.supplierCatalogItem.deleteMany({
        where: { id: { in: itemIds } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          aggregateId: {
            in: [...itemIds, ...productIds, supplierId].filter(Boolean),
          },
        },
      });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
      if (supplierId) {
        await prisma.supplier.deleteMany({ where: { id: supplierId } });
      }
    }
    await app?.close();
    rmSync(workDir, { recursive: true, force: true });
    delete process.env.SUPPLIER_CATALOG_DIR;
  });

  it('lists catalog items with supplier, search, category and link filters', async () => {
    const all = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ supplierId, limit: 2 })
      .expect(200);
    expect(all.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const byCode = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ supplierId, q: 'amz 0509' })
      .expect(200);
    expect(byCode.body.meta.total).toBe(2);

    const byEffect = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ supplierId, q: 'STROBE' })
      .expect(200);
    expect(byEffect.body.data).toHaveLength(1);
    expect(byEffect.body.data[0]).toEqual({
      id: item.withImage,
      supplierId,
      supplierName: `Fornecedor catálogo ${suffix}`,
      externalId: `withImage-${suffix}`.slice(0, 50),
      supplierCode: 'AMZ 0509',
      name: `Placa leque ${suffix}`,
      effect: 'Red Green Strobe Mine',
      unitPackaging: null,
      masterPackaging: null,
      approxDuration: null,
      categories: [category, 'Placas'],
      thumbnailUrl: `/procurement/supplier-catalog/${item.withImage}/images/0`,
      productId: null,
      productSku: null,
    });

    const byCategory = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ category })
      .expect(200);
    expect(byCategory.body.data.map((row: { id: string }) => row.id)).toEqual([
      item.withImage,
    ]);

    const unlinked = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ supplierId, linked: 'false' })
      .expect(200);
    expect(unlinked.body.meta.total).toBe(3);
    await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ linked: 'sim' })
      .expect(400);

    const categories = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog/categories')
      .query({ supplierId })
      .expect(200);
    expect(categories.body.data).toEqual(
      [category, 'Linha Fumaças', 'Placas'].sort(),
    );

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${item.withImage}`)
      .expect(200);
    expect(detail.body.images).toEqual([
      { index: 0, url: `/procurement/supplier-catalog/${item.withImage}/images/0` },
      { index: 1, url: `/procurement/supplier-catalog/${item.withImage}/images/1` },
    ]);
    expect(detail.body).not.toHaveProperty('imagePaths');
    await request(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${randomUUID()}`)
      .expect(404);
  });

  it('streams catalog images and blocks path traversal, symlinks and unsupported files', async () => {
    const ok = await request(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${item.withImage}/images/0`)
      .expect(200);
    expect(ok.headers['content-type']).toBe('image/png');
    expect(ok.headers['cache-control']).toBe('private, max-age=86400');
    expect(Buffer.compare(ok.body as Buffer, PNG_BYTES)).toBe(0);

    for (const index of [0, 1, 2, 3, 4, 5]) {
      await request(app.getHttpServer())
        .get(`/api/v1/procurement/supplier-catalog/${item.traversal}/images/${index}`)
        .expect(404);
    }
    await request(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${item.withImage}/images/9`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${item.withImage}/images/abc`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${item.sameCode}/images/0`)
      .expect(404);
    await supertest(app.getHttpServer())
      .get(`/api/v1/procurement/supplier-catalog/${item.withImage}/images/0`)
      .expect(401);
  });

  it('links a catalog item to a new product atomically and rejects duplicate links', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send(productPayload({ isPce: true, riskClass: '1.4G' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send(productPayload({ description: '<script>alert(1)</script>' }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send(productPayload({ supplierCatalogItemId: randomUUID() }))
      .expect(404);

    const created = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send(
        productPayload({
          isPce: true,
          riskClass: '1.4G',
          neqGrams: 12.5,
          description: 'Placa leque com 5 tubos.',
        }),
      )
      .expect(201);
    productIds.push(created.body.id as string);
    expect(created.body.description).toBe('Placa leque com 5 tubos.');
    expect(created.body.imageUrl).toBe(
      `/procurement/supplier-catalog/${item.withImage}/images/0`,
    );

    const linkedItem = await prisma.supplierCatalogItem.findUniqueOrThrow({
      where: { id: item.withImage },
    });
    expect(linkedItem.productId).toBe(created.body.id);
    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'procurement.supplier_catalog_item.linked',
        aggregateId: item.withImage,
      },
    });
    expect(audit?.actorId).toEqual(expect.any(String));
    expect(audit?.after).toMatchObject({ productId: created.body.id });

    const duplicateSku = `CAT-DUP-${randomUUID()}`;
    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .send(productPayload({ sku: duplicateSku }))
      .expect(409);
    expect(duplicate.body.message).toContain('já está vinculado');
    expect(await prisma.product.count({ where: { sku: duplicateSku } })).toBe(0);

    const product = await request(app.getHttpServer())
      .get(`/api/v1/inventory/products/${created.body.id}`)
      .expect(200);
    expect(product.body).toMatchObject({
      description: 'Placa leque com 5 tubos.',
      imageUrl: `/procurement/supplier-catalog/${item.withImage}/images/0`,
    });
    expect(product.body).not.toHaveProperty('catalogItems');

    const linked = await request(app.getHttpServer())
      .get('/api/v1/procurement/supplier-catalog')
      .query({ supplierId, linked: 'true' })
      .expect(200);
    expect(linked.body.data).toHaveLength(1);
    expect(linked.body.data[0]).toMatchObject({
      id: item.withImage,
      productId: created.body.id,
      productSku: created.body.sku,
    });
  });

  function productPayload(overrides: Record<string, unknown>) {
    return {
      sku: `CAT-${randomUUID()}`,
      name: `Produto catálogo ${suffix}`,
      type: 'MERCADORIA',
      unit: 'UN',
      supplierCatalogItemId: item.withImage,
      ...overrides,
    };
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

function checkDigit(digits: number[], weights: number[]): number {
  const remainder =
    digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
