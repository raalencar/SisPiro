import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialDirection,
  Prisma,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { CloseServiceOrderDto } from '../service-orders.dto.js';
import {
  auditServiceOrder,
  dateOnly,
  lockLots,
  lockOrder,
  serializeServiceOrder,
} from './service-orders.common.js';

export async function closeOrderInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  dto: CloseServiceOrderDto,
) {
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
  if (order.status !== ServiceOrderStatus.EM_MONTAGEM) {
    throw new ConflictException(
      'Somente uma OS em montagem pode receber o relatório de queima.',
    );
  }
  if (!order.contractedAmount || order.contractedAmount.lte(0)) {
    throw new ConflictException(
      'A OS não possui valor contratado. Cancele-a e crie uma nova OS com o valor informado.',
    );
  }
  if (dto.items.length !== order.items.length) {
    throw new BadRequestException(
      'O relatório deve informar a quantidade disparada de cada item da OS.',
    );
  }
  const reportByItem = new Map(
    dto.items.map((item) => [item.itemId, item]),
  );
  const itemIds = new Set(order.items.map((item) => item.id));
  if (dto.items.some((item) => !itemIds.has(item.itemId))) {
    throw new BadRequestException(
      'O relatório contém item que não pertence à OS.',
    );
  }

  const lotIds = [
    ...new Set(order.items.map((item) => item.productLotId)),
  ].sort();
  await lockLots(tx, lotIds);
  const totalsByLot = new Map<string, Prisma.Decimal>();
  for (const item of order.items) {
    const report = reportByItem.get(item.id)!;
    const fired = new Prisma.Decimal(report.firedQuantity);
    if (fired.gt(item.plannedQuantity)) {
      throw new ConflictException(
        'A quantidade disparada não pode exceder a quantidade reservada.',
      );
    }
    totalsByLot.set(
      item.productLotId,
      (totalsByLot.get(item.productLotId) ?? new Prisma.Decimal(0)).plus(
        fired,
      ),
    );
  }

  const lots = await tx.productLot.findMany({
    where: { id: { in: lotIds } },
    include: { product: true },
  });
  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  for (const [lotId, fired] of totalsByLot) {
    const lot = lotById.get(lotId);
    if (!lot) {
      throw new NotFoundException('Lote da OS não encontrado.');
    }
    if (lot.quantity.lt(fired)) {
      throw new ConflictException(
        `Saldo físico insuficiente para registrar a queima do lote ${lot.lotNumber}.`,
      );
    }
    if (fired.gt(0)) {
      const movement = await tx.stockMovement.create({
        data: {
          type: StockMovementType.SAIDA,
          productLotId: lot.id,
          quantity: fired,
          sourceMagazineId: lot.magazineId,
          reference: `OS-${order.code}`,
        },
      });
      await tx.productLot.update({
        where: { id: lot.id },
        data: { quantity: lot.quantity.minus(fired) },
      });
      await auditServiceOrder(
        tx,
        'service-order.material-consumed',
        id,
        undefined,
        {
          orderCode: order.code,
          productLotId: lot.id,
          quantity: fired.toString(),
          neqKg: fired.mul(lot.product.neqGrams).div(1000).toString(),
          movementId: movement.id,
        },
      );
    }
  }

  for (const item of order.items) {
    await tx.serviceOrderItem.update({
      where: { id: item.id },
      data: {
        firedQuantity: new Prisma.Decimal(
          reportByItem.get(item.id)!.firedQuantity,
        ),
      },
    });
  }
  const updated = await tx.serviceOrder.update({
    where: { id },
    data: { status: ServiceOrderStatus.EXECUTADO },
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
    'service-order.executed',
    id,
    {
      status: order.status,
    },
    {
      status: updated.status,
      reportNotes: dto.reportNotes?.trim() ?? null,
      firedItems: dto.items.map((item) => ({
        itemId: item.itemId,
        quantity: item.firedQuantity,
      })),
      unusedReservationsReleased: true,
    },
  );
  const financialEntry = await tx.financialEntry.create({
    data: {
      direction: FinancialDirection.RECEBER,
      description: `Ordem de serviço ${order.code}`,
      category: 'SERVICO_PIROTECNICO',
      counterparty: order.customer.legalName,
      customerId: order.customerId,
      serviceOrderId: order.id,
      amount: order.contractedAmount,
      dueDate: dateOnly(dto.dueDate),
      reference: `OS-${order.code}`,
    },
  });
  await createAuditLog(tx, {
    data: {
      action: 'finance.entry.created',
      aggregateType: 'FinancialEntry',
      aggregateId: financialEntry.id,
      after: {
        code: financialEntry.code,
        direction: financialEntry.direction,
        amount: financialEntry.amount.toString(),
        dueDate: dto.dueDate,
        category: financialEntry.category,
        customerId: financialEntry.customerId,
        serviceOrderId: order.id,
      },
    },
  });
  return {
    ...serializeServiceOrder(updated),
    financialEntry: {
      id: financialEntry.id,
      code: financialEntry.code,
      amount: financialEntry.amount.toString(),
      dueDate: dto.dueDate,
      status: financialEntry.status,
    },
  };
}
