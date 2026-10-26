import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrafficGuidesService } from './traffic-guides.service.js';
import { TrafficGuideStatus, FiscalDocumentStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TrafficGuidesService', () => {
  let service: TrafficGuidesService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      trafficGuide: {
        count: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      magazine: {
        findUnique: vi.fn(),
      },
      productLot: {
        findUnique: vi.fn(),
      },
      blaster: {
        findUnique: vi.fn(),
      },
      fiscalDocument: {
        findUnique: vi.fn(),
      },
      serviceOrder: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    };

    service = new TrafficGuidesService(prismaMock as any);
  });

  describe('create', () => {
    it('deve emitir Guia de Tráfego com sucesso e calcular a massa NEQ total dos produtos', async () => {
      const now = new Date();
      const validFrom = new Date(now.getTime() + 1000 * 60).toISOString();
      const validUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();

      prismaMock.trafficGuide.count.mockResolvedValue(0);
      prismaMock.magazine.findUnique.mockResolvedValue({
        id: 'mag-1',
        name: 'Paiol Central SP',
        active: true,
      });

      prismaMock.productLot.findUnique.mockResolvedValue({
        id: 'lot-1',
        magazineId: 'mag-1',
        lotNumber: 'LT-2026-001',
        quantity: 100,
        product: {
          id: 'prod-1',
          name: 'Bomba 3 Polegadas',
          neqGrams: 250, // 250 gramas por unidade
          riskClass: '1.3G',
        },
      });

      prismaMock.blaster.findUnique.mockResolvedValue({
        id: 'blaster-1',
        name: 'Manoel Blaster',
        licenseNumber: 'BL-999',
        licenseExpiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30), // Válido por 30 dias
        active: true,
      });

      prismaMock.trafficGuide.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'gt-1',
          ...args.data,
        }),
      );

      const result = await service.create({
        sourceMagazineId: 'mag-1',
        validFrom,
        validUntil,
        originCity: 'Ribeirão Preto',
        originState: 'SP',
        destinationCity: 'Campinas',
        destinationState: 'SP',
        routeDescription: 'SP-330 Rodovia Anhanguera',
        vehiclePlate: 'ABC1D23',
        vehiclePlateState: 'SP',
        driverName: 'Antônio Motorista',
        driverCpf: '111.222.333-44',
        driverLicense: '99887766',
        blasterId: 'blaster-1',
        items: [
          {
            productId: 'prod-1',
            productLotId: 'lot-1',
            quantity: 10, // 10 un * 250g = 2500g = 2.5 kg NEQ
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.number).toBe(`GT-${new Date().getFullYear()}/0001`);
      expect(Number(result.totalNeqKg)).toBe(2.5);
      expect(result.status).toBe(TrafficGuideStatus.EMITIDA);
    });

    it('deve rejeitar emissão se a carteira do Blaster vencer antes do término da viagem', async () => {
      const now = new Date();
      const validFrom = new Date(now.getTime() + 1000 * 60).toISOString();
      const validUntil = new Date(now.getTime() + 1000 * 60 * 60 * 48).toISOString(); // 48h

      prismaMock.magazine.findUnique.mockResolvedValue({ id: 'mag-1', active: true });
      prismaMock.blaster.findUnique.mockResolvedValue({
        id: 'blaster-1',
        name: 'Blaster Vencido',
        licenseNumber: 'BL-EXP',
        licenseExpiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24), // Vence em 24h
        active: true,
      });

      await expect(
        service.create({
          sourceMagazineId: 'mag-1',
          validFrom,
          validUntil,
          originCity: 'SP',
          originState: 'SP',
          destinationCity: 'RJ',
          destinationState: 'RJ',
          routeDescription: 'Dutra',
          vehiclePlate: 'ABC1234',
          vehiclePlateState: 'SP',
          driverName: 'João',
          driverCpf: '11122233344',
          driverLicense: '123456',
          blasterId: 'blaster-1',
          items: [{ productId: 'p1', productLotId: 'l1', quantity: 5 }],
        }),
      ).rejects.toThrow('A carteira funcional do Blaster (BL-EXP) vence antes do término do trânsito autorizado.');
    });

    it('deve rejeitar lote que pertence a outro paiol diferente da origem', async () => {
      const now = new Date();
      const validFrom = new Date(now.getTime() + 1000 * 60).toISOString();
      const validUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString();

      prismaMock.magazine.findUnique.mockResolvedValue({ id: 'mag-origem', active: true });
      prismaMock.productLot.findUnique.mockResolvedValue({
        id: 'lot-outro-paiol',
        magazineId: 'mag-diferente',
        lotNumber: 'LT-OUTRO',
        quantity: 50,
        product: { neqGrams: 10 },
      });

      await expect(
        service.create({
          sourceMagazineId: 'mag-origem',
          validFrom,
          validUntil,
          originCity: 'SP',
          originState: 'SP',
          destinationCity: 'Campinas',
          destinationState: 'SP',
          routeDescription: 'Bandeirantes',
          vehiclePlate: 'ABC1234',
          vehiclePlateState: 'SP',
          driverName: 'João',
          driverCpf: '11122233344',
          driverLicense: '123456',
          items: [{ productId: 'p1', productLotId: 'lot-outro-paiol', quantity: 5 }],
        }),
      ).rejects.toThrow('O lote "LT-OUTRO" pertence a outro paiol e não ao paiol de origem selecionado.');
    });
  });

  describe('updateStatus', () => {
    it('deve atualizar o status para EM_TRANSITO', async () => {
      const mockGuide = {
        id: 'gt-1',
        number: 'GT-2026/0001',
        status: TrafficGuideStatus.EMITIDA,
        notes: null,
      };

      prismaMock.trafficGuide.findUnique.mockResolvedValue(mockGuide);
      prismaMock.trafficGuide.update.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockGuide,
          ...args.data,
        }),
      );

      const result = await service.updateStatus('gt-1', {
        status: TrafficGuideStatus.EM_TRANSITO,
      });

      expect(result.status).toBe(TrafficGuideStatus.EM_TRANSITO);
    });

    it('deve exigir justificativa de no mínimo 10 caracteres para cancelar a GT', async () => {
      const mockGuide = {
        id: 'gt-2',
        number: 'GT-2026/0002',
        status: TrafficGuideStatus.EMITIDA,
      };

      prismaMock.trafficGuide.findUnique.mockResolvedValue(mockGuide);

      await expect(
        service.updateStatus('gt-2', {
          status: TrafficGuideStatus.CANCELADA,
          reason: 'Curto',
        }),
      ).rejects.toThrow('O cancelamento de Guia de Tráfego militar exige justificativa de no mínimo 10 caracteres.');
    });
  });
});
