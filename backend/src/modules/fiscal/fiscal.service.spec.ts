import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FiscalService } from './fiscal.service.js';
import { FiscalSandboxAdapter } from './adapters/fiscal-sandbox.adapter.js';
import { FiscalDocumentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('FiscalService', () => {
  let service: FiscalService;
  let sandboxAdapter: FiscalSandboxAdapter;
  let prismaMock: any;

  beforeEach(() => {
    sandboxAdapter = new FiscalSandboxAdapter();
    prismaMock = {
      fiscalDocument: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      sale: {
        findUnique: vi.fn(),
      },
      serviceOrder: {
        findUnique: vi.fn(),
      },
    };

    service = new FiscalService(prismaMock as any, sandboxAdapter);
  });

  describe('emitSaleNFe', () => {
    it('deve emitir NF-e com sucesso gerando chave de 44 dígitos e protocolo SEFAZ', async () => {
      const mockSale = {
        id: 'sale-1',
        code: 101,
        total: 1500.0,
        customer: {
          taxId: '12345678909',
          legalName: 'Cliente Pirotecnia Show',
          crNumber: 'CR-12345',
        },
        items: [
          {
            product: { code: 'FOG-001', name: 'Morteiro 2 Polegadas' },
            quantity: 10,
            unitPrice: 150.0,
            subtotal: 1500.0,
          },
        ],
      };

      prismaMock.sale.findUnique.mockResolvedValue(mockSale);
      prismaMock.fiscalDocument.findFirst.mockResolvedValue(null); // Nenhum doc emitido ainda
      prismaMock.fiscalDocument.create.mockImplementation((args: any) => Promise.resolve({
        id: 'doc-1',
        ...args.data,
      }));

      const result = await service.emitSaleNFe({ saleId: 'sale-1' });

      expect(result).toBeDefined();
      expect(result.status).toBe(FiscalDocumentStatus.AUTORIZADO);
      expect(result.number).toBe(1);
      expect(result.accessKey).toHaveLength(44);
      expect(result.accessKey).toMatch(/^\d{44}$/); // Apenas dígitos
      expect(result.protocol).toMatch(/^135/);
      expect(prismaMock.fiscalDocument.create).toHaveBeenCalledOnce();
    });

    it('deve rejeitar emissão de NF-e se a venda não possuir cliente identificado', async () => {
      const mockSale = {
        id: 'sale-2',
        code: 102,
        total: 200.0,
        customer: null,
        items: [],
      };

      prismaMock.sale.findUnique.mockResolvedValue(mockSale);

      await expect(service.emitSaleNFe({ saleId: 'sale-2' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve rejeitar emissão duplicada se a venda já possuir NF-e autorizada', async () => {
      const mockSale = {
        id: 'sale-3',
        code: 103,
        total: 300.0,
        customer: { taxId: '11122233344', legalName: 'Show Fest' },
        items: [],
      };

      prismaMock.sale.findUnique.mockResolvedValue(mockSale);
      prismaMock.fiscalDocument.findFirst.mockResolvedValue({
        id: 'doc-existente',
        number: 45,
        status: FiscalDocumentStatus.AUTORIZADO,
      });

      await expect(service.emitSaleNFe({ saleId: 'sale-3' })).rejects.toThrow(
        'Esta venda já possui a NF-e nº 45 autorizada.',
      );
    });
  });

  describe('cancelDocument', () => {
    it('deve cancelar documento fiscal autorizado com justificativa válida', async () => {
      const mockDoc = {
        id: 'doc-10',
        number: 88,
        status: FiscalDocumentStatus.AUTORIZADO,
        accessKey: '35261012345678000195550010000000881123456789',
        protocol: '135123456789012',
      };

      prismaMock.fiscalDocument.findUnique.mockResolvedValue(mockDoc);
      prismaMock.fiscalDocument.update.mockImplementation((args: any) => Promise.resolve({
        ...mockDoc,
        ...args.data,
      }));

      const result = await service.cancelDocument('doc-10', {
        reason: 'Desistência do comprador antes do carregamento da mercadoria',
      });

      expect(result.status).toBe(FiscalDocumentStatus.CANCELADO);
      expect(result.cancelReason).toBe('Desistência do comprador antes do carregamento da mercadoria');
      expect(prismaMock.fiscalDocument.update).toHaveBeenCalledOnce();
    });

    it('deve rejeitar cancelamento de documento que já está cancelado', async () => {
      const mockDoc = {
        id: 'doc-11',
        number: 89,
        status: FiscalDocumentStatus.CANCELADO,
        accessKey: '35261012345678000195550010000000881123456789',
      };

      prismaMock.fiscalDocument.findUnique.mockResolvedValue(mockDoc);

      await expect(
        service.cancelDocument('doc-11', {
          reason: 'Cancelamento duplicado indevido',
        }),
      ).rejects.toThrow('Este documento fiscal já se encontra cancelado.');
    });
  });
});
