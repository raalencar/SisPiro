import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ProductLotStatus,
  SalesQuoteStatus,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import {
  ActivePromotionItem,
  assertCustomerActive,
  assertCustomerCanPurchasePce,
  assertNotExpired,
  assertPriceListActive,
  lockLots,
} from '../commercial.common.js';
import { CreateSaleDto } from '../commercial.dto.js';
import { ProductPromotionsService } from './product-promotions.service.js';

export interface PreparedSaleContext {
  lotById: Map<string, any>;
  saleLines: Array<{
    productId: string;
    productLotId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  }>;
  priceList: any;
  customer: any;
  total: Prisma.Decimal;
}

export async function validateAndBuildSaleLines(
  tx: Prisma.TransactionClient,
  dto: CreateSaleDto,
  promotionsService: ProductPromotionsService,
  quote?: {
    id: string;
    items: Array<{
      productId: string;
      productLotId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }>;
  },
): Promise<PreparedSaleContext> {
  const lotIds = dto.items.map((item) => item.productLotId).sort();
  await lockLots(tx, lotIds);

  const [priceList, lots, customer] = await Promise.all([
    tx.priceList.findUnique({
      where: { id: dto.priceListId },
      include: { items: true },
    }),
    tx.productLot.findMany({
      where: { id: { in: lotIds } },
      include: { product: true },
    }),
    dto.customerId
      ? tx.customer.findUnique({ where: { id: dto.customerId } })
      : Promise.resolve(null),
  ]);

  if (!priceList) {
    throw new NotFoundException('Tabela de preço não encontrada.');
  }
  if (!quote) {
    assertPriceListActive(priceList);
  }
  assertCustomerActive(customer, dto.customerId);
  if (lots.length !== lotIds.length) {
    throw new NotFoundException('Um ou mais lotes não foram encontrados.');
  }

  const lotById = new Map(lots.map((lot) => [lot.id, lot]));
  const priceByProduct = new Map(
    priceList.items.map((item) => [item.productId, item.unitPrice]),
  );
  const promotionsByProduct = quote
    ? new Map<string, ActivePromotionItem>()
    : await promotionsService.getActivePromotionalPrices(
        tx,
        lots.map((lot) => lot.productId),
      );
  const quotedItemByLot = new Map(
    quote?.items.map((item) => [item.productLotId, item]),
  );

  const saleLines: Array<{
    productId: string;
    productLotId: string;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  }> = [];
  const pceClasses = new Set<string>();

  for (const item of dto.items) {
    const lot = lotById.get(item.productLotId)!;
    const quotedItem = quotedItemByLot.get(lot.id);
    const unitPrice =
      quotedItem?.productId === lot.productId
        ? quotedItem.unitPrice
        : quote
          ? undefined
          : promotionsService.resolveUnitPrice(
              priceByProduct.get(lot.productId),
              promotionsByProduct.get(lot.productId),
            );

    if (!unitPrice) {
      throw new ConflictException(
        `Produto ${lot.product.name} não possui preço nesta tabela.`,
      );
    }
    if (lot.status !== ProductLotStatus.DISPONIVEL) {
      throw new ConflictException(
        `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser vendido.`,
      );
    }
    assertNotExpired(lot.expiresAt);
    if (lot.product.isPce) {
      if (!lot.product.riskClass) {
        throw new ConflictException(
          `Produto PCE ${lot.product.name} sem classe de risco não pode ser vendido.`,
        );
      }
      pceClasses.add(lot.product.riskClass);
    }

    const quantity = new Prisma.Decimal(item.quantity);
    const reserved = await tx.serviceOrderItem.aggregate({
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
    const reservedQuantity =
      reserved._sum.plannedQuantity ?? new Prisma.Decimal(0);

    const activeQuoteReservations = await tx.salesQuoteItem.aggregate({
      where: {
        productLotId: lot.id,
        quote: {
          status: SalesQuoteStatus.EMITIDO,
          expiresAt: { gt: new Date() },
          ...(quote ? { id: { not: quote.id } } : {}),
        },
      },
      _sum: { quantity: true },
    });
    const salesQuotesReserved =
      activeQuoteReservations._sum.quantity ?? new Prisma.Decimal(0);
    const totalReserved = reservedQuantity.plus(salesQuotesReserved);
    const available = lot.quantity.minus(totalReserved);

    if (available.lt(quantity)) {
      throw new ConflictException({
        message: `Estoque disponível insuficiente para venda do lote ${lot.lotNumber}.`,
        lotId: lot.id,
        physicalQuantity: lot.quantity.toString(),
        alreadyReserved: totalReserved.toString(),
        requested: quantity.toString(),
        available: available.toString(),
      });
    }

    saleLines.push({
      productId: lot.productId,
      productLotId: lot.id,
      quantity,
      unitPrice,
      subtotal:
        quotedItem?.subtotal ?? unitPrice.mul(quantity).toDecimalPlaces(2),
    });
  }

  assertCustomerCanPurchasePce(customer, pceClasses);

  const total = saleLines.reduce(
    (sum, line) => sum.plus(line.subtotal),
    new Prisma.Decimal(0),
  );

  return {
    lotById,
    saleLines,
    priceList,
    customer,
    total,
  };
}

export async function recordSaleStockMovements(
  tx: Prisma.TransactionClient,
  saleCode: string | number,
  saleLines: Array<{
    productLotId: string;
    quantity: Prisma.Decimal;
  }>,
  lotById: Map<string, any>,
) {
  for (const line of saleLines) {
    const lot = lotById.get(line.productLotId)!;
    const nextQuantity = lot.quantity.minus(line.quantity);
    const movement = await tx.stockMovement.create({
      data: {
        type: StockMovementType.SAIDA,
        productLotId: lot.id,
        quantity: line.quantity,
        sourceMagazineId: lot.magazineId,
        reference: `VENDA-${saleCode}`,
      },
    });
    await tx.productLot.update({
      where: { id: lot.id },
      data: { quantity: nextQuantity },
    });
    await createAuditLog(tx, {
      data: {
        action: 'inventory.movement.saida',
        aggregateType: 'ProductLot',
        aggregateId: lot.id,
        before: { quantity: lot.quantity.toString() },
        after: {
          quantity: nextQuantity.toString(),
          movementId: movement.id,
          reference: `VENDA-${saleCode}`,
        },
      },
    });
  }
}
