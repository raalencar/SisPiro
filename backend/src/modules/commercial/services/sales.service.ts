import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialDirection,
  FinancialEntryStatus,
  Prisma,
  ProductLotStatus,
  SalesQuoteStatus,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  ConvertSalesQuoteDto,
  CreateSaleDto,
  SalesQueryDto,
  SaleSettlementCondition,
} from '../commercial.dto.js';
import {
  ActivePromotionItem,
  assertCustomerActive,
  assertCustomerCanPurchasePce,
  assertNotExpired,
  assertPriceListActive,
  assertSaleSettlement,
  dateOnly,
  effectiveQuoteStatus,
  lockLots,
  paginated,
} from '../commercial.common.js';
import { ProductPromotionsService } from './product-promotions.service.js';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionsService: ProductPromotionsService,
  ) {}

  async listSales(query: SalesQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        include: {
          customer: true,
          priceList: true,
          financialEntry: {
            include: { payments: { orderBy: { occurredAt: 'asc' } } },
          },
          items: { include: { product: true, productLot: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.sale.count(),
    ]);
    return paginated(data, total, query);
  }

  async getSale(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        priceList: true,
        financialEntry: {
          include: { payments: { orderBy: { occurredAt: 'asc' } } },
        },
        items: { include: { product: true, productLot: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }
    return sale;
  }

  async createSale(dto: CreateSaleDto) {
    return this.prisma.$transaction(
      (tx) => this.completeSaleInTransaction(tx, dto),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async convertSalesQuote(id: string, settlement: ConvertSalesQuoteDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "orcamentos_venda" WHERE "id" = ${id}::uuid FOR UPDATE
        `;
        if (!rows.length) {
          throw new NotFoundException('Orçamento comercial não encontrado.');
        }
        const quote = await tx.salesQuote.findUnique({
          where: { id },
          include: { items: true },
        });
        if (!quote) {
          throw new NotFoundException('Orçamento comercial não encontrado.');
        }
        if (effectiveQuoteStatus(quote) !== SalesQuoteStatus.EMITIDO) {
          throw new ConflictException(
            'Somente orçamento emitido e dentro da validade pode ser convertido.',
          );
        }
        const sale = await this.completeSaleInTransaction(
          tx,
          {
            customerId: quote.customerId ?? undefined,
            priceListId: quote.priceListId,
            items: quote.items.map((item) => ({
              productLotId: item.productLotId,
              quantity: item.quantity.toNumber(),
            })),
            condition: settlement.condition,
            paymentMethod: settlement.paymentMethod,
            dueDate: settlement.dueDate,
          },
          quote,
        );
        const convertedAt = new Date();
        const updatedQuote = await tx.salesQuote.update({
          where: { id },
          data: {
            status: SalesQuoteStatus.CONVERTIDO,
            convertedAt,
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'sales-quote.converted',
            aggregateType: 'SalesQuote',
            aggregateId: id,
            before: { status: quote.status },
            after: {
              status: updatedQuote.status,
              saleId: sale.id,
              saleCode: sale.code,
            },
          },
        });
        return { quote: updatedQuote, sale };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async completeSaleInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateSaleDto,
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
  ) {
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
      : await this.promotionsService.getActivePromotionalPrices(
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
            : this.promotionsService.resolveUnitPrice(
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
      (sum, item) => sum.plus(item.subtotal),
      new Prisma.Decimal(0),
    );
    assertSaleSettlement(dto, customer?.id ?? null);
    const sale = await tx.sale.create({
      data: {
        customerId: dto.customerId ?? null,
        priceListId: priceList.id,
        ...(quote ? { quoteId: quote.id } : {}),
        total,
        items: { create: saleLines },
      },
    });
    const dueDate =
      dto.condition === SaleSettlementCondition.IMEDIATO
        ? dateOnly(new Date().toISOString().slice(0, 10))
        : dateOnly(dto.dueDate!);
    const financialEntry = await tx.financialEntry.create({
      data: {
        direction: FinancialDirection.RECEBER,
        description: `Venda ${sale.code}`,
        category: 'VENDA',
        counterparty: customer?.legalName ?? 'Venda de balcão',
        customerId: customer?.id ?? null,
        saleId: sale.id,
        amount: total,
        dueDate,
        status:
          dto.condition === SaleSettlementCondition.IMEDIATO
            ? FinancialEntryStatus.PAGO
            : FinancialEntryStatus.ABERTO,
        reference: `VENDA-${sale.code}`,
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
          dueDate: dueDate.toISOString().slice(0, 10),
          category: financialEntry.category,
          customerId: financialEntry.customerId,
          saleId: sale.id,
        },
      },
    });
    if (dto.condition === SaleSettlementCondition.IMEDIATO) {
      const payment = await tx.financialPayment.create({
        data: {
          entryId: financialEntry.id,
          amount: total,
          method: dto.paymentMethod!,
          occurredAt: new Date(),
          reference: `VENDA-${sale.code}`,
        },
      });
      await createAuditLog(tx, {
        data: {
          action: 'finance.payment.registered',
          aggregateType: 'FinancialEntry',
          aggregateId: financialEntry.id,
          after: {
            paymentId: payment.id,
            amount: payment.amount.toString(),
            method: payment.method,
            occurredAt: payment.occurredAt.toISOString(),
            status: financialEntry.status,
            paid: total.toString(),
            outstanding: '0',
          },
        },
      });
    }

    for (const line of saleLines) {
      const lot = lotById.get(line.productLotId)!;
      const nextQuantity = lot.quantity.minus(line.quantity);
      const movement = await tx.stockMovement.create({
        data: {
          type: StockMovementType.SAIDA,
          productLotId: lot.id,
          quantity: line.quantity,
          sourceMagazineId: lot.magazineId,
          reference: `VENDA-${sale.code}`,
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
            reference: `VENDA-${sale.code}`,
          },
        },
      });
    }
    await createAuditLog(tx, {
      data: {
        action: 'sale.completed',
        aggregateType: 'Sale',
        aggregateId: sale.id,
        after: {
          code: sale.code,
          customerId: sale.customerId,
          priceListId: sale.priceListId,
          total: sale.total.toString(),
          itemCount: saleLines.length,
          ...(quote ? { quoteId: quote.id } : {}),
          financialEntryId: financialEntry.id,
        },
      },
    });
    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: {
        customer: true,
        priceList: true,
        quote: true,
        items: { include: { product: true, productLot: true } },
        financialEntry: {
          include: { payments: { orderBy: { occurredAt: 'asc' } } },
        },
      },
    });
  }
}
