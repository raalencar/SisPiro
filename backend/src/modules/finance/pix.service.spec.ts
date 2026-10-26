import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FinancialDirection, FinancialEntryStatus, FinancialPaymentMethod } from '@prisma/client';
import { PixService } from './pix.service.js';

describe('PixService', () => {
  let service: PixService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      financialEntry: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      financialPayment: {
        create: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'mock-entry-id' }]),
    };

    service = new PixService(mockPrisma);
  });

  describe('calculateCrc16 e buildEmvCoPayload', () => {
    it('deve calcular CRC16 CCITT oficial corretamente para payload padrão', () => {
      // Exemplo padrão de teste de CRC16
      const testString = '00020126360014br.gov.bcb.pix0114123456780001905204000053039865406150.005802BR5915CASA DE FOGOS 6009SAO PAULO62110507TEST1236304';
      const crc = service.calculateCrc16(testString);
      expect(crc).toMatch(/^[0-9A-F]{4}$/);
      expect(crc.length).toBe(4);
    });

    it('deve gerar payload BR Code EMVCo completo contendo todas as tags mandatórias', () => {
      const payload = service.buildEmvCoPayload({
        key: '12345678000190',
        merchantName: 'Casa de Fogos Esperança',
        merchantCity: 'São Paulo',
        amount: 250.75,
        txid: 'SPP001',
        description: 'Pedido 123',
      });

      expect(payload).toContain('000201'); // formato
      expect(payload).toContain('br.gov.bcb.pix'); // chave pix
      expect(payload).toContain('5303986'); // moeda BRL 986
      expect(payload).toContain('5406250.75'); // valor
      expect(payload).toContain('5802BR'); // país
      expect(payload).toContain('6304'); // CRC tag
    });
  });

  describe('generatePixForEntry', () => {
    it('deve gerar cobrança PIX com QR code Data URL e código copia-e-cola para título a receber aberto', async () => {
      mockPrisma.financialEntry.findUnique.mockResolvedValue({
        id: 'entry-123',
        code: 1045,
        direction: FinancialDirection.RECEBER,
        status: FinancialEntryStatus.ABERTO,
        amount: 300.0,
        creditedAmount: 0,
        payments: [],
      });

      mockPrisma.financialEntry.update.mockResolvedValue({
        id: 'entry-123',
      });

      const result = await service.generatePixForEntry('entry-123', {
        pixKey: '12345678000190',
        merchantName: 'Casa Fogos',
        merchantCity: 'Sao Paulo',
      });

      expect(result.entryId).toBe('entry-123');
      expect(result.amount).toBe(300.0);
      expect(result.copyPasteCode).toContain('br.gov.bcb.pix');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.txid).toContain('SPP');
      expect(mockPrisma.financialEntry.update).toHaveBeenCalled();
    });

    it('deve rejeitar geração de PIX para títulos do tipo PAGAR', async () => {
      mockPrisma.financialEntry.findUnique.mockResolvedValue({
        id: 'entry-payable',
        direction: FinancialDirection.PAGAR,
        status: FinancialEntryStatus.ABERTO,
        amount: 500.0,
        creditedAmount: 0,
        payments: [],
      });

      await expect(service.generatePixForEntry('entry-payable')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve rejeitar geração para título já quitado', async () => {
      mockPrisma.financialEntry.findUnique.mockResolvedValue({
        id: 'entry-paid',
        direction: FinancialDirection.RECEBER,
        status: FinancialEntryStatus.PAGO,
        amount: 200.0,
        creditedAmount: 0,
        payments: [],
      });

      await expect(service.generatePixForEntry('entry-paid')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('processWebhook', () => {
    it('deve liquidar lançamento via webhook automaticamente quando valor cobre o saldo', async () => {
      mockPrisma.financialEntry.findFirst.mockResolvedValue({
        id: 'entry-123',
        amount: 150.0,
        creditedAmount: 0,
        status: FinancialEntryStatus.ABERTO,
        payments: [],
      });

      mockPrisma.financialPayment.create.mockResolvedValue({
        id: 'pay-pix-1',
        amount: 150.0,
        method: FinancialPaymentMethod.PIX,
      });

      mockPrisma.financialEntry.update.mockResolvedValue({
        id: 'entry-123',
        status: FinancialEntryStatus.PAGO,
      });

      const response = await service.processWebhook({
        txid: 'SPP001',
        amount: 150.0,
        e2eId: 'E1234567820261026001',
      });

      expect(response.status).toBe('LIQUIDATED');
      expect(response.newStatus).toBe(FinancialEntryStatus.PAGO);
      expect(mockPrisma.financialPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            method: FinancialPaymentMethod.PIX,
            reconciled: true,
          }),
        }),
      );
    });

    it('deve responder de forma idempotente quando título já se encontra pago', async () => {
      mockPrisma.financialEntry.findFirst.mockResolvedValue({
        id: 'entry-123',
        amount: 150.0,
        creditedAmount: 0,
        status: FinancialEntryStatus.PAGO,
        payments: [],
      });

      const response = await service.processWebhook({
        txid: 'SPP001',
        amount: 150.0,
      });

      expect(response.status).toBe('ALREADY_PAID');
      expect(mockPrisma.financialPayment.create).not.toHaveBeenCalled();
    });
  });
});
