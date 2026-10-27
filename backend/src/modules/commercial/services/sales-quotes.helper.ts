import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductLotStatus,
  SalesQuoteStatus,
  ServiceOrderStatus,
} from '@prisma/client';
import {
  assertCustomerActive,
  assertCustomerCanPurchasePce,
  assertNotExpired,
  assertPriceListActive,
  effectiveQuoteStatus,
  withEffectiveQuoteStatus,
} from '../commercial.common.js';
import { createAuditLog } from '../../../common/audit-log.js';
import { ProductPromotionsService } from './product-promotions.service.js';

export interface PreparedQuoteData {
  quoteLines: Array<{
    productId: string;
    productLotId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  }>;
  total: Prisma.Decimal;
  customer: any;
  priceList: any;
}

export async function prepareQuoteItemsAndTotal(
  tx: Prisma.TransactionClient,
  promotionsService: ProductPromotionsService,
  params: {
    items: Array<{ productLotId: string; quantity: number | string }>;
    priceListId: string;
    customerId?: string | null;
    excludeQuoteId?: string;
  },
): Promise<PreparedQuoteData> {
  const lotIds = params.items.map((item) => item.productLotId);
  const [priceList, lots, customer] = await Promise.all([
    tx.priceList.findUnique({
      where: { id: params.priceListId },
      include: { items: true },
    }),
    tx.productLot.findMany({
      where: { id: { in: lotIds } },
      include: { product: true },
    }),
    params.customerId
      ? tx.customer.findUnique({ where: { id: params.customerId } })
      : Promise.resolve(null),
  ]);

  if (!priceList) {
    throw new NotFoundException('Tabela de preço não encontrada.');
  }
  assertPriceListActive(priceList);
  assertCustomerActive(customer, params.customerId ?? undefined);
  if (lots.length !== lotIds.length) {
    throw new NotFoundException('Um ou mais lotes não foram encontrados.');
  }

  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const priceByProduct = new Map(
    priceList.items.map((item) => [item.productId, item.unitPrice]),
  );
  const now = new Date();
  const promotionPriceByProduct =
    await promotionsService.getActivePromotionalPrices(
      tx,
      lots.map((lot) => lot.productId),
      now,
    );

  const pceClasses = new Set<string>();
  const quoteLines: Array<{
    productId: string;
    productLotId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  }> = [];

  for (const item of params.items) {
    const lot = lotById.get(item.productLotId)!;
    const unitPrice = promotionsService.resolveUnitPrice(
      priceByProduct.get(lot.productId),
      promotionPriceByProduct.get(lot.productId),
    );
    if (!unitPrice) {
      throw new ConflictException(
        `Produto ${lot.product.name} não possui preço nesta tabela.`,
      );
    }
    if (lot.status !== ProductLotStatus.DISPONIVEL) {
      throw new ConflictException(
        `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser orçado.`,
      );
    }
    assertNotExpired(lot.expiresAt);
    if (lot.product.isPce) {
      if (!lot.product.riskClass) {
        throw new ConflictException(
          `Produto PCE ${lot.product.name} sem classe de risco não pode ser orçado.`,
        );
      }
      pceClasses.add(lot.product.riskClass);
    }

    const quantity = new Prisma.Decimal(item.quantity);
    const serviceReservations = await tx.serviceOrderItem.aggregate({
      where: {
        productLotId: lot.id,
        serviceOrder: {
          status: {
            in: [ServiceOrderStatus.APROVADO, ServiceOrderStatus.EM_MONTAGEM],
          },
        },
      },
      _sum: { plannedQuantity: true },
    });
    const quoteReservations = await tx.salesQuoteItem.aggregate({
      where: {
        productLotId: lot.id,
        quote: {
          ...(params.excludeQuoteId ? { id: { not: params.excludeQuoteId } } : {}),
          status: SalesQuoteStatus.EMITIDO,
          expiresAt: { gt: now },
        },
      },
      _sum: { quantity: true },
    });

    const serviceReserved =
      serviceReservations._sum.plannedQuantity ?? new Prisma.Decimal(0);
    const quoteReserved =
      quoteReservations._sum.quantity ?? new Prisma.Decimal(0);
    const reserved = serviceReserved.plus(quoteReserved);
    const available = lot.quantity.minus(reserved);
    if (available.lt(quantity)) {
      throw new ConflictException({
        message: `Estoque disponível insuficiente para orçar o lote ${lot.lotNumber}.`,
        lotId: lot.id,
        physicalQuantity: lot.quantity.toString(),
        alreadyReserved: reserved.toString(),
        requested: quantity.toString(),
        available: available.toString(),
      });
    }

    quoteLines.push({
      productId: lot.productId,
      productLotId: lot.id,
      quantity,
      unitPrice,
      subtotal: unitPrice.mul(quantity).toDecimalPlaces(2),
    });
  }

  assertCustomerCanPurchasePce(customer, pceClasses);
  const total = quoteLines.reduce(
    (sum, line) => sum.plus(line.subtotal),
    new Prisma.Decimal(0),
  );

  return {
    quoteLines,
    total,
    customer,
    priceList,
  };
}

export async function cancelQuoteInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "orcamentos_venda" WHERE "id" = ${id}::uuid FOR UPDATE
  `;
  if (!rows.length) {
    throw new NotFoundException('Orçamento comercial não encontrado.');
  }
  const quote = await tx.salesQuote.findUnique({ where: { id } });
  if (!quote) {
    throw new NotFoundException('Orçamento comercial não encontrado.');
  }
  const currentEffectiveStatus = effectiveQuoteStatus(quote);
  if (currentEffectiveStatus !== SalesQuoteStatus.EMITIDO) {
    throw new ConflictException(
      'Somente orçamentos emitidos e dentro da validade podem ser cancelados.',
    );
  }
  const cancelled = await tx.salesQuote.update({
    where: { id },
    data: {
      status: SalesQuoteStatus.CANCELADO,
      cancelledAt: new Date(),
    },
    include: {
      customer: true,
      priceList: true,
      items: { include: { product: true, productLot: true } },
    },
  });
  await createAuditLog(tx, {
    data: {
      action: 'sales-quote.cancelled',
      aggregateType: 'SalesQuote',
      aggregateId: id,
      before: { status: quote.status },
      after: { status: cancelled.status },
    },
  });
  return withEffectiveQuoteStatus(cancelled);
}

