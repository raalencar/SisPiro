import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductLotStatus,
  SalesQuoteStatus,
  ServiceOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { CustomersService } from '../../commercial/customers.service.js';
import { BlastersService } from '../blasters.service.js';
import {
  ApproveServiceOrderDto,
  CancelServiceOrderDto,
  CloseServiceOrderDto,
} from '../service-orders.dto.js';
import {
  assertMagazineCanStore,
  assertNotExpired,
  auditServiceOrder,
  lockLots,
  lockOrder,
  RESERVED_STATUSES,
  serializeServiceOrder,
} from './service-orders.common.js';
import { ServiceOrdersQueryService } from './service-orders-query.service.js';
import { closeOrderInTransaction } from './service-orders-close.helper.js';

@Injectable()
export class ServiceOrdersLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: ServiceOrdersQueryService,
    private readonly customers: CustomersService,
    private readonly blasters: BlastersService,
  ) {}

  async approve(id: string, dto: ApproveServiceOrderDto) {
    const summary = await this.queryService.get(id);
    const blasterEligibility = await this.blasters.checkEligibility(
      dto.responsibleBlasterId,
      { eventAt: summary.eventAt.toISOString() },
    );
    if (!blasterEligibility.eligible) {
      throw new ConflictException({
        message: 'Blaster não está habilitado para a data do evento.',
        reasons: blasterEligibility.reasons,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({
        where: { id },
        include: {
          customer: true,
          items: { include: { product: true, productLot: true } },
        },
      });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (order.status !== ServiceOrderStatus.ORCAMENTO) {
        throw new ConflictException(
          'Somente uma OS em orçamento pode ser aprovada.',
        );
      }
      if (!order.customer.active) {
        throw new ConflictException('Cliente inativo não pode aprovar a OS.');
      }
      const pceClasses = [
        ...new Set(
          order.items
            .filter((item) => item.product.isPce)
            .map((item) => item.product.riskClass!)
            .filter(Boolean),
        ),
      ];
      if (pceClasses.length > 0) {
        const eligibility = await this.customers.checkPceEligibility(
          order.customerId,
          { classes: pceClasses },
        );
        if (!eligibility.eligible) {
          throw new ConflictException({
            message: 'Cliente não está autorizado para os PCE desta OS.',
            reasons: eligibility.reasons,
          });
        }
      }

      const lotIds = order.items.map((item) => item.productLotId).sort();
      await lockLots(tx, lotIds);
      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true, magazine: true },
      });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));

      for (const item of order.items) {
        const lot = lotById.get(item.productLotId);
        if (!lot) {
          throw new NotFoundException('Lote reservado não encontrado.');
        }
        if (lot.productId !== item.productId) {
          throw new ConflictException('O produto do lote foi alterado.');
        }
        if (lot.status !== ProductLotStatus.DISPONIVEL) {
          throw new ConflictException(
            `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser reservado para Ordem de Serviço.`,
          );
        }
        assertNotExpired(lot.expiresAt);
        assertMagazineCanStore(lot.magazine);
        const activeReservations = await tx.serviceOrderItem.aggregate({
          where: {
            productLotId: lot.id,
            serviceOrderId: { not: order.id },
            serviceOrder: { status: { in: RESERVED_STATUSES } },
          },
          _sum: { plannedQuantity: true },
        });
        const reserved =
          activeReservations._sum.plannedQuantity ?? new Prisma.Decimal(0);
        const activeSalesQuotes = await tx.salesQuoteItem.aggregate({
          where: {
            productLotId: lot.id,
            quote: {
              status: SalesQuoteStatus.EMITIDO,
              expiresAt: { gt: new Date() },
            },
          },
          _sum: { quantity: true },
        });
        const quoteReserved =
          activeSalesQuotes._sum.quantity ?? new Prisma.Decimal(0);
        const totalReserved = reserved.plus(quoteReserved);
        const available = lot.quantity.minus(totalReserved);
        if (available.lt(item.plannedQuantity)) {
          throw new ConflictException({
            message: `Estoque disponível insuficiente para o lote ${lot.lotNumber}.`,
            lotId: lot.id,
            physicalQuantity: lot.quantity.toString(),
            alreadyReserved: totalReserved.toString(),
            requested: item.plannedQuantity.toString(),
            available: available.toString(),
          });
        }
      }

      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.APROVADO,
          responsibleBlasterId: dto.responsibleBlasterId,
          artNumber: dto.artNumber?.trim() || null,
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
        'service-order.approved',
        id,
        {
          status: order.status,
        },
        {
          status: updated.status,
          responsibleBlasterId: updated.responsibleBlasterId,
          artNumber: updated.artNumber,
          reservedItems: updated.items.map((item) => ({
            itemId: item.id,
            productLotId: item.productLotId,
            quantity: item.plannedQuantity.toString(),
          })),
        },
      );
      return serializeServiceOrder(updated);
    });
  }

  async start(id: string) {
    const summary = await this.queryService.get(id);
    if (!summary.responsibleBlasterId) {
      throw new ConflictException(
        'A OS precisa de blaster responsável antes de iniciar.',
      );
    }
    const eligibility = await this.blasters.checkEligibility(
      summary.responsibleBlasterId,
      { eventAt: summary.eventAt.toISOString() },
    );
    if (!eligibility.eligible) {
      throw new ConflictException({
        message: 'Blaster não está habilitado para iniciar esta OS.',
        reasons: eligibility.reasons,
      });
    }
    return this.transition(
      id,
      ServiceOrderStatus.APROVADO,
      ServiceOrderStatus.EM_MONTAGEM,
    );
  }

  async cancel(id: string, dto?: CancelServiceOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (
        order.status !== ServiceOrderStatus.ORCAMENTO &&
        order.status !== ServiceOrderStatus.APROVADO &&
        order.status !== ServiceOrderStatus.EM_MONTAGEM
      ) {
        throw new ConflictException(
          'Somente OS em orçamento, aprovada ou em montagem podem ser canceladas.',
        );
      }
      const hadReservation = RESERVED_STATUSES.includes(order.status);
      if (hadReservation && order.items.length > 0) {
        const lotIds = order.items.map((item) => item.productLotId);
        await lockLots(tx, lotIds);
      }
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.CANCELADO,
        },
      });
      await auditServiceOrder(
        tx,
        'service-order.cancelled',
        id,
        { status: order.status },
        {
          status: updated.status,
          reservationsReleased: hadReservation,
          reason: dto?.reason?.trim() ?? null,
        },
      );
      return updated;
    });
  }

  async close(id: string, dto: CloseServiceOrderDto) {
    return this.prisma.$transaction((tx) =>
      closeOrderInTransaction(tx, id, dto),
    );
  }

  private async transition(
    id: string,
    expected: ServiceOrderStatus,
    next: ServiceOrderStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({ where: { id } });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (order.status !== expected) {
        throw new ConflictException(
          `Transição inválida: a OS precisa estar em ${expected}.`,
        );
      }
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: next },
      });
      await auditServiceOrder(
        tx,
        'service-order.started',
        id,
        { status: expected },
        { status: next },
      );
      return updated;
    });
  }
}
