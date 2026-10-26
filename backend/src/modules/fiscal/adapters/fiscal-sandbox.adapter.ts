import { Injectable, Logger } from '@nestjs/common';
import {
  FiscalGateway,
  NFeEmissionData,
  NFCeEmissionData,
  NFSeEmissionData,
  CancelDocumentData,
  FiscalEmissionResult,
  FiscalCancelResult,
} from '../fiscal.types.js';
import { FiscalDocumentStatus } from '@prisma/client';

@Injectable()
export class FiscalSandboxAdapter implements FiscalGateway {
  private readonly logger = new Logger(FiscalSandboxAdapter.name);

  // Calcula o dígito verificador módulo 11 conforme manual de integração da SEFAZ
  private calculateCheckDigit(key43: string): number {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    let sum = 0;
    let weightIndex = 0;

    for (let i = key43.length - 1; i >= 0; i--) {
      sum += parseInt(key43[i], 10) * weights[weightIndex];
      weightIndex = (weightIndex + 1) % weights.length;
    }

    const remainder = sum % 11;
    const dv = 11 - remainder;
    return dv >= 10 ? 0 : dv;
  }

  // Gera chave de acesso no padrão SEFAZ de 44 dígitos
  private generateAccessKey(model: '55' | '65', series: number, number: number): string {
    const uf = '35'; // SP padrão
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const cnpj = '12345678000195'; // CNPJ Emitente SisPiro
    const serieStr = String(series).padStart(3, '0');
    const numStr = String(number).padStart(9, '0');
    const tpEmis = '1'; // Emissão normal
    const cNF = String(Math.floor(10000000 + Math.random() * 90000000)); // Código numérico aleatório de 8 dígitos

    const key43 = `${uf}${yy}${mm}${cnpj}${model}${serieStr}${numStr}${tpEmis}${cNF}`;
    const dv = this.calculateCheckDigit(key43);
    return `${key43}${dv}`;
  }

  async emitNFe(data: NFeEmissionData): Promise<FiscalEmissionResult> {
    this.logger.log(`[SANDBOX] Emitindo NF-e Modelo 55 - Nº ${data.number}, Série ${data.series} para ${data.recipient.legalName}`);

    const accessKey = this.generateAccessKey('55', data.series, data.number);
    const protocol = `135${Date.now().toString().slice(-12)}`;

    return {
      status: FiscalDocumentStatus.AUTORIZADO,
      number: data.number,
      series: data.series,
      accessKey,
      protocol,
      issuedAt: new Date(),
      danfeUrl: `https://sandbox.sefaz.gov.br/danfe/view/${accessKey}`,
      xmlUrl: `https://sandbox.sefaz.gov.br/xml/download/${accessKey}.xml`,
    };
  }

  async emitNFCe(data: NFCeEmissionData): Promise<FiscalEmissionResult> {
    this.logger.log(`[SANDBOX] Emitindo NFC-e Modelo 65 - Nº ${data.number}, Série ${data.series}`);

    const accessKey = this.generateAccessKey('65', data.series, data.number);
    const protocol = `135${Date.now().toString().slice(-12)}`;

    return {
      status: FiscalDocumentStatus.AUTORIZADO,
      number: data.number,
      series: data.series,
      accessKey,
      protocol,
      issuedAt: new Date(),
      danfeUrl: `https://sandbox.sefaz.gov.br/danfce/view/${accessKey}`,
      xmlUrl: `https://sandbox.sefaz.gov.br/xml/download/${accessKey}.xml`,
    };
  }

  async emitNFSe(data: NFSeEmissionData): Promise<FiscalEmissionResult> {
    this.logger.log(`[SANDBOX] Emitindo NFS-e de Serviços Pirotécnicos - Nº ${data.number}, Tomador: ${data.recipient.legalName}`);

    const protocol = `NFSE-${Date.now()}`;
    const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    return {
      status: FiscalDocumentStatus.AUTORIZADO,
      number: data.number,
      series: data.series,
      accessKey: verificationCode,
      protocol,
      issuedAt: new Date(),
      danfeUrl: `https://prefeitura.gov.br/nfse/impressao/${verificationCode}`,
      xmlUrl: `https://prefeitura.gov.br/nfse/xml/${verificationCode}.xml`,
    };
  }

  async cancelDocument(data: CancelDocumentData): Promise<FiscalCancelResult> {
    this.logger.log(`[SANDBOX] Cancelando documento fiscal com chave ${data.accessKey}. Justificativa: "${data.reason}"`);

    const protocol = `135${Date.now().toString().slice(-12)}`;
    return {
      status: FiscalDocumentStatus.CANCELADO,
      cancelledAt: new Date(),
      protocol,
    };
  }
}
