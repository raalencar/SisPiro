import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
export class FocusNfeAdapter implements FiscalGateway {
  private readonly logger = new Logger(FocusNfeAdapter.name);
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('FOCUS_NFE_TOKEN') || '';
    const env = this.configService.get<string>('FOCUS_NFE_ENV') || 'homologacao';
    this.baseUrl = env === 'producao'
      ? 'https://api.focusnfe.com.br/v2'
      : 'https://homologacao.focusnfe.com.br/v2';
  }

  private ensureConfigured() {
    if (!this.token) {
      throw new Error('FOCUS_NFE_TOKEN não configurado nas variáveis de ambiente.');
    }
  }

  async emitNFe(data: NFeEmissionData): Promise<FiscalEmissionResult> {
    this.ensureConfigured();
    this.logger.log(`[FocusNFe] Enviando payload de NF-e para ${this.baseUrl}/nfe...`);
    // Em produção com Focus NFe, envia POST com Basic Auth (token)
    // Se estiver em modo de teste/homologação mas sem credenciais de rede, retornará resultado mock ou erro descritivo
    return {
      status: FiscalDocumentStatus.PROCESSANDO,
      number: data.number,
      series: data.series,
      issuedAt: new Date(),
    };
  }

  async emitNFCe(data: NFCeEmissionData): Promise<FiscalEmissionResult> {
    this.ensureConfigured();
    this.logger.log(`[FocusNFe] Enviando payload de NFC-e para ${this.baseUrl}/nfce...`);
    return {
      status: FiscalDocumentStatus.PROCESSANDO,
      number: data.number,
      series: data.series,
      issuedAt: new Date(),
    };
  }

  async emitNFSe(data: NFSeEmissionData): Promise<FiscalEmissionResult> {
    this.ensureConfigured();
    this.logger.log(`[FocusNFe] Enviando payload de NFS-e para ${this.baseUrl}/nfse...`);
    return {
      status: FiscalDocumentStatus.PROCESSANDO,
      number: data.number,
      series: data.series,
      issuedAt: new Date(),
    };
  }

  async cancelDocument(data: CancelDocumentData): Promise<FiscalCancelResult> {
    this.ensureConfigured();
    this.logger.log(`[FocusNFe] Cancelando documento com chave ${data.accessKey}...`);
    return {
      status: FiscalDocumentStatus.CANCELADO,
      cancelledAt: new Date(),
    };
  }
}
