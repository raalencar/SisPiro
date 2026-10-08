import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const seedEnabled = process.env.DEV_SEED_ENABLED === 'true';
const adminPassword = process.env.DEV_SEED_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV !== 'development' || !seedEnabled) {
  throw new Error(
    'Seed bloqueado: use somente em desenvolvimento com DEV_SEED_ENABLED=true.',
  );
}
if (!adminPassword || adminPassword.length < 12 || adminPassword.length > 128) {
  throw new Error(
    'Configure DEV_SEED_ADMIN_PASSWORD com uma senha local de 12 a 128 caracteres.',
  );
}
if (!databaseUrl) {
  throw new Error('DATABASE_URL é obrigatória para executar o seed.');
}
const databaseHost = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
  throw new Error(
    'Seed bloqueado: DATABASE_URL deve apontar para um PostgreSQL local.',
  );
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const ids = {
  admin: '00000000-0000-4000-8000-000000000001',
  magazine: '00000000-0000-4000-8000-000000000002',
  customer: '00000000-0000-4000-8000-000000000003',
  supplier: '00000000-0000-4000-8000-000000000004',
  blaster: '00000000-0000-4000-8000-000000000005',
  product: '00000000-0000-4000-8000-000000000006',
  pceProduct: '00000000-0000-4000-8000-000000000007',
  productLot: '00000000-0000-4000-8000-000000000008',
  pceProductLot: '00000000-0000-4000-8000-000000000009',
  priceList: '00000000-0000-4000-8000-000000000010',
  promotion: '00000000-0000-4000-8000-000000000011',
  purchase: '00000000-0000-4000-8000-000000000012',
  purchaseItem: '00000000-0000-4000-8000-000000000013',
  salesQuote: '00000000-0000-4000-8000-000000000014',
  salesQuoteItem: '00000000-0000-4000-8000-000000000015',
  sale: '00000000-0000-4000-8000-000000000016',
  saleItem: '00000000-0000-4000-8000-000000000017',
  saleReturn: '00000000-0000-4000-8000-000000000018',
  saleReturnItem: '00000000-0000-4000-8000-000000000019',
  serviceOrder: '00000000-0000-4000-8000-000000000020',
  serviceOrderItem: '00000000-0000-4000-8000-000000000021',
  draftOrder: '00000000-0000-4000-8000-000000000022',
  draftOrderItem: '00000000-0000-4000-8000-000000000023',
  receivable: '00000000-0000-4000-8000-000000000024',
  overduePayable: '00000000-0000-4000-8000-000000000025',
  openReceivable: '00000000-0000-4000-8000-000000000026',
  payment: '00000000-0000-4000-8000-000000000027',
  initialMovement: '00000000-0000-4000-8000-000000000028',
  pceInitialMovement: '00000000-0000-4000-8000-000000000029',
  saleMovement: '00000000-0000-4000-8000-000000000030',
  returnMovement: '00000000-0000-4000-8000-000000000031',
  priceListItem: '00000000-0000-4000-8000-000000000032',
  pcePriceListItem: '00000000-0000-4000-8000-000000000033',
  promotionItem: '00000000-0000-4000-8000-000000000034',
};

function dayOffset(offset) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function calculateDigit(digits, weights) {
  const remainder =
    digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function demoCpf(base) {
  const digits = [...base].map(Number);
  const first = calculateDigit(
    digits,
    digits.map((_, index) => 10 - index),
  );
  const secondDigits = [...digits, first];
  const second = calculateDigit(
    secondDigits,
    secondDigits.map((_, index) => 11 - index),
  );
  return `${base}${first}${second}`;
}

function demoCnpj(base) {
  const digits = [...base].map(Number);
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const first = calculateDigit(digits, firstWeights);
  const secondDigits = [...digits, first];
  const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const second = calculateDigit(secondDigits, secondWeights);
  return `${base}${first}${second}`;
}

function passwordHash(password) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    'scrypt',
    32768,
    8,
    1,
    salt.toString('hex'),
    derivedKey.toString('hex'),
  ].join('$');
}

async function upsertById(delegate, id, data) {
  return delegate.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
}

const today = dayOffset(0);
const adminPasswordHash = passwordHash(adminPassword);
const cnpj = demoCnpj('123456780001');
const supplierCnpj = demoCnpj('234567890001');
const blasterCpf = demoCpf('987654321');
const now = new Date();
const expiredPayableDate = dayOffset(-5);
const futureDueDate = dayOffset(14);

try {
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { email: 'demo.admin@local.test' },
      create: {
        id: ids.admin,
        name: 'Administrador DEMO',
        email: 'demo.admin@local.test',
        passwordHash: adminPasswordHash,
        roles: ['ADMIN'],
        active: true,
      },
      update: {
        name: 'Administrador DEMO',
        passwordHash: adminPasswordHash,
        roles: ['ADMIN'],
        active: true,
      },
    });

    await upsertById(tx.magazine, ids.magazine, {
      name: 'Paiol DEMO - não utilizar em operação real',
      maxNeqCapacityKg: '1000',
      fireLicenseExpiresAt: dayOffset(730),
      active: true,
    });
    await upsertById(tx.customer, ids.customer, {
      legalName: 'Cliente DEMO - dados fictícios',
      taxId: cnpj,
      hasCr: true,
      crNumber: 'DEMO-CR-CLIENTE',
      crExpiresAt: dayOffset(365),
      authorizedPceClasses: ['1.4G'],
      active: true,
    });
    await upsertById(tx.supplier, ids.supplier, {
      legalName: 'Fornecedor DEMO - dados fictícios',
      taxId: supplierCnpj,
      hasCr: true,
      crNumber: 'DEMO-CR-FORNECEDOR',
      crExpiresAt: dayOffset(365),
      authorizedPceClasses: ['1.4G'],
      active: true,
    });
    await upsertById(tx.blaster, ids.blaster, {
      name: 'Blaster DEMO - dados fictícios',
      taxId: blasterCpf,
      licenseNumber: 'DEMO-HABILITACAO',
      licenseExpiresAt: dayOffset(365),
      category: 'DEMO',
      active: true,
    });

    await upsertById(tx.product, ids.product, {
      sku: 'DEMO-MERC-001',
      name: 'Produto demonstrativo',
      type: 'MERCADORIA',
      isPce: false,
      riskClass: null,
      neqGrams: '0',
      unit: 'UN',
    });
    await upsertById(tx.product, ids.pceProduct, {
      sku: 'DEMO-PCE-001',
      name: 'Produto PCE demonstrativo - dados fictícios',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.4G',
      neqGrams: '50',
      unit: 'UN',
    });
    await upsertById(tx.productLot, ids.productLot, {
      productId: ids.product,
      magazineId: ids.magazine,
      lotNumber: 'DEMO-LOTE-001',
      quantity: '46',
      manufacturedAt: dayOffset(-30),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'Fabricante DEMO',
    });
    await upsertById(tx.productLot, ids.pceProductLot, {
      productId: ids.pceProduct,
      magazineId: ids.magazine,
      lotNumber: 'DEMO-LOTE-PCE-001',
      quantity: '20',
      manufacturedAt: dayOffset(-30),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'Fabricante DEMO',
    });

    await upsertById(tx.stockMovement, ids.initialMovement, {
      type: 'ENTRADA',
      productLotId: ids.productLot,
      quantity: '50',
      destinationMagazineId: ids.magazine,
      reference: 'DEMO-SALDO-INICIAL',
      occurredAt: now,
    });
    await upsertById(tx.stockMovement, ids.pceInitialMovement, {
      type: 'ENTRADA',
      productLotId: ids.pceProductLot,
      quantity: '20',
      destinationMagazineId: ids.magazine,
      reference: 'DEMO-SALDO-INICIAL',
      occurredAt: now,
    });

    await upsertById(tx.priceList, ids.priceList, {
      name: 'Tabela DEMO',
      active: true,
      effectiveFrom: dayOffset(-30),
      effectiveUntil: dayOffset(365),
    });
    await upsertById(tx.priceListItem, ids.priceListItem, {
      priceListId: ids.priceList,
      productId: ids.product,
      unitPrice: '120',
    });
    await upsertById(tx.priceListItem, ids.pcePriceListItem, {
      priceListId: ids.priceList,
      productId: ids.pceProduct,
      unitPrice: '250',
    });
    await upsertById(tx.productPromotion, ids.promotion, {
      name: 'Promoção DEMO',
      active: true,
      effectiveFrom: dayOffset(-1),
      effectiveUntil: dayOffset(30),
    });
    await upsertById(tx.productPromotionItem, ids.promotionItem, {
      promotionId: ids.promotion,
      productId: ids.product,
      promotionalPrice: '99',
    });

    await upsertById(tx.purchase, ids.purchase, {
      supplierId: ids.supplier,
      status: 'PENDENTE',
      reference: 'DEMO-COMPRA-PENDENTE',
    });
    await upsertById(tx.purchaseItem, ids.purchaseItem, {
      purchaseId: ids.purchase,
      productId: ids.product,
      orderedQuantity: '40',
      unitCost: '12.50',
    });

    await upsertById(tx.salesQuote, ids.salesQuote, {
      customerId: ids.customer,
      priceListId: ids.priceList,
      total: '198',
      status: 'EMITIDO',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    });
    await upsertById(tx.salesQuoteItem, ids.salesQuoteItem, {
      quoteId: ids.salesQuote,
      productId: ids.product,
      productLotId: ids.productLot,
      quantity: '2',
      unitPrice: '99',
      subtotal: '198',
    });

    await upsertById(tx.sale, ids.sale, {
      customerId: ids.customer,
      priceListId: ids.priceList,
      total: '495',
      createdAt: now,
    });
    await upsertById(tx.saleItem, ids.saleItem, {
      saleId: ids.sale,
      productId: ids.product,
      productLotId: ids.productLot,
      quantity: '5',
      unitPrice: '99',
      subtotal: '495',
    });
    await upsertById(tx.stockMovement, ids.saleMovement, {
      type: 'SAIDA',
      productLotId: ids.productLot,
      quantity: '5',
      sourceMagazineId: ids.magazine,
      reference: 'DEMO-VENDA',
      occurredAt: now,
    });

    await upsertById(tx.financialEntry, ids.receivable, {
      direction: 'RECEBER',
      description: 'Venda DEMO - recebimento parcial',
      category: 'VENDA',
      counterparty: 'Cliente DEMO - dados fictícios',
      customerId: ids.customer,
      saleId: ids.sale,
      amount: '495',
      creditedAmount: '99',
      dueDate: futureDueDate,
      status: 'PARCIAL',
      reference: 'DEMO-VENDA',
    });
    await upsertById(tx.financialPayment, ids.payment, {
      entryId: ids.receivable,
      amount: '120',
      method: 'PIX',
      occurredAt: dayOffset(-1),
      reference: 'DEMO-PAGAMENTO-PARCIAL',
      notes: 'Pagamento demonstrativo',
    });
    await upsertById(tx.saleReturn, ids.saleReturn, {
      saleId: ids.sale,
      reason: 'Devolução parcial de demonstração',
      creditApplied: '99',
      refundAmount: '0',
      createdAt: now,
    });
    await upsertById(tx.saleReturnItem, ids.saleReturnItem, {
      returnId: ids.saleReturn,
      saleItemId: ids.saleItem,
      productLotId: ids.productLot,
      quantity: '1',
      unitPrice: '99',
      subtotal: '99',
    });
    await upsertById(tx.stockMovement, ids.returnMovement, {
      type: 'ENTRADA',
      productLotId: ids.productLot,
      quantity: '1',
      destinationMagazineId: ids.magazine,
      reference: 'DEMO-DEVOLUCAO',
      occurredAt: now,
    });

    await upsertById(tx.financialEntry, ids.overduePayable, {
      direction: 'PAGAR',
      description: 'Conta vencida DEMO',
      category: 'DESPESAS_DEMONSTRATIVAS',
      counterparty: 'Fornecedor DEMO - dados fictícios',
      supplierId: ids.supplier,
      amount: '350',
      dueDate: expiredPayableDate,
      status: 'ABERTO',
      reference: 'DEMO-CONTA-VENCIDA',
    });
    await upsertById(tx.financialEntry, ids.openReceivable, {
      direction: 'RECEBER',
      description: 'Conta a receber DEMO',
      category: 'SERVICOS',
      counterparty: 'Cliente DEMO - dados fictícios',
      customerId: ids.customer,
      amount: '650',
      dueDate: futureDueDate,
      status: 'ABERTO',
      reference: 'DEMO-CONTA-A-RECEBER',
    });

    await upsertById(tx.serviceOrder, ids.serviceOrder, {
      customerId: ids.customer,
      responsibleBlasterId: ids.blaster,
      contractedAmount: '1800',
      eventAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      eventLocation: 'Local de evento fictício - DEMO',
      status: 'APROVADO',
      artNumber: 'DEMO-ART',
    });
    await upsertById(tx.serviceOrderItem, ids.serviceOrderItem, {
      serviceOrderId: ids.serviceOrder,
      productId: ids.pceProduct,
      productLotId: ids.pceProductLot,
      plannedQuantity: '3',
    });
    await upsertById(tx.serviceOrder, ids.draftOrder, {
      customerId: ids.customer,
      contractedAmount: '950',
      eventAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      eventLocation: 'Local de evento fictício - DEMO',
      status: 'ORCAMENTO',
    });
    await upsertById(tx.serviceOrderItem, ids.draftOrderItem, {
      serviceOrderId: ids.draftOrder,
      productId: ids.product,
      productLotId: ids.productLot,
      plannedQuantity: '4',
    });
  });

  console.info(
    'Seed DEMO aplicado. Login: demo.admin@local.test; use DEV_SEED_ADMIN_PASSWORD.',
  );
} finally {
  await prisma.$disconnect();
}
