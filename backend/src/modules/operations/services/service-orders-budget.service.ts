import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductLotStatus,
  ProductType,
  ServiceOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreateServiceOrderDto,
  UpdateServiceOrderDto,
} from '../service-orders.dto.js';
import {
  auditServiceOrder,
  lockOrder,
  serializeServiceOrder,
} from './service-orders.common.js';

@Injectable()
export class ServiceOrdersBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateServiceOrderDto) {
    if (new Date(dto.eventAt).getTime() < Date.now()) {
      throw new BadRequestException('A data do evento deve estar no futuro.');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    if (!customer.active) {
      throw new ConflictException('Cliente inativo não pode receber nova OS.');
    }
    const lotIds = dto.items.map((item) => item.productLotId);
    if (new Set(lotIds).size !== lotIds.length) {
      throw new BadRequestException(
        'Informe cada lote uma única vez na OS; consolide as quantidades por lote.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true, magazine: true },
      });
      if (lots.length !== lotIds.length) {
        throw new NotFoundException('Um ou mais lotes informados não existem.');
      }
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      for (const item of dto.items) {
        const lot = lotById.get(item.productLotId)!;
        if (lot.status !== ProductLotStatus.DISPONIVEL) {
          throw new ConflictException(
            `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser orçado para Ordem de Serviço.`,
          );
        }
        if (lot.productId !== item.productId) {
          throw new BadRequestException(
            'O produto informado não corresponde ao produto do lote.',
          );
        }
        if (lot.product.type === ProductType.SERVICO) {
          throw new BadRequestException(
            'Itens de OS precisam referenciar produtos com lote de estoque.',
          );
        }
      }

      const order = await tx.serviceOrder.create({
        data: {
          customerId: dto.customerId,
          contractedAmount: new Prisma.Decimal(dto.contractedAmount),
          eventAt: new Date(dto.eventAt),
          eventLocation: dto.eventLocation.trim(),
          status: ServiceOrderStatus.ORCAMENTO,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              productLotId: item.productLotId,
              plannedQuantity: new Prisma.Decimal(item.plannedQuantity),
            })),
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              productLot: { include: { magazine: true } },
            },
          },
        },
      });
      await auditServiceOrder(tx, 'service-order.created', order.id, undefined, {
        code: order.code,
        customerId: order.customerId,
        contractedAmount: order.contractedAmount?.toString() ?? null,
        eventAt: order.eventAt.toISOString(),
        itemCount: order.items.length,
        status: order.status,
      });
      return serializeServiceOrder(order);
    });
  }

  async update(id: string, dto: UpdateServiceOrderDto) {
    if (new Date(dto.eventAt).getTime() < Date.now()) {
      throw new BadRequestException('A data do evento deve estar no futuro.');
    }
    const lotIds = dto.items.map((item) => item.productLotId);
    if (new Set(lotIds).size !== lotIds.length) {
      throw new BadRequestException(
        'Informe cada lote uma única vez na OS; consolide as quantidades por lote.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (order.status !== ServiceOrderStatus.ORCAMENTO) {
        throw new ConflictException(
          'Somente ordens de serviço em orçamento podem ser editadas.',
        );
      }

      const targetCustomerId = dto.customerId ?? order.customerId;
      const customer = await tx.customer.findUnique({
        where: { id: targetCustomerId },
      });
      if (!customer) {
        throw new NotFoundException('Cliente não encontrado.');
      }
      if (!customer.active) {
        throw new ConflictException('Cliente inativo não pode receber OS.');
      }

      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true },
      });
      if (lots.length !== lotIds.length) {
        throw new NotFoundException('Um ou mais lotes informados não existem.');
      }
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      for (const item of dto.items) {
        const lot = lotById.get(item.productLotId)!;
        if (lot.status !== ProductLotStatus.DISPONIVEL) {
          throw new ConflictException(
            `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser utilizado em Ordem de Serviço.`,
          );
        }
        if (lot.productId !== item.productId) {
          throw new BadRequestException(
            'O produto informado não corresponde ao produto do lote.',
          );
        }
        if (lot.product.type === ProductType.SERVICO) {
          throw new BadRequestException(
            'Itens de OS precisam referenciar produtos com lote de estoque.',
          );
        }
      }

      await tx.serviceOrderItem.deleteMany({
        where: { serviceOrderId: id },
      });

      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          customerId: targetCustomerId,
          contractedAmount: new Prisma.Decimal(dto.contractedAmount),
          eventAt: new Date(dto.eventAt),
          eventLocation: dto.eventLocation.trim(),
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              productLotId: item.productLotId,
              plannedQuantity: new Prisma.Decimal(item.plannedQuantity),
            })),
          },
        },
        include: {
          customer: true,
          responsibleBlaster: true,
          items: {
            include: {
              product: true,
              productLot: { include: { magazine: true } },
            },
          },
        },
      });

      await auditServiceOrder(
        tx,
        'service-order.updated',
        id,
        {
          customerId: order.customerId,
          contractedAmount: order.contractedAmount?.toString() ?? null,
          eventAt: order.eventAt.toISOString(),
          eventLocation: order.eventLocation,
          itemCount: order.items.length,
        },
        {
          customerId: updated.customerId,
          contractedAmount: updated.contractedAmount?.toString() ?? null,
          eventAt: updated.eventAt.toISOString(),
          eventLocation: updated.eventLocation,
          itemCount: updated.items.length,
        },
      );

      return serializeServiceOrder(updated);
    });
  }
}
