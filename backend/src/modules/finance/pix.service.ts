import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinancialDirection, FinancialEntryStatus, FinancialPaymentMethod } from '@prisma/client';
import QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service.js';

export interface PixPayloadData {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
}

export interface GeneratedPixResponse {
  entryId: string;
  txid: string;
  amount: number;
  copyPasteCode: string;
  qrCodeDataUrl: string;
  expiresAt: string;
}

@Injectable()
export class PixService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
   * exigido pela especificação BACEN BR Code / EMVCo.
   */
  calculateCrc16(payload: string): string {
    const polynomial = 0x1021;
    let crc = 0xffff;

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ polynomial) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Formata campo TLV (Tag-Length-Value)
   */
  private formatTlv(id: string, value: string): string {
    const length = value.length.toString().padStart(2, '0');
    return `${id}${length}${value}`;
  }

  /**
   * Normaliza textos para o padrão EMVCo (sem acentos e caracteres especiais)
   */
  private normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9 ]/g, '')
      .toUpperCase()
      .trim();
  }

  /**
   * Monta a string do payload BR Code (copia-e-cola)
   */
  buildEmvCoPayload(data: PixPayloadData): string {
    // 00: Payload Format Indicator
    let payload = this.formatTlv('00', '01');

    // 01: Point of Initiation Method (12 = dinâmico / valor pré-definido)
    payload += this.formatTlv('01', '12');

    // 26: Merchant Account Information - PIX
    const gui = this.formatTlv('00', 'br.gov.bcb.pix');
    const key = this.formatTlv('01', data.key.trim());
    let mai = gui + key;
    if (data.description) {
      mai += this.formatTlv('02', this.normalizeString(data.description).slice(0, 40));
    }
    payload += this.formatTlv('26', mai);

    // 52: Merchant Category Code (0000 = padrão)
    payload += this.formatTlv('52', '0000');

    // 53: Transaction Currency (986 = BRL)
    payload += this.formatTlv('53', '986');

    // 54: Transaction Amount
    payload += this.formatTlv('54', data.amount.toFixed(2));

    // 58: Country Code
    payload += this.formatTlv('58', 'BR');

    // 59: Merchant Name (máx 25 caracteres)
    const merchantName = this.normalizeString(data.merchantName).slice(0, 25);
    payload += this.formatTlv('59', merchantName);

    // 60: Merchant City (máx 15 caracteres)
    const merchantCity = this.normalizeString(data.merchantCity).slice(0, 15);
    payload += this.formatTlv('60', merchantCity);

    // 62: Additional Data Field (txid máx 25 caracteres)
    const cleanTxId = data.txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
    const txidTlv = this.formatTlv('05', cleanTxId);
    payload += this.formatTlv('62', txidTlv);

    // 63: CRC16 com ID '63' e tamanho '04'
    const payloadForCrc = payload + '6304';
    const crc = this.calculateCrc16(payloadForCrc);

    return payloadForCrc + crc;
  }

  /**
   * Gera QR Code PIX para um título a receber
   */
  async generatePixForEntry(
    entryId: string,
    options?: {
      pixKey?: string;
      merchantName?: string;
      merchantCity?: string;
      expiresInHours?: number;
    },
  ): Promise<GeneratedPixResponse> {
    const entry = await this.prisma.financialEntry.findUnique({
      where: { id: entryId },
      include: {
        payments: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }

    if (entry.direction !== FinancialDirection.RECEBER) {
      throw new BadRequestException('Apenas títulos a receber podem gerar cobrança PIX.');
    }

    if (
      entry.status === FinancialEntryStatus.PAGO ||
      entry.status === FinancialEntryStatus.COMPENSADO ||
      entry.status === FinancialEntryStatus.CANCELADO
    ) {
      throw new ConflictException('Lançamento já liquidado ou cancelado.');
    }

    // Calcula saldo restante
    const paid = entry.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const remaining = Number(entry.amount) - Number(entry.creditedAmount) - paid;

    if (remaining <= 0) {
      throw new ConflictException('Não há saldo pendente para cobrança neste lançamento.');
    }

    // Gera txid único padronizado (alfanumérico)
    const cleanCode = entry.code.toString().padStart(6, '0');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const txid = `SPP${cleanCode}${Date.now().toString().slice(-6)}${randomSuffix}`.slice(0, 25);

    const pixKey = options?.pixKey?.trim() || process.env.PIX_DEFAULT_KEY || '12345678000190';
    const merchantName = options?.merchantName?.trim() || 'CASA DE FOGOS ESPERANCA';
    const merchantCity = options?.merchantCity?.trim() || 'SAO PAULO';
    const expiresInHours = options?.expiresInHours ?? 24;

    const copyPasteCode = this.buildEmvCoPayload({
      key: pixKey,
      merchantName,
      merchantCity,
      amount: remaining,
      txid,
      description: `Titulo ${entry.code}`,
    });

    // Gera QR Code em Data URL
    const qrCodeDataUrl = await QRCode.toDataURL(copyPasteCode, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000);

    // Salva no registro financeiro
    await this.prisma.financialEntry.update({
      where: { id: entryId },
      data: {
        pixTxId: txid,
        pixQrCode: copyPasteCode,
        pixExpiresAt: expiresAt,
      },
    });

    return {
      entryId: entry.id,
      txid,
      amount: Number(remaining.toFixed(2)),
      copyPasteCode,
      qrCodeDataUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Processa Webhook de liquidação bancária automática (ex: Mercado Pago, Asaas, Itaú, Banco Central)
   */
  async processWebhook(dto: {
    txid: string;
    amount: number;
    paidAt?: string;
    e2eId?: string;
  }) {
    if (!dto.txid) {
      throw new BadRequestException('txid é obrigatório.');
    }

    const entry = await this.prisma.financialEntry.findFirst({
      where: { pixTxId: dto.txid },
      include: { payments: true },
    });

    if (!entry) {
      throw new NotFoundException(`Nenhum lançamento encontrado para o txid: ${dto.txid}`);
    }

    if (
      entry.status === FinancialEntryStatus.PAGO ||
      entry.status === FinancialEntryStatus.COMPENSADO
    ) {
      return {
        status: 'ALREADY_PAID',
        entryId: entry.id,
        message: 'Lançamento já se encontra liquidado.',
      };
    }

    const paidAmount = Number(dto.amount);
    if (isNaN(paidAmount) || paidAmount <= 0) {
      throw new BadRequestException('Valor pago inválido no webhook.');
    }

    const occurredAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    // Executa liquidação via transação atômica
    const result = await this.prisma.$transaction(async (tx) => {
      // Bloqueio pessimista da linha
      await tx.$queryRaw`
        SELECT "id" FROM "lancamentos_financeiros"
        WHERE "id" = ${entry.id}::uuid
        FOR UPDATE
      `;

      const currentPaid = entry.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );

      // Cria o registro do pagamento PIX
      const payment = await tx.financialPayment.create({
        data: {
          entryId: entry.id,
          amount: paidAmount,
          method: FinancialPaymentMethod.PIX,
          occurredAt,
          reference: dto.e2eId || dto.txid,
          reconciled: true,
          reconciledAt: new Date(),
          bankFitId: dto.e2eId || dto.txid,
          notes: 'Liquidação automática via Webhook PIX',
        },
      });

      const nextPaid = currentPaid + paidAmount;
      const nextRemaining = Number(entry.amount) - Number(entry.creditedAmount) - nextPaid;

      const nextStatus =
        nextRemaining <= 0.001
          ? FinancialEntryStatus.PAGO
          : FinancialEntryStatus.PARCIAL;

      const updated = await tx.financialEntry.update({
        where: { id: entry.id },
        data: { status: nextStatus },
      });

      return {
        payment,
        entry: updated,
      };
    });

    return {
      status: 'LIQUIDATED',
      entryId: entry.id,
      paymentId: result.payment.id,
      newStatus: result.entry.status,
      paidAmount,
      occurredAt: occurredAt.toISOString(),
    };
  }
}
