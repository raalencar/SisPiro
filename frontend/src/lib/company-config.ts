/**
 * Configurações Corporativas Oficiais do SisPiro ERP
 * Dados da Empresa Emitente / Operadora de Produtos Controlados pelo Exército (PCE)
 */

export interface CompanyConfig {
  legalName: string;
  tradeName: string;
  taxId: string; // CNPJ
  stateRegistration: string; // Inscrição Estadual
  crNumber: string; // Certificado de Registro Militar (DFPC/SFPC)
  crRegion: string; // Região Militar
  addressStreet: string;
  addressNumber: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
  fullAddress: string;
  website: string;
  email: string;
  phone: string;
}

export const COMPANY_CONFIG: CompanyConfig = {
  legalName:
    process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || "CASA DE FOGOS SAO JOAO LTDA",
  tradeName:
    process.env.NEXT_PUBLIC_COMPANY_TRADE_NAME || "Casa de Fogos São João",
  taxId:
    process.env.NEXT_PUBLIC_COMPANY_TAX_ID || "05.922.101/0001-33",
  stateRegistration:
    process.env.NEXT_PUBLIC_COMPANY_STATE_REG || "06.123.456-7",
  crNumber:
    process.env.NEXT_PUBLIC_COMPANY_CR || "CR 102030 - 10ª RM / SFPC",
  crRegion:
    process.env.NEXT_PUBLIC_COMPANY_CR_REGION || "10ª Região Militar (CE/PI)",
  addressStreet:
    process.env.NEXT_PUBLIC_COMPANY_STREET || "Av. Waldir Diogo",
  addressNumber:
    process.env.NEXT_PUBLIC_COMPANY_NUMBER || "1028-1030",
  addressDistrict:
    process.env.NEXT_PUBLIC_COMPANY_DISTRICT || "Novo Mondubim",
  addressCity:
    process.env.NEXT_PUBLIC_COMPANY_CITY || "Fortaleza",
  addressState:
    process.env.NEXT_PUBLIC_COMPANY_STATE || "CE",
  addressZipCode:
    process.env.NEXT_PUBLIC_COMPANY_ZIP || "60764-020",
  fullAddress:
    process.env.NEXT_PUBLIC_COMPANY_FULL_ADDRESS ||
    "Av. Waldir Diogo, 1028-1030, Novo Mondubim — Fortaleza/CE — CEP 60764-020",
  website:
    process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "www.casadefogossaojoao.com",
  email:
    process.env.NEXT_PUBLIC_COMPANY_EMAIL || "contato@casadefogossaojoao.com",
  phone:
    process.env.NEXT_PUBLIC_COMPANY_PHONE || "(85) 3298-1020",
};
