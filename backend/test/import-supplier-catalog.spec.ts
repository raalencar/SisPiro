import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findSuspiciousContent,
  importSupplierCatalog,
  mapCatalogItem,
  safeSourceUrl,
} from '../prisma/import-supplier-catalog.mjs';

const supplierId = '00000000-0000-4000-9000-000000000099';
const sourceHosts = ['www.amazonfireworks.com.br'];

type StoredItem = Record<string, unknown> & {
  supplierId: string;
  externalId: string;
  productId: string | null;
};

function rawItem(overrides: Record<string, unknown> = {}) {
  return {
    wc_id: 2262,
    nome: 'TURBO JET SMOKE SF-X02',
    url: 'https://www.amazonfireworks.com.br/produto/turbo-jet-smoke/',
    codigo: 'AMZ 8025',
    efeito: 'Fumaça colorida',
    embalagem_unitaria: '1 unidade',
    embalagem_master: '12 caixas',
    tempo_aproximado: '60 s',
    maquina: null,
    quantidade_por_rolo: null,
    obs: null,
    descricao: '<p>Fumaça <strong>densa</strong></p>',
    categorias: ['Linha Fumaças'],
    tags: ['fumaça'],
    imagens: [{ url: 'https://example.invalid/x.jpg', arquivo: 'imagens/a.jpg' }],
    ...overrides,
  };
}

function fakePrisma(initial: StoredItem[] = []) {
  const items = initial.map((item) => ({ ...item }));
  const upserts: Array<{ create: object; update: object }> = [];
  const audits: object[] = [];
  const tx = {
    supplierCatalogItem: {
      upsert: ({ where, create, update }: {
        where: { supplierId_externalId: { externalId: string } };
        create: StoredItem;
        update: object;
      }) => {
        upserts.push({ create, update });
        const current = items.find(
          (item) => item.externalId === where.supplierId_externalId.externalId,
        );
        if (current) {
          Object.assign(current, update);
        } else {
          items.push({ ...create, productId: null });
        }
        return Promise.resolve();
      },
    },
    auditLog: {
      create: ({ data }: { data: object }) => {
        audits.push(data);
        return Promise.resolve();
      },
    },
  };
  const prisma = {
    supplier: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === supplierId ? { id: supplierId, legalName: 'AMAZON' } : null,
        ),
    },
    supplierCatalogItem: {
      findMany: () => Promise.resolve(items.map((item) => ({ ...item }))),
    },
    $transaction: (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  };
  return { prisma, items, upserts, audits };
}

describe('import-supplier-catalog', () => {
  let catalogDir: string;
  const options = () => ({
    imagesPrefix: 'amazon-fireworks',
    catalogDir,
    sourceHosts,
  });

  beforeAll(() => {
    catalogDir = mkdtempSync(join(tmpdir(), 'sispiro-import-'));
    mkdirSync(join(catalogDir, 'amazon-fireworks', 'imagens'), {
      recursive: true,
    });
    writeFileSync(join(catalogDir, 'amazon-fireworks', 'imagens', 'a.jpg'), 'x');
    writeFileSync(join(catalogDir, 'amazon-fireworks', 'imagens', 'a.svg'), 'x');
  });

  afterAll(() => rmSync(catalogDir, { recursive: true, force: true }));

  it('maps a valid item to plain text with relative image paths', () => {
    const { data, errors } = mapCatalogItem(rawItem(), options());
    expect(errors).toEqual([]);
    expect(data.description).toBe('Fumaça densa');
    expect(data.externalId).toBe('2262');
    expect(data.imagePaths).toEqual(['amazon-fireworks/imagens/a.jpg']);
    expect(data.sourceUrl).toBe(
      'https://www.amazonfireworks.com.br/produto/turbo-jet-smoke/',
    );
  });

  it.each([
    ['descricao', 'var _0x3f2a=1'],
    ['descricao', 'function (a) { return a }'],
    ['obs', 'window.location="x"'],
    ['efeito', 'document.write(1)'],
    ['descricao', '<SCRIPT src=x></script>'],
    ['nome', 'javascript:alert(1)'],
    ['descricao', '<img src=x onerror=alert(1)>'],
    ['descricao', '&lt;b&gt; destaque'],
    ['descricao', 'texto &#60; codificado'],
  ])('rejects suspicious content in %s: %s', (field, value) => {
    const { errors } = mapCatalogItem(rawItem({ [field]: value }), options());
    expect(errors.join(' ')).toContain('conteúdo suspeito');
  });

  it('inspects nested arrays such as tags and image entries', () => {
    expect(findSuspiciousContent(rawItem({ tags: ['ok', 'window.top'] }))).toEqual(
      ['tags[1]: window.'],
    );
    expect(findSuspiciousContent(rawItem())).toEqual([]);
  });

  it('accepts only https source URLs from the supplier host', () => {
    expect(safeSourceUrl('http://www.amazonfireworks.com.br/p/', sourceHosts)).toBeNull();
    expect(safeSourceUrl('https://evil.example/p/', sourceHosts)).toBeNull();
    expect(safeSourceUrl('https://user:x@www.amazonfireworks.com.br/', sourceHosts)).toBeNull();
    expect(safeSourceUrl('não é url', sourceHosts)).toBeNull();
    expect(safeSourceUrl('https://evil.example/p/')).toBe('https://evil.example/p/');
    const { data } = mapCatalogItem(rawItem({ url: 'ftp://x/y' }), options());
    expect(data.sourceUrl).toBeNull();
  });

  it('validates image paths against the images prefix', () => {
    expect(mapCatalogItem(rawItem(), { ...options(), imagesPrefix: 'amazon-fireworks/imagens' })
      .errors[0]).toContain('arquivo de imagem não encontrado');
    const traversal = rawItem({ imagens: [{ arquivo: '../../segredo.jpg' }] });
    expect(mapCatalogItem(traversal, options()).errors[0]).toContain('fora do diretório');
    const svg = rawItem({ imagens: [{ arquivo: 'imagens/a.svg' }] });
    expect(mapCatalogItem(svg, options()).errors[0]).toContain('extensão');
  });

  it('aborts listing rejected wc_ids without writing anything', async () => {
    const { prisma, upserts, audits } = fakePrisma();
    await expect(
      importSupplierCatalog(prisma, {
        ...options(),
        supplierId,
        items: [rawItem(), rawItem({ wc_id: 77, obs: 'document.cookie' })],
        apply: true,
        log: () => {},
      }),
    ).rejects.toThrow('Itens rejeitados (wc_id): 77');
    expect(upserts).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it('is idempotent and never writes productId', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    const { prisma, items, upserts, audits } = fakePrisma([
      { supplierId, externalId: '2262', productId, name: 'Nome antigo' },
    ]);
    const run = (apply: boolean) =>
      importSupplierCatalog(prisma, {
        ...options(),
        supplierId,
        items: [rawItem(), rawItem({ wc_id: 3000, codigo: null })],
        apply,
        log: () => {},
      });

    expect(await run(false)).toMatchObject({ applied: false, create: 1, update: 1 });
    expect(upserts).toHaveLength(0);

    expect(await run(true)).toMatchObject({ create: 1, update: 1, unchanged: 0 });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: null,
      action: 'procurement.supplier_catalog.imported',
    });
    for (const { create, update } of upserts) {
      expect(create).not.toHaveProperty('productId');
      expect(update).not.toHaveProperty('productId');
    }
    expect(items.find((item) => item.externalId === '2262')?.productId).toBe(productId);

    expect(await run(true)).toMatchObject({ create: 0, update: 0, unchanged: 2 });
    expect(upserts).toHaveLength(2);
    expect(audits).toHaveLength(1);
  });
});
