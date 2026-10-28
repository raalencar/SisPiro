import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
export const DEFAULT_SUPPLIER_CATALOG_DIR = resolve(
  backendDir,
  '..',
  'data',
  'fornecedores',
);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const LIMITS = {
  externalId: 50,
  supplierCode: 30,
  name: 200,
  unitPackaging: 60,
  masterPackaging: 60,
  approxDuration: 60,
  sourceUrl: 300,
};

// O site de origem já serviu JS malicioso nas descrições: tudo é gravado como texto puro.
function plainText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return text.length ? text : null;
}

// Defesa própria: o arquivo de origem não é confiável mesmo após o build_catalog.py.
const SUSPICIOUS_PATTERNS = [
  ['ofuscação _0x', /_0x[0-9a-f]/i],
  ['function(', /function\s*\(/i],
  ['window.', /window\./i],
  ['document.', /document\./i],
  ['<script', /<\s*script/i],
  ['javascript:', /javascript\s*:/i],
  ['atributo de evento on*=', /\bon\w+\s*=/i],
  ['entidade HTML', /&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i],
];

export function findSuspiciousContent(raw) {
  const findings = [];
  const visit = (value, path) => {
    if (typeof value === 'string') {
      for (const [label, pattern] of SUSPICIOUS_PATTERNS) {
        if (pattern.test(value)) {
          findings.push(`${path}: ${label}`);
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        visit(entry, path ? `${path}.${key}` : key);
      }
    }
  };
  visit(raw, '');
  return findings;
}

export function safeSourceUrl(value, allowedHosts = []) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return null;
  }
  if (allowedHosts.length && !allowedHosts.includes(url.hostname.toLowerCase())) {
    return null;
  }
  const href = url.href;
  return href.length > LIMITS.sourceUrl ? null : href;
}

function textList(values) {
  return Array.isArray(values)
    ? [...new Set(values.map(plainText).filter(Boolean))]
    : [];
}

function extension(path) {
  const match = /\.[^./\\]+$/.exec(path);
  return match ? match[0].toLowerCase() : '';
}

export function loadCatalogFile(file) {
  const items = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(items)) {
    throw new Error('O catálogo deve ser um array JSON de itens.');
  }
  return items;
}

export function mapCatalogItem(
  raw,
  { imagesPrefix, catalogDir, sourceHosts = [] },
) {
  const errors = [];
  const suspicious = findSuspiciousContent(raw);
  if (suspicious.length) {
    errors.push(`conteúdo suspeito de código/injeção (${suspicious.join(', ')})`);
  }
  const externalId =
    raw.wc_id === null || raw.wc_id === undefined ? null : String(raw.wc_id);
  const data = {
    externalId,
    supplierCode: plainText(raw.codigo),
    name: plainText(raw.nome),
    description: plainText(raw.descricao),
    effect: plainText(raw.efeito),
    unitPackaging: plainText(raw.embalagem_unitaria),
    masterPackaging: plainText(raw.embalagem_master),
    approxDuration: plainText(raw.tempo_aproximado),
    notes: plainText(raw.obs),
    extraAttributes: {
      maquina: plainText(raw.maquina),
      quantidade_por_rolo: plainText(raw.quantidade_por_rolo),
      tags: textList(raw.tags),
    },
    categories: textList(raw.categorias),
    sourceUrl: safeSourceUrl(raw.url, sourceHosts),
    imagePaths: [],
  };
  if (!externalId) {
    errors.push('wc_id ausente');
  }
  if (!data.name) {
    errors.push('nome ausente');
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (data[field] && data[field].length > max) {
      errors.push(`${field} excede ${max} caracteres`);
    }
  }
  const baseDir = resolve(catalogDir);
  for (const image of Array.isArray(raw.imagens) ? raw.imagens : []) {
    const stored = `${imagesPrefix}/${String(image?.arquivo ?? '')}`;
    const absolute = resolve(baseDir, stored);
    if (!absolute.startsWith(baseDir + sep)) {
      errors.push(`imagem fora do diretório do catálogo: ${stored}`);
    } else if (!IMAGE_EXTENSIONS.has(extension(stored))) {
      errors.push(`extensão de imagem não suportada: ${stored}`);
    } else if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      errors.push(`arquivo de imagem não encontrado: ${absolute}`);
    } else {
      data.imagePaths.push(relative(baseDir, absolute).split(sep).join('/'));
    }
  }
  return { data, errors };
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value ?? null;
}

function sameContent(existing, data) {
  return Object.keys(data).every(
    (key) =>
      JSON.stringify(canonical(existing[key])) ===
      JSON.stringify(canonical(data[key])),
  );
}

/**
 * Upsert idempotente por (supplierId, externalId). Nunca altera productId e nunca apaga itens.
 * Sem `apply`, só calcula o plano (dry-run) e não grava nada.
 */
export async function importSupplierCatalog(
  prisma,
  {
    items,
    supplierId,
    imagesPrefix,
    catalogDir = DEFAULT_SUPPLIER_CATALOG_DIR,
    sourceHosts = [],
    sourceFile = null,
    apply = false,
    log = console.info,
  },
) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { id: true, legalName: true },
  });
  if (!supplier) {
    throw new Error(`Fornecedor ${supplierId} não encontrado.`);
  }

  const mapped = [];
  const problems = [];
  const rejected = [];
  const seen = new Set();
  items.forEach((raw, position) => {
    const { data, errors } = mapCatalogItem(raw, {
      imagesPrefix,
      catalogDir,
      sourceHosts,
    });
    if (data.externalId && seen.has(data.externalId)) {
      errors.push(`wc_id ${data.externalId} repetido no arquivo`);
    }
    seen.add(data.externalId);
    if (errors.length) {
      rejected.push(data.externalId ?? `posição ${position}`);
      problems.push(`item ${position} (wc_id ${data.externalId}): ${errors.join('; ')}`);
    }
    mapped.push(data);
  });
  if (problems.length) {
    throw new Error(
      `Catálogo inválido, nada foi gravado. Itens rejeitados (wc_id): ${rejected.join(', ')}\n  ${problems.join('\n  ')}`,
    );
  }

  let existing = [];
  try {
    existing = await prisma.supplierCatalogItem.findMany({
      where: { supplierId },
    });
  } catch (error) {
    if (apply || error?.code !== 'P2021') {
      throw error;
    }
    log('AVISO: tabela fornecedor_catalogo_itens ainda não existe (migração pendente).');
  }
  const byExternalId = new Map(existing.map((item) => [item.externalId, item]));
  const plan = mapped.map((data) => {
    const current = byExternalId.get(data.externalId);
    const action = !current
      ? 'create'
      : sameContent(current, data)
        ? 'unchanged'
        : 'update';
    return { action, data };
  });
  const counts = { create: 0, update: 0, unchanged: 0 };
  for (const { action } of plan) {
    counts[action] += 1;
  }

  log(
    `${apply ? 'APLICANDO' : 'DRY-RUN'} catálogo de ${supplier.legalName}: ` +
      `${items.length} itens, ${counts.create} a criar, ${counts.update} a atualizar, ` +
      `${counts.unchanged} sem alteração, ` +
      `${mapped.reduce((sum, item) => sum + item.imagePaths.length, 0)} imagens validadas.`,
  );
  for (const { action, data } of plan.filter((entry) => entry.action !== 'unchanged')) {
    log(`  ${action.padEnd(6)} wc_id=${data.externalId} ${data.supplierCode ?? '(sem código)'} ${data.name}`);
  }
  if (!apply) {
    return { applied: false, supplierId, total: items.length, ...counts };
  }
  if (counts.create + counts.update === 0) {
    log('Nada a gravar: catálogo já está atualizado.');
    return { applied: true, supplierId, total: items.length, ...counts };
  }

  const importedAt = new Date();
  await prisma.$transaction(
    async (tx) => {
      for (const { action, data } of plan) {
        if (action === 'unchanged') {
          continue;
        }
        await tx.supplierCatalogItem.upsert({
          where: {
            supplierId_externalId: { supplierId, externalId: data.externalId },
          },
          create: { ...data, supplierId, importedAt },
          update: { ...data, importedAt },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: 'procurement.supplier_catalog.imported',
          aggregateType: 'SupplierCatalog',
          aggregateId: supplierId,
          after: {
            sourceFile,
            imagesPrefix,
            total: items.length,
            ...counts,
          },
        },
      });
    },
    { timeout: 120_000 },
  );
  log('Importação concluída.');
  return { applied: true, supplierId, total: items.length, ...counts };
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'supplier-id': { type: 'string' },
      'images-prefix': { type: 'string' },
      'source-host': { type: 'string', multiple: true, default: [] },
      apply: { type: 'boolean', default: false },
    },
  });
  if (!values.file || !values['supplier-id'] || !values['images-prefix']) {
    throw new Error(
      'Uso: node prisma/import-supplier-catalog.mjs --file <catalogo.json> ' +
        '--supplier-id <uuid> --images-prefix <pasta> [--source-host <host>] [--apply]',
    );
  }
  const envFile = resolve(backendDir, '.env');
  if (!process.env.DATABASE_URL && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL é obrigatória.');
  }
  const catalogDir = process.env.SUPPLIER_CATALOG_DIR || DEFAULT_SUPPLIER_CATALOG_DIR;
  if (!isAbsolute(catalogDir)) {
    throw new Error('SUPPLIER_CATALOG_DIR deve ser um caminho absoluto.');
  }

  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const file = resolve(values.file);
  try {
    await importSupplierCatalog(prisma, {
      items: loadCatalogFile(file),
      supplierId: values['supplier-id'],
      imagesPrefix: values['images-prefix'],
      catalogDir,
      sourceHosts: values['source-host'].map((host) => host.toLowerCase()),
      sourceFile: file,
      apply: values.apply,
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
