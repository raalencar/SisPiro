import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateTrafficGuideDto,
  UpdateTrafficGuideStatusDto,
  TrafficGuidesQueryDto,
} from './traffic-guides.dto.js';
import { TrafficGuideStatus, FiscalDocumentStatus, Prisma } from '@prisma/client';

@Injectable()
export class TrafficGuidesService {
  private readonly logger = new Logger(TrafficGuidesService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async generateNextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.trafficGuide.count({
      where: {
        number: { startsWith: `GT-${year}/` },
      },
    });
    const nextSeq = String(count + 1).padStart(4, '0');
    return `GT-${year}/${nextSeq}`;
  }

  async create(dto: CreateTrafficGuideDto) {
    const validFrom = new Date(dto.validFrom);
    const validUntil = new Date(dto.validUntil);

    if (validUntil <= validFrom) {
      throw new BadRequestException('A data limite de trânsito (validUntil) deve ser posterior ao início da viagem (validFrom).');
    }

    // 1. Validação do Paiol de Origem
    const sourceMagazine = await this.prisma.magazine.findUnique({
      where: { id: dto.sourceMagazineId },
    });
    if (!sourceMagazine) {
      throw new NotFoundException(`Paiol de origem #${dto.sourceMagazineId} não encontrado.`);
    }
    if (!sourceMagazine.active) {
      throw new BadRequestException(`O paiol de origem "${sourceMagazine.name}" encontra-se inativo.`);
    }

    // 2. Validação de Documento Fiscal (se informado)
    if (dto.fiscalDocumentId) {
      const fiscalDoc = await this.prisma.fiscalDocument.findUnique({
        where: { id: dto.fiscalDocumentId },
      });
      if (!fiscalDoc) {
        throw new NotFoundException(`Documento fiscal #${dto.fiscalDocumentId} não encontrado.`);
      }
      if (fiscalDoc.status !== FiscalDocumentStatus.AUTORIZADO) {
        throw new BadRequestException(`A Guia de Tráfego só pode ser vinculada a documentos fiscais autorizados. Status atual: ${fiscalDoc.status}.`);
      }
    }

    // 3. Validação de Ordem de Serviço (se informada)
    if (dto.serviceOrderId) {
      const os = await this.prisma.serviceOrder.findUnique({
        where: { id: dto.serviceOrderId },
      });
      if (!os) {
        throw new NotFoundException(`Ordem de Serviço #${dto.serviceOrderId} não encontrada.`);
      }
    }

    // 4. Validação do Blaster Responsável (se informado)
    if (dto.blasterId) {
      const blaster = await this.prisma.blaster.findUnique({
        where: { id: dto.blasterId },
      });
      if (!blaster) {
        throw new NotFoundException(`Blaster #${dto.blasterId} não encontrado.`);
      }
      if (!blaster.active) {
        throw new BadRequestException(`O blaster "${blaster.name}" está inativo.`);
      }
      if (new Date(blaster.licenseExpiresAt) < validUntil) {
        throw new BadRequestException(
          `A carteira funcional do Blaster (${blaster.licenseNumber}) vence antes do término do trânsito autorizado.`,
        );
      }
    }

    // 5. Validação dos Itens e Cálculo da Massa NEQ Total
    let totalNeqKg = 0;
    const validatedItems: Array<{
      productId: string;
      productLotId: string;
      quantity: number;
      neqGrams: number;
      unNumber: string;
      riskClass: string;
    }> = [];

    for (const item of dto.items) {
      const lot = await this.prisma.productLot.findUnique({
        where: { id: item.productLotId },
        include: { product: true },
      });

      if (!lot) {
        throw new NotFoundException(`Lote #${item.productLotId} não encontrado.`);
      }
      if (lot.magazineId !== dto.sourceMagazineId) {
        throw new BadRequestException(
          `O lote "${lot.lotNumber}" pertence a outro paiol e não ao paiol de origem selecionado.`,
        );
      }
      if (Number(lot.quantity) < item.quantity) {
        throw new BadRequestException(
          `Saldo insuficiente no lote "${lot.lotNumber}". Disponível: ${lot.quantity}, Solicitado: ${item.quantity}.`,
        );
      }

      const productNeqGrams = Number(lot.product.neqGrams || 0);
      const itemTotalNeqGrams = productNeqGrams * item.quantity;
      totalNeqKg += itemTotalNeqGrams / 1000;

      validatedItems.push({
        productId: item.productId,
        productLotId: item.productLotId,
        quantity: item.quantity,
        neqGrams: itemTotalNeqGrams,
        unNumber: item.unNumber || 'UN 0336',
        riskClass: item.riskClass || lot.product.riskClass || '1.4G',
      });
    }

    const number = await this.generateNextNumber();

    // 6. Persistência Transacional
    const guide = await this.prisma.$transaction(async (tx) => {
      const created = await tx.trafficGuide.create({
        data: {
          number,
          fiscalDocumentId: dto.fiscalDocumentId,
          serviceOrderId: dto.serviceOrderId,
          sourceMagazineId: dto.sourceMagazineId,
          status: TrafficGuideStatus.EMITIDA,
          validFrom,
          validUntil,
          originCity: dto.originCity,
          originState: dto.originState.toUpperCase(),
          destinationCity: dto.destinationCity,
          destinationState: dto.destinationState.toUpperCase(),
          routeDescription: dto.routeDescription,
          vehiclePlate: dto.vehiclePlate.toUpperCase().replace(/[^A-Z0-9]/g, ''),
          vehiclePlateState: dto.vehiclePlateState.toUpperCase(),
          vehicleModel: dto.vehicleModel,
          driverName: dto.driverName,
          driverCpf: dto.driverCpf,
          driverLicense: dto.driverLicense,
          hasMopp: dto.hasMopp ?? true,
          blasterId: dto.blasterId,
          totalNeqKg: new Prisma.Decimal(totalNeqKg),
          notes: dto.notes,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              productLotId: item.productLotId,
              quantity: item.quantity,
              neqGrams: item.neqGrams,
              unNumber: item.unNumber,
              riskClass: item.riskClass,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              productLot: true,
            },
          },
          sourceMagazine: true,
          blaster: true,
          fiscalDocument: true,
          serviceOrder: true,
        },
      });

      return created;
    });

    this.logger.log(`Guia de Tráfego militar #${guide.number} emitida com sucesso. Total NEQ: ${totalNeqKg.toFixed(4)} kg`);
    return guide;
  }

  async updateStatus(id: string, dto: UpdateTrafficGuideStatusDto) {
    const guide = await this.prisma.trafficGuide.findUnique({
      where: { id },
    });

    if (!guide) {
      throw new NotFoundException(`Guia de Tráfego #${id} não encontrada.`);
    }

    if (guide.status === TrafficGuideStatus.CANCELADA) {
      throw new BadRequestException('Esta Guia de Tráfego já se encontra cancelada.');
    }

    if (guide.status === TrafficGuideStatus.CONCLUIDA) {
      throw new BadRequestException('Esta Guia de Tráfego já foi concluída e encerrada.');
    }

    if (dto.status === TrafficGuideStatus.CANCELADA && (!dto.reason || dto.reason.trim().length < 10)) {
      throw new BadRequestException('O cancelamento de Guia de Tráfego militar exige justificativa de no mínimo 10 caracteres.');
    }

    const updated = await this.prisma.trafficGuide.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.reason ? { notes: `${guide.notes ? `${guide.notes} | ` : ''}[Status ${dto.status}]: ${dto.reason}` } : {}),
      },
      include: {
        items: { include: { product: true, productLot: true } },
        sourceMagazine: true,
        blaster: true,
      },
    });

    this.logger.log(`Status da Guia de Tráfego #${guide.number} atualizado para ${dto.status}`);
    return updated;
  }

  async list(query: TrafficGuidesQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TrafficGuideWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.fiscalDocumentId) {
      where.fiscalDocumentId = query.fiscalDocumentId;
    }

    if (query.serviceOrderId) {
      where.serviceOrderId = query.serviceOrderId;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { number: { contains: term, mode: 'insensitive' } },
        { vehiclePlate: { contains: term, mode: 'insensitive' } },
        { driverName: { contains: term, mode: 'insensitive' } },
        { destinationCity: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.trafficGuide.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceMagazine: { select: { name: true } },
          blaster: { select: { name: true, licenseNumber: true } },
          fiscalDocument: { select: { number: true, type: true, accessKey: true } },
          serviceOrder: { select: { code: true, eventLocation: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              productLot: { select: { lotNumber: true } },
            },
          },
        },
      }),
      this.prisma.trafficGuide.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const guide = await this.prisma.trafficGuide.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            productLot: true,
          },
        },
        sourceMagazine: true,
        blaster: true,
        fiscalDocument: {
          include: {
            sale: {
              include: { customer: true },
            },
          },
        },
        serviceOrder: {
          include: { customer: true },
        },
      },
    });

    if (!guide) {
      throw new NotFoundException(`Guia de Tráfego #${id} não encontrada.`);
    }

    return guide;
  }
}
