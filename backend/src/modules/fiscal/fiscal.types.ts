import { FiscalDocumentStatus } from '@prisma/client';

export interface FiscalItemData {
  code: string;
  description: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface FiscalRecipientData {
  taxId: string;
  legalName: string;
  tradeName?: string;
  email?: string;
  hasCr?: boolean;
  crNumber?: string;
}

export interface NFeEmissionData {
  number: number;
  series: number;
  recipient: FiscalRecipientData;
  items: FiscalItemData[];
  totalAmount: number;
  natureOfOperation: string;
  notes?: string;
}

export interface NFCeEmissionData {
  number: number;
  series: number;
  recipient?: Partial<FiscalRecipientData>;
  items: FiscalItemData[];
  totalAmount: number;
  paymentMethod: string;
}

export interface NFSeEmissionData {
  number: number;
  series: number;
  recipient: FiscalRecipientData;
  serviceDescription: string;
  totalAmount: number;
  issRate?: number;
  eventLocation?: string;
  artNumber?: string;
  blasterName?: string;
}

export interface FiscalEmissionResult {
  accessKey?: string;
  protocol?: string;
  number: number;
  series: number;
  status: FiscalDocumentStatus;
  issuedAt: Date;
  xmlUrl?: string;
  danfeUrl?: string;
  errorMessage?: string;
}

export interface CancelDocumentData {
  accessKey: string;
  protocol?: string;
  reason: string;
}

export interface FiscalCancelResult {
  status: FiscalDocumentStatus;
  cancelledAt: Date;
  protocol?: string;
  errorMessage?: string;
}

export interface FiscalGateway {
  emitNFe(data: NFeEmissionData): Promise<FiscalEmissionResult>;
  emitNFCe(data: NFCeEmissionData): Promise<FiscalEmissionResult>;
  emitNFSe(data: NFSeEmissionData): Promise<FiscalEmissionResult>;
  cancelDocument(data: CancelDocumentData): Promise<FiscalCancelResult>;
}

export const FISCAL_GATEWAY = Symbol('FISCAL_GATEWAY');
