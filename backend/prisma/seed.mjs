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

// Identificadores Determinísticos (UUID v4)
// O bloco 00000000-0000-4000-8000-... substitui e atualiza os registros do seed inicial
// O bloco 00000000-0000-4000-9000-... provisiona os novos registros corporativos da Casa de Fogos São João
const ids = {
  // Usuários
  userLegacyAdmin: '00000000-0000-4000-8000-000000000001',
  userAdmin: '00000000-0000-4000-9000-000000000001',
  userCommercial: '00000000-0000-4000-9000-000000000002',
  userOperations: '00000000-0000-4000-9000-000000000003',
  userInventory: '00000000-0000-4000-9000-000000000004',
  userFinance: '00000000-0000-4000-9000-000000000005',

  // Paióis
  magazineCentral: '00000000-0000-4000-8000-000000000002',
  magazineReserva: '00000000-0000-4000-9000-000000000011',

  // Clientes
  customerPrefeitura: '00000000-0000-4000-8000-000000000003',
  customerMarinaPark: '00000000-0000-4000-9000-000000000031',
  customerBeachPark: '00000000-0000-4000-9000-000000000032',
  customerJunina: '00000000-0000-4000-9000-000000000033',

  // Fornecedores
  supplierSaoBento: '00000000-0000-4000-8000-000000000004',
  supplierPirobras: '00000000-0000-4000-9000-000000000041',
  supplierCearaPiro: '00000000-0000-4000-9000-000000000042',

  // Blasters
  blasterEncarregado: '00000000-0000-4000-8000-000000000005',
  blasterOperador: '00000000-0000-4000-9000-000000000021',

  // Produtos
  prodVulcaoIndoor: '00000000-0000-4000-8000-000000000006',
  prodBat100t: '00000000-0000-4000-8000-000000000007',
  prodMort3in: '00000000-0000-4000-9000-000000000051',
  prodMort4in: '00000000-0000-4000-9000-000000000052',
  prodTorta49t: '00000000-0000-4000-9000-000000000053',
  prodGirandola240t: '00000000-0000-4000-9000-000000000055',
  prodEstopim: '00000000-0000-4000-9000-000000000056',
  prodIgnitor: '00000000-0000-4000-9000-000000000057',

  // Lotes de Produtos
  lotVulcaoIndoor: '00000000-0000-4000-8000-000000000008',
  lotBat100t: '00000000-0000-4000-8000-000000000009',
  lotMort3in: '00000000-0000-4000-9000-000000000061',
  lotMort4in: '00000000-0000-4000-9000-000000000062',
  lotTorta49t: '00000000-0000-4000-9000-000000000063',
  lotGirandola240t: '00000000-0000-4000-9000-000000000065',
  lotEstopim: '00000000-0000-4000-9000-000000000066',
  lotIgnitor: '00000000-0000-4000-9000-000000000067',

  // Tabelas de Preço & Promoções
  priceListPadrao: '00000000-0000-4000-8000-000000000010',
  priceListShows: '00000000-0000-4000-9000-000000000081',
  promotionSaoJoao: '00000000-0000-4000-8000-000000000011',

  // Compras
  purchasePirobras: '00000000-0000-4000-8000-000000000012',
  purchaseItemPirobras1: '00000000-0000-4000-8000-000000000013',

  // Orçamentos e Vendas Comerciais
  salesQuoteMarina: '00000000-0000-4000-8000-000000000014',
  salesQuoteItemMarina: '00000000-0000-4000-8000-000000000015',
  saleBeachPark: '00000000-0000-4000-8000-000000000016',
  saleItemBeachPark1: '00000000-0000-4000-8000-000000000017',
  saleItemBeachPark2: '00000000-0000-4000-9000-000000000112',
  saleReturnBeachPark: '00000000-0000-4000-8000-000000000018',
  saleReturnItemBeachPark: '00000000-0000-4000-8000-000000000019',

  // Ordens de Serviço (Shows Pirotécnicos)
  osIracemaReveillon: '00000000-0000-4000-8000-000000000020',
  osItemIracema1: '00000000-0000-4000-8000-000000000021',
  osItemIracema2: '00000000-0000-4000-9000-000000000122',
  osItemIracema3: '00000000-0000-4000-9000-000000000123',
  osCircuitoJunino: '00000000-0000-4000-8000-000000000022',
  osItemCircuitoJunino: '00000000-0000-4000-8000-000000000023',
  osMarinaParkShow: '00000000-0000-4000-9000-000000000124',
  osItemMarinaShow: '00000000-0000-4000-9000-000000000125',

  // Financeiro
  finReceivableVenda: '00000000-0000-4000-8000-000000000024',
  finPayablePirobras: '00000000-0000-4000-8000-000000000025',
  finReceivableShowP2: '00000000-0000-4000-8000-000000000026',
  finPaymentPixVenda: '00000000-0000-4000-8000-000000000027',
  finReceivableShowP1: '00000000-0000-4000-9000-000000000151',
  finPaymentShowP1: '00000000-0000-4000-9000-000000000155',

  // Movimentos de Estoque
  movInitVulcaoIndoor: '00000000-0000-4000-8000-000000000028',
  movInitBat100t: '00000000-0000-4000-8000-000000000029',
  saleMovSaida1: '00000000-0000-4000-8000-000000000030',
  saleReturnMovEntrada: '00000000-0000-4000-8000-000000000031',
  saleMovSaida2: '00000000-0000-4000-9000-000000000114',
  movInitMort3in: '00000000-0000-4000-9000-000000000071',
  movInitMort4in: '00000000-0000-4000-9000-000000000072',
  movInitTorta49t: '00000000-0000-4000-9000-000000000073',
  movInitGirandola240t: '00000000-0000-4000-9000-000000000075',

  // Itens de Tabela de Preço & Promoção
  priceListItemPadrao1: '00000000-0000-4000-8000-000000000032',
  priceListItemPadrao2: '00000000-0000-4000-8000-000000000033',
  promotionItemSaoJoao: '00000000-0000-4000-8000-000000000034',

  // Documentos Fiscais
  fiscalNfeVenda: '00000000-0000-4000-9000-000000000130',
  fiscalNfeShow: '00000000-0000-4000-9000-000000000131',

  // Guia de Tráfego Militar (SFPC 10ª RM)
  trafficGuideIracema: '00000000-0000-4000-9000-000000000140',
  gtItemIracema1: '00000000-0000-4000-9000-000000000141',
  gtItemIracema2: '00000000-0000-4000-9000-000000000142',
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

function validCpf(base) {
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

function validCnpj(base) {
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

const now = new Date();
const adminPasswordHash = passwordHash(adminPassword);

// CNPJs e CPFs Válidos
const companyCnpj = '05922101000133'; // Casa de Fogos São João LTDA
const customerPrefeituraCnpj = validCnpj('088714580001'); // Município de Fortaleza
const customerMarinaParkCnpj = validCnpj('072345670001'); // Marina Park Hotel S/A
const customerBeachParkCnpj = validCnpj('093456780001'); // Beach Park Hotéis e Turismo
const customerJuninaCnpj = validCnpj('145678900001'); // Federação das Quadrilhas Juninas

const supplierSaoBentoCnpj = validCnpj('184567890001'); // Indústria São Bento (Sto. Antônio do Monte/MG)
const supplierPirobrasCnpj = validCnpj('234567890001'); // Pirobrás Artigos Pirotécnicos S/A
const supplierCearaPiroCnpj = validCnpj('334567890001'); // Ceará Piro Insumos

const blasterEncarregadoCpf = validCpf('059221013'); // Raimundo Nonato de Alencar
const blasterOperadorCpf = validCpf('245892110'); // Francisco Evandro Moreira

try {
  await prisma.$transaction(async (tx) => {
    // -------------------------------------------------------------------------
    // 1. USUÁRIOS DO SISTEMA (Casa de Fogos São João LTDA)
    // -------------------------------------------------------------------------
    // Usuário de compatibilidade local (mantém id histórico ...0001)
    await tx.user.upsert({
      where: { email: 'demo.admin@local.test' },
      create: {
        id: ids.userLegacyAdmin,
        name: 'Administrador Local SisPiro',
        email: 'demo.admin@local.test',
        passwordHash: adminPasswordHash,
        roles: ['ADMIN', 'ESTOQUE', 'COMERCIAL', 'OPERACOES', 'COMPRAS', 'FINANCEIRO'],
        active: true,
      },
      update: {
        name: 'Administrador Local SisPiro',
        passwordHash: adminPasswordHash,
        roles: ['ADMIN', 'ESTOQUE', 'COMERCIAL', 'OPERACOES', 'COMPRAS', 'FINANCEIRO'],
        active: true,
      },
    });

    // Usuário Administrador Corporativo da Casa de Fogos São João
    await tx.user.upsert({
      where: { email: 'admin@casadefogossaojoao.com' },
      create: {
        id: ids.userAdmin,
        name: 'Administrador Geral - Casa de Fogos São João',
        email: 'admin@casadefogossaojoao.com',
        passwordHash: adminPasswordHash,
        roles: ['ADMIN', 'ESTOQUE', 'COMERCIAL', 'OPERACOES', 'COMPRAS', 'FINANCEIRO'],
        active: true,
      },
      update: {
        name: 'Administrador Geral - Casa de Fogos São João',
        passwordHash: adminPasswordHash,
        roles: ['ADMIN', 'ESTOQUE', 'COMERCIAL', 'OPERACOES', 'COMPRAS', 'FINANCEIRO'],
        active: true,
      },
    });

    await tx.user.upsert({
      where: { email: 'comercial@casadefogossaojoao.com' },
      create: {
        id: ids.userCommercial,
        name: 'Gerente Comercial - Vendas e Orçamentos',
        email: 'comercial@casadefogossaojoao.com',
        passwordHash: adminPasswordHash,
        roles: ['COMERCIAL'],
        active: true,
      },
      update: {
        name: 'Gerente Comercial - Vendas e Orçamentos',
        passwordHash: adminPasswordHash,
        roles: ['COMERCIAL'],
        active: true,
      },
    });

    await tx.user.upsert({
      where: { email: 'operacoes@casadefogossaojoao.com' },
      create: {
        id: ids.userOperations,
        name: 'Coordenação de Shows e Blasters',
        email: 'operacoes@casadefogossaojoao.com',
        passwordHash: adminPasswordHash,
        roles: ['OPERACOES'],
        active: true,
      },
      update: {
        name: 'Coordenação de Shows e Blasters',
        passwordHash: adminPasswordHash,
        roles: ['OPERACOES'],
        active: true,
      },
    });

    await tx.user.upsert({
      where: { email: 'estoque@casadefogossaojoao.com' },
      create: {
        id: ids.userInventory,
        name: 'Fiel do Paiol e Almoxarifado Central',
        email: 'estoque@casadefogossaojoao.com',
        passwordHash: adminPasswordHash,
        roles: ['ESTOQUE'],
        active: true,
      },
      update: {
        name: 'Fiel do Paiol e Almoxarifado Central',
        passwordHash: adminPasswordHash,
        roles: ['ESTOQUE'],
        active: true,
      },
    });

    await tx.user.upsert({
      where: { email: 'financeiro@casadefogossaojoao.com' },
      create: {
        id: ids.userFinance,
        name: 'Controladoria e Contas a Receber/Pagar',
        email: 'financeiro@casadefogossaojoao.com',
        passwordHash: adminPasswordHash,
        roles: ['FINANCEIRO'],
        active: true,
      },
      update: {
        name: 'Controladoria e Contas a Receber/Pagar',
        passwordHash: adminPasswordHash,
        roles: ['FINANCEIRO'],
        active: true,
      },
    });

    // -------------------------------------------------------------------------
    // 2. PAIÓIS DA CASA DE FOGOS SÃO JOÃO (Homologados SFPC / 10ª RM)
    // -------------------------------------------------------------------------
    await upsertById(tx.magazine, ids.magazineCentral, {
      name: 'Paiol Central São João I - Av. Waldir Diogo (Novo Mondubim)',
      maxNeqCapacityKg: '2500.00',
      fireLicenseExpiresAt: dayOffset(730),
      active: true,
    });

    await upsertById(tx.magazine, ids.magazineReserva, {
      name: 'Paiol Avançado II - Distrito Industrial Maracanaú',
      maxNeqCapacityKg: '5000.00',
      fireLicenseExpiresAt: dayOffset(730),
      active: true,
    });

    // -------------------------------------------------------------------------
    // 3. BLASTERS HABILITADOS (Portaria COLOG / SFPC 10ª RM)
    // -------------------------------------------------------------------------
    await upsertById(tx.blaster, ids.blasterEncarregado, {
      name: 'Raimundo Nonato de Alencar',
      taxId: blasterEncarregadoCpf,
      licenseNumber: '10RM-BLAST-2024/089-CE',
      licenseExpiresAt: dayOffset(730),
      category: 'Blaster Encarregado (Cl. 3)',
      active: true,
    });

    await upsertById(tx.blaster, ids.blasterOperador, {
      name: 'Francisco Evandro Moreira',
      taxId: blasterOperadorCpf,
      licenseNumber: '10RM-BLAST-2023/142-CE',
      licenseExpiresAt: dayOffset(540),
      category: 'Operador de Campo (Cl. 2)',
      active: true,
    });

    // -------------------------------------------------------------------------
    // 4. CLIENTES REGIONAIS (Ceará / Nordeste)
    // -------------------------------------------------------------------------
    await upsertById(tx.customer, ids.customerPrefeitura, {
      legalName: 'MUNICÍPIO DE FORTALEZA - SECRETARIA DE TURISMO (SETFOR)',
      taxId: customerPrefeituraCnpj,
      hasCr: true,
      crNumber: 'CR-10RM-PUB-0012',
      crExpiresAt: dayOffset(730),
      authorizedPceClasses: ['1.1G', '1.3G', '1.4G'],
      active: true,
    });

    await upsertById(tx.customer, ids.customerMarinaPark, {
      legalName: 'MARINA PARK HOTEL EMPREENDIMENTOS TURÍSTICOS S/A',
      taxId: customerMarinaParkCnpj,
      hasCr: true,
      crNumber: 'CR-10RM-HOTEL-0045',
      crExpiresAt: dayOffset(365),
      authorizedPceClasses: ['1.3G', '1.4G'],
      active: true,
    });

    await upsertById(tx.customer, ids.customerBeachPark, {
      legalName: 'BEACH PARK HOTÉIS E TURISMO S/A',
      taxId: customerBeachParkCnpj,
      hasCr: true,
      crNumber: 'CR-10RM-TUR-0089',
      crExpiresAt: dayOffset(420),
      authorizedPceClasses: ['1.3G', '1.4G'],
      active: true,
    });

    await upsertById(tx.customer, ids.customerJunina, {
      legalName: 'FEDERAÇÃO DE QUADRILHAS JUNINAS DO CEARÁ - FEQUAJUCE',
      taxId: customerJuninaCnpj,
      hasCr: false,
      crNumber: null,
      crExpiresAt: null,
      authorizedPceClasses: ['1.4G'],
      active: true,
    });

    // -------------------------------------------------------------------------
    // 5. FORNECEDORES DE PIROTECNIA E INSUMOS
    // -------------------------------------------------------------------------
    await upsertById(tx.supplier, ids.supplierSaoBento, {
      legalName: 'INDÚSTRIA PIROTÉCNICA SÃO BENTO LTDA',
      taxId: supplierSaoBentoCnpj,
      hasCr: true,
      crNumber: 'CR-4RM-IND-0412',
      crExpiresAt: dayOffset(730),
      authorizedPceClasses: ['1.1G', '1.3G', '1.4G'],
      active: true,
    });

    await upsertById(tx.supplier, ids.supplierPirobras, {
      legalName: 'PIROBRÁS ARTIGOS PIROTÉCNICOS S/A',
      taxId: supplierPirobrasCnpj,
      hasCr: true,
      crNumber: 'CR-2RM-IND-0105',
      crExpiresAt: dayOffset(730),
      authorizedPceClasses: ['1.3G', '1.4G'],
      active: true,
    });

    await upsertById(tx.supplier, ids.supplierCearaPiro, {
      legalName: 'CEARÁ PIRO INSUMOS E EQUIPAMENTOS ELETRÔNICOS LTDA',
      taxId: supplierCearaPiroCnpj,
      hasCr: false,
      crNumber: null,
      crExpiresAt: null,
      authorizedPceClasses: [],
      active: true,
    });

    // -------------------------------------------------------------------------
    // 6. PRODUTOS PROFISSIONAIS (PCE E NÃO-PCE)
    // -------------------------------------------------------------------------
    await upsertById(tx.product, ids.prodVulcaoIndoor, {
      sku: 'VULCAO-INDOOR-SILVER',
      name: 'Fonte Vulcão de Faíscas Frias Prata 3m Sem Fumaça Indoor 1.4G',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.4G',
      neqGrams: '45.000',
      unit: 'UN',
    });

    await upsertById(tx.product, ids.prodBat100t, {
      sku: 'BAT-100T-BROCADE',
      name: 'Bateria Profissional 100 Tiros Brocade Crown & Golden Strobe 1.3G',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.3G',
      neqGrams: '950.000',
      unit: 'CX',
    });

    await upsertById(tx.product, ids.prodMort3in, {
      sku: 'MORT-3POL-PEONY',
      name: 'Morteiro Esférico Calibre 3 Pol. Peony Dourada com Crackling 1.3G',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.3G',
      neqGrams: '180.000',
      unit: 'UN',
    });

    await upsertById(tx.product, ids.prodMort4in, {
      sku: 'MORT-4POL-CHRYS',
      name: 'Morteiro Esférico Calibre 4 Pol. Multicolor Chrysanthemum 1.3G',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.3G',
      neqGrams: '320.000',
      unit: 'UN',
    });

    await upsertById(tx.product, ids.prodTorta49t, {
      sku: 'TORTA-49T-ZSHAPE',
      name: 'Torta Piromusical Leque 49 Tiros Z-Shape Silver Dragon 1.3G',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.3G',
      neqGrams: '1400.000',
      unit: 'CX',
    });

    await upsertById(tx.product, ids.prodGirandola240t, {
      sku: 'GIRANDOLA-240T-SJ',
      name: 'Girândola Festiva São João 240 Tubos Multi-Efeitos 1.4G',
      type: 'MERCADORIA',
      isPce: true,
      riskClass: '1.4G',
      neqGrams: '380.000',
      unit: 'UN',
    });

    await upsertById(tx.product, ids.prodEstopim, {
      sku: 'INS-ESTOPIM-100M',
      name: 'Estopim de Segurança Pirotécnico Queima Lenta Rolo 100m',
      type: 'INSUMO',
      isPce: false,
      riskClass: null,
      neqGrams: '0.000',
      unit: 'RL',
    });

    await upsertById(tx.product, ids.prodIgnitor, {
      sku: 'INS-IGNITOR-EMATCH',
      name: 'Ignitor Elétrico E-Match Cabo 3m com Protetor de Fulminante',
      type: 'INSUMO',
      isPce: false,
      riskClass: null,
      neqGrams: '0.000',
      unit: 'CX',
    });

    // -------------------------------------------------------------------------
    // 7. LOTES DE PRODUTOS COM RASTREABILIDADE TOTAL (Invariante SisPiro)
    // -------------------------------------------------------------------------
    await upsertById(tx.productLot, ids.lotVulcaoIndoor, {
      productId: ids.prodVulcaoIndoor,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-PB-2026-022',
      quantity: '150.00',
      manufacturedAt: dayOffset(-20),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'PIROBRÁS ARTIGOS PIROTÉCNICOS S/A',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotBat100t, {
      productId: ids.prodBat100t,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-SB-2026-001',
      quantity: '40.00',
      manufacturedAt: dayOffset(-45),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'INDÚSTRIA PIROTÉCNICA SÃO BENTO LTDA',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotMort3in, {
      productId: ids.prodMort3in,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-SB-2026-002',
      quantity: '120.00',
      manufacturedAt: dayOffset(-45),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'INDÚSTRIA PIROTÉCNICA SÃO BENTO LTDA',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotMort4in, {
      productId: ids.prodMort4in,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-SB-2026-003',
      quantity: '80.00',
      manufacturedAt: dayOffset(-45),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'INDÚSTRIA PIROTÉCNICA SÃO BENTO LTDA',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotTorta49t, {
      productId: ids.prodTorta49t,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-PB-2026-015',
      quantity: '25.00',
      manufacturedAt: dayOffset(-30),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'PIROBRÁS ARTIGOS PIROTÉCNICOS S/A',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotGirandola240t, {
      productId: ids.prodGirandola240t,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-SB-2026-033',
      quantity: '75.00',
      manufacturedAt: dayOffset(-30),
      expiresAt: dayOffset(730),
      manufacturerOrImporter: 'INDÚSTRIA PIROTÉCNICA SÃO BENTO LTDA',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotEstopim, {
      productId: ids.prodEstopim,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-CP-2026-005',
      quantity: '60.00',
      manufacturedAt: dayOffset(-60),
      expiresAt: dayOffset(1095),
      manufacturerOrImporter: 'CEARÁ PIRO INSUMOS E EQUIPAMENTOS ELETRÔNICOS LTDA',
      status: 'DISPONIVEL',
    });

    await upsertById(tx.productLot, ids.lotIgnitor, {
      productId: ids.prodIgnitor,
      magazineId: ids.magazineCentral,
      lotNumber: 'LOTE-CP-2026-012',
      quantity: '500.00',
      manufacturedAt: dayOffset(-60),
      expiresAt: dayOffset(1095),
      manufacturerOrImporter: 'CEARÁ PIRO INSUMOS E EQUIPAMENTOS ELETRÔNICOS LTDA',
      status: 'DISPONIVEL',
    });

    // -------------------------------------------------------------------------
    // 8. MOVIMENTAÇÕES DE ENTRADA INICIAIS NO PAIOL CENTRAL
    // -------------------------------------------------------------------------
    await upsertById(tx.stockMovement, ids.movInitVulcaoIndoor, {
      type: 'ENTRADA',
      productLotId: ids.lotVulcaoIndoor,
      quantity: '150.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'NF-E 019230 - ENTRADA PIROBRÁS',
      occurredAt: dayOffset(-25),
    });

    await upsertById(tx.stockMovement, ids.movInitBat100t, {
      type: 'ENTRADA',
      productLotId: ids.lotBat100t,
      quantity: '40.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'NF-E 004812 - ENTRADA FABRICANTE',
      occurredAt: dayOffset(-40),
    });

    await upsertById(tx.stockMovement, ids.movInitMort3in, {
      type: 'ENTRADA',
      productLotId: ids.lotMort3in,
      quantity: '120.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'NF-E 004812 - ENTRADA FABRICANTE',
      occurredAt: dayOffset(-40),
    });

    await upsertById(tx.stockMovement, ids.movInitMort4in, {
      type: 'ENTRADA',
      productLotId: ids.lotMort4in,
      quantity: '80.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'NF-E 004812 - ENTRADA FABRICANTE',
      occurredAt: dayOffset(-40),
    });

    await upsertById(tx.stockMovement, ids.movInitTorta49t, {
      type: 'ENTRADA',
      productLotId: ids.lotTorta49t,
      quantity: '25.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'NF-E 019230 - ENTRADA PIROBRÁS',
      occurredAt: dayOffset(-25),
    });

    await upsertById(tx.stockMovement, ids.movInitGirandola240t, {
      type: 'ENTRADA',
      productLotId: ids.lotGirandola240t,
      quantity: '80.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'NF-E 004812 - ENTRADA FABRICANTE',
      occurredAt: dayOffset(-25),
    });

    // -------------------------------------------------------------------------
    // 9. TABELAS DE PREÇO & POLÍTICAS COMERCIAIS
    // -------------------------------------------------------------------------
    await upsertById(tx.priceList, ids.priceListPadrao, {
      name: 'Tabela Padrão Distribuição Ceará 2026',
      active: true,
      effectiveFrom: dayOffset(-30),
      effectiveUntil: dayOffset(365),
    });

    await upsertById(tx.priceList, ids.priceListShows, {
      name: 'Tabela Especial Grandes Espetáculos e Prefeituras',
      active: true,
      effectiveFrom: dayOffset(-30),
      effectiveUntil: dayOffset(365),
    });

    await upsertById(tx.priceListItem, ids.priceListItemPadrao1, {
      priceListId: ids.priceListPadrao,
      productId: ids.prodVulcaoIndoor,
      unitPrice: '65.00',
    });

    await upsertById(tx.priceListItem, ids.priceListItemPadrao2, {
      priceListId: ids.priceListPadrao,
      productId: ids.prodBat100t,
      unitPrice: '420.00',
    });

    await tx.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: ids.priceListPadrao,
          productId: ids.prodMort3in,
        },
      },
      create: {
        priceListId: ids.priceListPadrao,
        productId: ids.prodMort3in,
        unitPrice: '95.00',
      },
      update: { unitPrice: '95.00' },
    });

    await tx.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: ids.priceListPadrao,
          productId: ids.prodMort4in,
        },
      },
      create: {
        priceListId: ids.priceListPadrao,
        productId: ids.prodMort4in,
        unitPrice: '160.00',
      },
      update: { unitPrice: '160.00' },
    });

    await tx.priceListItem.upsert({
      where: {
        priceListId_productId: {
          priceListId: ids.priceListPadrao,
          productId: ids.prodGirandola240t,
        },
      },
      create: {
        priceListId: ids.priceListPadrao,
        productId: ids.prodGirandola240t,
        unitPrice: '280.00',
      },
      update: { unitPrice: '280.00' },
    });

    // Promoção Festival Junino
    await upsertById(tx.productPromotion, ids.promotionSaoJoao, {
      name: 'Festival Junino São João de Fortaleza 2026',
      active: true,
      effectiveFrom: dayOffset(-10),
      effectiveUntil: dayOffset(45),
    });

    await upsertById(tx.productPromotionItem, ids.promotionItemSaoJoao, {
      promotionId: ids.promotionSaoJoao,
      productId: ids.prodGirandola240t,
      discountType: 'PRECO_FIXO',
      promotionalPrice: '239.00',
    });

    // -------------------------------------------------------------------------
    // 10. COMPRAS DE SUPRIMENTOS (Procurement)
    // -------------------------------------------------------------------------
    await upsertById(tx.purchase, ids.purchasePirobras, {
      supplierId: ids.supplierPirobras,
      status: 'PENDENTE',
      reference: 'PC-2026/041 - REPOSIÇÃO VULCÕES INDOOR',
    });

    await upsertById(tx.purchaseItem, ids.purchaseItemPirobras1, {
      purchaseId: ids.purchasePirobras,
      productId: ids.prodVulcaoIndoor,
      orderedQuantity: '100.00',
      unitCost: '32.50',
    });

    // -------------------------------------------------------------------------
    // 11. ORÇAMENTO & VENDA CONCRETIZADA (Comercial / Vendas)
    // -------------------------------------------------------------------------
    // Orçamento emitido para Marina Park Hotel
    await upsertById(tx.salesQuote, ids.salesQuoteMarina, {
      customerId: ids.customerMarinaPark,
      priceListId: ids.priceListPadrao,
      total: '4200.00',
      status: 'EMITIDO',
      expiresAt: dayOffset(14),
      createdAt: dayOffset(-2),
    });

    await upsertById(tx.salesQuoteItem, ids.salesQuoteItemMarina, {
      quoteId: ids.salesQuoteMarina,
      productId: ids.prodBat100t,
      productLotId: ids.lotBat100t,
      quantity: '10.00',
      unitPrice: '420.00',
      subtotal: '4200.00',
    });

    // Venda faturada para Beach Park Hotéis e Turismo S/A
    await upsertById(tx.sale, ids.saleBeachPark, {
      customerId: ids.customerBeachPark,
      priceListId: ids.priceListPadrao,
      total: '2720.00',
      createdAt: dayOffset(-1),
    });

    await upsertById(tx.saleItem, ids.saleItemBeachPark1, {
      saleId: ids.saleBeachPark,
      productId: ids.prodBat100t,
      productLotId: ids.lotBat100t,
      quantity: '4.00',
      unitPrice: '420.00',
      subtotal: '1680.00',
    });

    await upsertById(tx.saleItem, ids.saleItemBeachPark2, {
      saleId: ids.saleBeachPark,
      productId: ids.prodVulcaoIndoor,
      productLotId: ids.lotVulcaoIndoor,
      quantity: '16.00',
      unitPrice: '65.00',
      subtotal: '1040.00',
    });

    // Baixa de estoque da venda
    await upsertById(tx.stockMovement, ids.saleMovSaida1, {
      type: 'SAIDA',
      productLotId: ids.lotBat100t,
      quantity: '4.00',
      sourceMagazineId: ids.magazineCentral,
      reference: 'VENDA 001 - BEACH PARK',
      occurredAt: dayOffset(-1),
    });

    await upsertById(tx.stockMovement, ids.saleMovSaida2, {
      type: 'SAIDA',
      productLotId: ids.lotVulcaoIndoor,
      quantity: '16.00',
      sourceMagazineId: ids.magazineCentral,
      reference: 'VENDA 001 - BEACH PARK',
      occurredAt: dayOffset(-1),
    });

    // Devolução parcial (1 un Vulcão com estojo amassado no transporte)
    await upsertById(tx.saleReturn, ids.saleReturnBeachPark, {
      saleId: ids.saleBeachPark,
      reason: 'Avaria na embalagem externa identificada no recebimento',
      creditApplied: '65.00',
      refundAmount: '0.00',
      createdAt: now,
    });

    await upsertById(tx.saleReturnItem, ids.saleReturnItemBeachPark, {
      returnId: ids.saleReturnBeachPark,
      saleItemId: ids.saleItemBeachPark2,
      productLotId: ids.lotVulcaoIndoor,
      quantity: '1.00',
      unitPrice: '65.00',
      subtotal: '65.00',
    });

    await upsertById(tx.stockMovement, ids.saleReturnMovEntrada, {
      type: 'ENTRADA',
      productLotId: ids.lotVulcaoIndoor,
      quantity: '1.00',
      destinationMagazineId: ids.magazineCentral,
      reference: 'DEVOLUÇÃO 001 - RETORNO AO PAIOL CENTRAL',
      occurredAt: now,
    });

    // -------------------------------------------------------------------------
    // 12. ORDENS DE SERVIÇO DE SHOWS PIROTÉCNICOS (Operações / OS)
    // -------------------------------------------------------------------------
    // OS 1: Show Piromusical de Réveillon - Praia de Iracema (Aprovado)
    await upsertById(tx.serviceOrder, ids.osIracemaReveillon, {
      customerId: ids.customerPrefeitura,
      responsibleBlasterId: ids.blasterEncarregado,
      contractedAmount: '185000.00',
      eventAt: new Date(Date.now() + 65 * 24 * 60 * 60 * 1000),
      eventLocation: 'Aterro da Praia de Iracema, Av. Historiador Raimundo Girão - Fortaleza/CE',
      status: 'APROVADO',
      artNumber: 'ART-CREACE-2026-09884',
    });

    await upsertById(tx.serviceOrderItem, ids.osItemIracema1, {
      serviceOrderId: ids.osIracemaReveillon,
      productId: ids.prodBat100t,
      productLotId: ids.lotBat100t,
      plannedQuantity: '20.00',
    });

    await upsertById(tx.serviceOrderItem, ids.osItemIracema2, {
      serviceOrderId: ids.osIracemaReveillon,
      productId: ids.prodMort3in,
      productLotId: ids.lotMort3in,
      plannedQuantity: '60.00',
    });

    await upsertById(tx.serviceOrderItem, ids.osItemIracema3, {
      serviceOrderId: ids.osIracemaReveillon,
      productId: ids.prodMort4in,
      productLotId: ids.lotMort4in,
      plannedQuantity: '40.00',
    });

    // OS 2: Circuito Junino de Fortaleza (Em Orçamento)
    await upsertById(tx.serviceOrder, ids.osCircuitoJunino, {
      customerId: ids.customerJunina,
      responsibleBlasterId: ids.blasterEncarregado,
      contractedAmount: '12500.00',
      eventAt: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      eventLocation: 'Polo de Lazer do Conjunto Ceará - Fortaleza/CE',
      status: 'ORCAMENTO',
    });

    await upsertById(tx.serviceOrderItem, ids.osItemCircuitoJunino, {
      serviceOrderId: ids.osCircuitoJunino,
      productId: ids.prodGirandola240t,
      productLotId: ids.lotGirandola240t,
      plannedQuantity: '15.00',
    });

    // OS 3: Show Pirotécnico Marina Park Hotel (Em Montagem)
    await upsertById(tx.serviceOrder, ids.osMarinaParkShow, {
      customerId: ids.customerMarinaPark,
      responsibleBlasterId: ids.blasterOperador,
      contractedAmount: '48000.00',
      eventAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      eventLocation: 'Marina Park Hotel - Espelho D água Náutico, Praia de Iracema - Fortaleza/CE',
      status: 'EM_MONTAGEM',
      artNumber: 'ART-CREACE-2026-10442',
    });

    await upsertById(tx.serviceOrderItem, ids.osItemMarinaShow, {
      serviceOrderId: ids.osMarinaParkShow,
      productId: ids.prodTorta49t,
      productLotId: ids.lotTorta49t,
      plannedQuantity: '10.00',
    });

    // -------------------------------------------------------------------------
    // 13. DOCUMENTOS FISCAIS ELETRÔNICOS (SEFAZ-CE / UF 23)
    // -------------------------------------------------------------------------
    await upsertById(tx.fiscalDocument, ids.fiscalNfeVenda, {
      type: 'NFE',
      status: 'AUTORIZADO',
      number: 1042,
      series: 1,
      accessKey: '23261005922101000133550010000010421894231892',
      protocol: '123260004928172',
      totalAmount: '2720.00',
      xmlUrl: 'https://sefaz.ce.gov.br/nfe/xml/23261005922101000133550010000010421894231892',
      danfeUrl: 'https://sefaz.ce.gov.br/nfe/danfe/23261005922101000133550010000010421894231892',
      issuedAt: dayOffset(-1),
      saleId: ids.saleBeachPark,
    });

    await upsertById(tx.fiscalDocument, ids.fiscalNfeShow, {
      type: 'NFSE',
      status: 'AUTORIZADO',
      number: 588,
      series: 1,
      accessKey: '23261005922101000133560010000005881029481923',
      protocol: '223260001928471',
      totalAmount: '185000.00',
      xmlUrl: 'https://iss.fortaleza.ce.gov.br/nfse/xml/588',
      danfeUrl: 'https://iss.fortaleza.ce.gov.br/nfse/danfse/588',
      issuedAt: dayOffset(-3),
      serviceOrderId: ids.osIracemaReveillon,
    });

    // -------------------------------------------------------------------------
    // 14. GUIA DE TRÁFEGO MILITAR - SFPC / 10ª RM (Compliance & Regulatório)
    // -------------------------------------------------------------------------
    await upsertById(tx.trafficGuide, ids.trafficGuideIracema, {
      number: 'GT-10RM-2026/00142',
      fiscalDocumentId: ids.fiscalNfeShow,
      serviceOrderId: ids.osIracemaReveillon,
      sourceMagazineId: ids.magazineCentral,
      status: 'EMITIDA',
      validFrom: dayOffset(64),
      validUntil: dayOffset(67),
      originCity: 'Fortaleza',
      originState: 'CE',
      destinationCity: 'Fortaleza',
      destinationState: 'CE',
      routeDescription: 'Partida do Paiol Central São João (Av. Waldir Diogo) -> Av. Godofredo Maciel -> Av. Aguanambi -> Av. Historiador Raimundo Girão (Aterro Praia de Iracema)',
      vehiclePlate: 'PNB-8A20',
      vehiclePlateState: 'CE',
      vehicleModel: 'Ford Cargo 816 Baú Isotérmico Homologado ANTT Produtos Perigosos',
      driverName: 'Francisco Chagas de Castro',
      driverCpf: validCpf('345892110'),
      driverLicense: '04589211029',
      hasMopp: true,
      blasterId: ids.blasterEncarregado,
      totalNeqKg: '42.6000',
      notes: 'Transporte de Artigos Pirotécnicos Classe 1.3G para Queima de Fogos Réveillon Oficial de Fortaleza.',
      issuedAt: now,
    });

    await upsertById(tx.trafficGuideItem, ids.gtItemIracema1, {
      trafficGuideId: ids.trafficGuideIracema,
      productId: ids.prodBat100t,
      productLotId: ids.lotBat100t,
      quantity: '20.00',
      neqGrams: '19000.0000',
      unNumber: 'UN 0336',
      riskClass: '1.3G',
    });

    await upsertById(tx.trafficGuideItem, ids.gtItemIracema2, {
      trafficGuideId: ids.trafficGuideIracema,
      productId: ids.prodMort4in,
      productLotId: ids.lotMort4in,
      quantity: '40.00',
      neqGrams: '12800.0000',
      unNumber: 'UN 0336',
      riskClass: '1.3G',
    });

    // -------------------------------------------------------------------------
    // 15. GESTÃO FINANCEIRA (Contas a Receber, Pagar, Parcelamento e PIX)
    // -------------------------------------------------------------------------
    // Venda Beach Park com recebimento PIX parcial
    await upsertById(tx.financialEntry, ids.finReceivableVenda, {
      direction: 'RECEBER',
      description: 'Venda NF-e 1042 - Beach Park Hotéis e Turismo',
      category: 'VENDA_PRODUTOS',
      counterparty: 'BEACH PARK HOTÉIS E TURISMO S/A',
      customerId: ids.customerBeachPark,
      saleId: ids.saleBeachPark,
      amount: '2720.00',
      creditedAmount: '1500.00',
      dueDate: dayOffset(15),
      status: 'PARCIAL',
      reference: 'VENDA-BEACH-PARK-001',
      pixTxId: 'PIX-SJ-20261026-9481920',
      pixQrCode: '00020126580014br.gov.bcb.pix01140592210100013352040000530398654071500.005802BR5925CASA DE FOGOS SAO JOAO6009FORTALEZA62190515PIX-SJ-94819206304D1A4',
      pixExpiresAt: dayOffset(15),
    });

    await upsertById(tx.financialPayment, ids.finPaymentPixVenda, {
      entryId: ids.finReceivableVenda,
      amount: '1500.00',
      method: 'PIX',
      occurredAt: dayOffset(-1),
      reference: 'E05922101202610261530A8B7C9D0E1F',
      reconciled: true,
      reconciledAt: now,
      notes: 'Entrada confirmada via PIX dinâmico Banco do Brasil',
    });

    // Contrato Réveillon de Fortaleza: Entrada (Parcela 1/2) + Saldo pós-evento (Parcela 2/2)
    await upsertById(tx.financialEntry, ids.finReceivableShowP1, {
      direction: 'RECEBER',
      description: 'Contrato Show Réveillon Iracema 2027 (Parcela 1/2 - Sinal Técnico)',
      category: 'SHOW_PIROTECNICO',
      counterparty: 'MUNICÍPIO DE FORTALEZA - SECRETARIA DE TURISMO',
      customerId: ids.customerPrefeitura,
      serviceOrderId: ids.osIracemaReveillon,
      amount: '92500.00',
      creditedAmount: '92500.00',
      dueDate: dayOffset(10),
      status: 'PAGO',
      reference: 'CONTRATO-SETFOR-2026-088-P1',
      installmentNumber: 1,
      installmentCount: 2,
      installmentGroup: 'GRP-SHOW-IRACEMA-2027',
    });

    await upsertById(tx.financialPayment, ids.finPaymentShowP1, {
      entryId: ids.finReceivableShowP1,
      amount: '92500.00',
      method: 'TRANSFERENCIA',
      occurredAt: dayOffset(-2),
      reference: 'TED-BANCO-DO-BRASIL-94821',
      reconciled: true,
      reconciledAt: now,
      notes: 'Ordem bancária Município de Fortaleza',
    });

    await upsertById(tx.financialEntry, ids.finReceivableShowP2, {
      direction: 'RECEBER',
      description: 'Contrato Show Réveillon Iracema 2027 (Parcela 2/2 - Execução e ART)',
      category: 'SHOW_PIROTECNICO',
      counterparty: 'MUNICÍPIO DE FORTALEZA - SECRETARIA DE TURISMO',
      customerId: ids.customerPrefeitura,
      amount: '92500.00',
      creditedAmount: '0.00',
      dueDate: dayOffset(75),
      status: 'ABERTO',
      reference: 'CONTRATO-SETFOR-2026-088-P2',
      installmentNumber: 2,
      installmentCount: 2,
      installmentGroup: 'GRP-SHOW-IRACEMA-2027',
    });

    // Contas a Pagar: Compra de Matéria-Prima Pirobrás
    await upsertById(tx.financialEntry, ids.finPayablePirobras, {
      direction: 'PAGAR',
      description: 'Fatura Duplicata 019230/1 - Pirobrás Artigos Pirotécnicos',
      category: 'FORNECEDOR_PRODUTOS',
      counterparty: 'PIROBRÁS ARTIGOS PIROTÉCNICOS S/A',
      supplierId: ids.supplierPirobras,
      amount: '3250.00',
      creditedAmount: '0.00',
      dueDate: dayOffset(20),
      status: 'ABERTO',
      reference: 'DUP-PIROBRAS-019230',
    });
  });

  console.info('================================================================');
  console.info('   SEED PROFISSIONAL APLICADO COM SUCESSO - SISPIRO ERP         ');
  console.info('================================================================');
  console.info('EMPRESA: CASA DE FOGOS SÃO JOÃO LTDA');
  console.info(`CNPJ: ${companyCnpj} | Fortaleza - CE (SFPC / 10ª RM)`);
  console.info('Logradouro: AV WALDIR DIOGO, 1028-1030, Novo Mondubim, CEP 60764-020');
  console.info('Site Oficial: www.casadefogossaojoao.com');
  console.info('----------------------------------------------------------------');
  console.info('USUÁRIOS DE ACESSO PROVISIONADOS:');
  console.info('  1. admin@casadefogossaojoao.com (Administrador Geral)');
  console.info('  2. comercial@casadefogossaojoao.com (Gerente Comercial)');
  console.info('  3. operacoes@casadefogossaojoao.com (Coordenação de Shows/Blasters)');
  console.info('  4. estoque@casadefogossaojoao.com (Fiel do Paiol)');
  console.info('  5. financeiro@casadefogossaojoao.com (Controladoria Financeira)');
  console.info('  6. demo.admin@local.test (Admin de Compatibilidade Local)');
  console.info('SENHA PADRÃO: DEV_SEED_ADMIN_PASSWORD configurada no .env');
  console.info('================================================================');
} finally {
  await prisma.$disconnect();
}
