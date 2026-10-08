import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialDirection,
  FinancialEntryStatus,
  Prisma,
  SalesQuoteStatus,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreatePriceListDto,
  CreateSalesQuoteDto,
  CreateSaleDto,
  CreateSaleReturnDto,
  ConvertSalesQuoteDto,
  PriceListsQueryDto,
  SaleSettlementCondition,
  SalesQuotesQueryDto,
  SalesQueryDto,
} from './commercial.dto.js';

const SALES_QUOTE_VALIDITY_DAYS = 7;

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async listPriceLists(query: PriceListsQueryDto) {
    const where: Prisma.PriceListWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.priceList.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.priceList.count({ where }),
    ]);
    return this.paginated(data, total, query);
  }

  async getPriceList(id: string) {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!list) {
      throw new NotFoundException('Tabela de preço não encontrada.');
    }
    return list;
  }

  async createPriceList(dto: CreatePriceListDto) {
    if (
      dto.effectiveFrom &&
      dto.effectiveUntil &&
      dto.effectiveFrom > dto.effectiveUntil
    ) {
      throw new BadRequestException(
        'O início da vigência não pode ser posterior ao término.',
      );
    }
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Um ou mais produtos não foram encontrados.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const list = await tx.priceList.create({
          data: {
            name: dto.name.trim(),
            active: dto.active,
            effectiveFrom: dto.effectiveFrom
              ? this.dateOnly(dto.effectiveFrom)
              : null,
            effectiveUntil: dto.effectiveUntil
              ? this.dateOnly(dto.effectiveUntil)
              : null,
            items: {
              create: dto.items.map((item) => ({
                productId: item.productId,
                unitPrice: new Prisma.Decimal(item.unitPrice),
              })),
            },
          },
          include: { items: { include: { product: true } } },
        });
        await tx.auditLog.create({
          data: {
            action: 'pricing-list.created',
            aggregateType: 'PriceList',
            aggregateId: list.id,
            after: {
              name: list.name,
              active: list.active,
              itemCount: list.items.length,
            },
          },
        });
        return list;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

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
    return this.paginated(data, total, query);
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

  async listSalesQuotes(query: SalesQuotesQueryDto) {
    const now = new Date();
    const conditions: Prisma.SalesQuoteWhereInput[] = [];
    if (query.status === SalesQuoteStatus.EXPIRADO) {
      conditions.push({
        OR: [
          { status: SalesQuoteStatus.EXPIRADO },
          {
            status: SalesQuoteStatus.EMITIDO,
            expiresAt: { lte: now },
          },
        ],
      });
    } else if (query.status === SalesQuoteStatus.EMITIDO) {
      conditions.push({
        status: SalesQuoteStatus.EMITIDO,
        expiresAt: { gt: now },
      });
    } else if (query.status) {
      conditions.push({ status: query.status });
    }
    if (query.search) {
      conditions.push({
        OR: [
          ...(Number.isSafeInteger(Number(query.search))
            ? [{ code: Number(query.search) }]
            : []),
          {
            customer: {
              legalName: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }
    const where: Prisma.SalesQuoteWhereInput = conditions.length
      ? { AND: conditions }
      : {};
    const [quotes, total] = await Promise.all([
      this.prisma.salesQuote.findMany({
        where,
        include: {
          customer: true,
          priceList: true,
          items: { include: { product: true, productLot: true } },
          sale: { select: { id: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.salesQuote.count({ where }),
    ]);
    return this.paginated(
      quotes.map((quote) => this.withEffectiveQuoteStatus(quote, now)),
      total,
      query,
    );
  }

  async getSalesQuote(id: string) {
    const quote = await this.prisma.salesQuote.findUnique({
      where: { id },
      include: {
        customer: true,
        priceList: true,
        items: { include: { product: true, productLot: true } },
        sale: { select: { id: true, code: true } },
      },
    });
    if (!quote) {
      throw new NotFoundException('Orçamento comercial não encontrado.');
    }
    return this.withEffectiveQuoteStatus(quote);
  }

  async createSalesQuote(dto: CreateSalesQuoteDto) {
    const lotIds = dto.items.map((item) => item.productLotId).sort();
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockLots(tx, lotIds);
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
        this.assertPriceListActive(priceList);
        this.assertCustomerActive(customer, dto.customerId);
        if (lots.length !== lotIds.length) {
          throw new NotFoundException(
            'Um ou mais lotes não foram encontrados.',
          );
        }
        const lotById = new Map(lots.map((lot) => [lot.id, lot]));
        const priceByProduct = new Map(
          priceList.items.map((item) => [item.productId, item.unitPrice]),
        );
        const pceClasses = new Set<string>();
        const quoteLines: Array<{
          productId: string;
          productLotId: string;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];
        const now = new Date();

        for (const item of dto.items) {
          const lot = lotById.get(item.productLotId)!;
          const unitPrice = priceByProduct.get(lot.productId);
          if (!unitPrice) {
            throw new ConflictException(
              `Produto ${lot.product.name} não possui preço nesta tabela.`,
            );
          }
          this.assertNotExpired(lot.expiresAt);
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
                  in: [
                    ServiceOrderStatus.APROVADO,
                    ServiceOrderStatus.EM_MONTAGEM,
                  ],
                },
              },
            },
            _sum: { plannedQuantity: true },
          });
          const quoteReservations = await tx.salesQuoteItem.aggregate({
            where: {
              productLotId: lot.id,
              quote: {
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
        this.assertCustomerCanPurchasePce(customer, pceClasses);
        const total = quoteLines.reduce(
          (sum, line) => sum.plus(line.subtotal),
          new Prisma.Decimal(0),
        );
        const expiresAt = new Date(
          now.getTime() + SALES_QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
        );
        const quote = await tx.salesQuote.create({
          data: {
            customerId: customer?.id ?? null,
            priceListId: priceList.id,
            total,
            expiresAt,
            items: { create: quoteLines },
          },
          include: {
            customer: true,
            priceList: true,
            items: { include: { product: true, productLot: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'sales-quote.created',
            aggregateType: 'SalesQuote',
            aggregateId: quote.id,
            after: {
              code: quote.code,
              status: quote.status,
              customerId: quote.customerId,
              priceListId: quote.priceListId,
              total: quote.total.toString(),
              expiresAt: quote.expiresAt.toISOString(),
              itemCount: quote.items.length,
            },
          },
        });
        return quote;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async cancelSalesQuote(id: string) {
    return this.prisma.$transaction(async (tx) => {
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
      const effectiveStatus = this.effectiveQuoteStatus(quote);
      if (effectiveStatus !== SalesQuoteStatus.EMITIDO) {
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
      await tx.auditLog.create({
        data: {
          action: 'sales-quote.cancelled',
          aggregateType: 'SalesQuote',
          aggregateId: id,
          before: { status: quote.status },
          after: { status: cancelled.status },
        },
      });
      return cancelled;
    });
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
        if (this.effectiveQuoteStatus(quote) !== SalesQuoteStatus.EMITIDO) {
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
        await tx.auditLog.create({
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

  async listSaleReturns(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }
    return this.prisma.saleReturn.findMany({
      where: { saleId },
      include: {
        items: {
          include: {
            saleItem: { include: { product: true } },
            productLot: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSaleReturn(saleId: string, dto: CreateSaleReturnDto) {
    return this.prisma.$transaction(async (tx) => {
      const saleRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "vendas" WHERE "id" = ${saleId}::uuid FOR UPDATE
      `;
      if (saleRows.length === 0) {
        throw new NotFoundException('Venda não encontrada.');
      }

      const saleItemIds = dto.items.map((item) => item.saleItemId);
      const saleItems = await tx.saleItem.findMany({
        where: { id: { in: saleItemIds }, saleId },
        include: { product: true, productLot: true },
      });
      if (saleItems.length !== saleItemIds.length) {
        throw new NotFoundException(
          'Um ou mais itens não pertencem a esta venda.',
        );
      }
      const lotIds = [
        ...new Set(saleItems.map((item) => item.productLotId)),
      ].sort();
      await this.lockLots(tx, lotIds);
      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true },
      });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      const returnLines: Array<{
        saleItemId: string;
        productLotId: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
      }> = [];

      for (const requestItem of dto.items) {
        const saleItem = saleItems.find(
          (item) => item.id === requestItem.saleItemId,
        )!;
        const lot = lotById.get(saleItem.productLotId);
        if (!lot) {
          throw new NotFoundException('Lote original não encontrado.');
        }
        this.assertNotExpired(lot.expiresAt);
        const existingReturns = await tx.saleReturnItem.aggregate({
          where: { saleItemId: saleItem.id },
          _sum: { quantity: true },
        });
        const alreadyReturned =
          existingReturns._sum.quantity ?? new Prisma.Decimal(0);
        const quantity = new Prisma.Decimal(requestItem.quantity);
        const remaining = saleItem.quantity.minus(alreadyReturned);
        if (quantity.gt(remaining)) {
          throw new ConflictException({
            message: 'A devolução excede a quantidade ainda não devolvida.',
            saleItemId: saleItem.id,
            soldQuantity: saleItem.quantity.toString(),
            alreadyReturned: alreadyReturned.toString(),
            requested: quantity.toString(),
            remaining: remaining.toString(),
          });
        }
        returnLines.push({
          saleItemId: saleItem.id,
          productLotId: lot.id,
          quantity,
          unitPrice: saleItem.unitPrice,
          subtotal: saleItem.unitPrice.mul(quantity).toDecimalPlaces(2),
        });
      }

      const magazineIds = [
        ...new Set(lots.map((lot) => lot.magazineId)),
      ].sort();
      for (const magazineId of magazineIds) {
        await this.lockMagazine(tx, magazineId);
      }
      const neqByMagazine = new Map<string, Prisma.Decimal>();
      for (const line of returnLines) {
        const lot = lotById.get(line.productLotId)!;
        const additionalNeqKg = line.quantity
          .mul(lot.product.neqGrams)
          .div(1000);
        neqByMagazine.set(
          lot.magazineId,
          (neqByMagazine.get(lot.magazineId) ?? new Prisma.Decimal(0)).plus(
            additionalNeqKg,
          ),
        );
      }
      for (const [magazineId, additionalNeqKg] of neqByMagazine) {
        const magazine = await tx.magazine.findUnique({
          where: { id: magazineId },
        });
        this.assertMagazineCanReceive(magazine);
        await this.assertCapacity(tx, magazineId, additionalNeqKg);
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          saleId,
          reason: dto.reason.trim(),
          items: { create: returnLines },
        },
        include: {
          items: {
            include: {
              saleItem: { include: { product: true } },
              productLot: true,
            },
          },
        },
      });

      for (const line of returnLines) {
        const lot = lotById.get(line.productLotId)!;
        const nextQuantity = lot.quantity.plus(line.quantity);
        const movement = await tx.stockMovement.create({
          data: {
            type: StockMovementType.ENTRADA,
            productLotId: lot.id,
            quantity: line.quantity,
            destinationMagazineId: lot.magazineId,
            reference: `DEVOLUCAO-${saleReturn.code}`,
          },
        });
        await tx.productLot.update({
          where: { id: lot.id },
          data: { quantity: nextQuantity },
        });
        await tx.auditLog.create({
          data: {
            action: 'inventory.movement.entrada',
            aggregateType: 'ProductLot',
            aggregateId: lot.id,
            before: { quantity: lot.quantity.toString() },
            after: {
              quantity: nextQuantity.toString(),
              movementId: movement.id,
              reference: `DEVOLUCAO-${saleReturn.code}`,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'sale.returned',
          aggregateType: 'Sale',
          aggregateId: saleId,
          after: {
            returnId: saleReturn.id,
            returnCode: saleReturn.code,
            reason: saleReturn.reason,
            items: returnLines.map((item) => ({
              saleItemId: item.saleItemId,
              productLotId: item.productLotId,
              quantity: item.quantity.toString(),
              subtotal: item.subtotal.toString(),
            })),
          },
        },
      });
      return saleReturn;
    });
  }

  async createSale(dto: CreateSaleDto) {
    return this.prisma.$transaction(
      (tx) => this.completeSaleInTransaction(tx, dto),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async completeSaleInTransaction(
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
    await this.lockLots(tx, lotIds);
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
      this.assertPriceListActive(priceList);
    }
    this.assertCustomerActive(customer, dto.customerId);
    if (lots.length !== lotIds.length) {
      throw new NotFoundException('Um ou mais lotes não foram encontrados.');
    }
    const lotById = new Map(lots.map((lot) => [lot.id, lot]));
    const priceByProduct = new Map(
      priceList.items.map((item) => [item.productId, item.unitPrice]),
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
            : priceByProduct.get(lot.productId);
      if (!unitPrice) {
        throw new ConflictException(
          `Produto ${lot.product.name} não possui preço nesta tabela.`,
        );
      }
      this.assertNotExpired(lot.expiresAt);
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
    this.assertCustomerCanPurchasePce(customer, pceClasses);

    const total = saleLines.reduce(
      (sum, item) => sum.plus(item.subtotal),
      new Prisma.Decimal(0),
    );
    this.assertSaleSettlement(dto, customer?.id ?? null);
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
        ? this.dateOnly(new Date().toISOString().slice(0, 10))
        : this.dateOnly(dto.dueDate!);
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
    await tx.auditLog.create({
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
      await tx.auditLog.create({
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
      await tx.auditLog.create({
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
    await tx.auditLog.create({
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

  private assertSaleSettlement(
    dto: CreateSaleDto,
    customerId: string | null,
  ): void {
    if (
      dto.condition === SaleSettlementCondition.IMEDIATO &&
      (dto.dueDate !== undefined || dto.paymentMethod === undefined)
    ) {
      throw new BadRequestException(
        'Venda imediata exige método de pagamento e não aceita vencimento.',
      );
    }
    if (
      dto.condition === SaleSettlementCondition.PRAZO &&
      (dto.paymentMethod !== undefined ||
        dto.dueDate === undefined ||
        customerId === null)
    ) {
      throw new BadRequestException(
        'Venda a prazo exige cliente cadastrado e vencimento, e não aceita método de pagamento imediato.',
      );
    }
  }

  private assertPriceListActive(priceList: {
    active: boolean;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
  }) {
    const today = new Date().toISOString().slice(0, 10);
    if (
      !priceList.active ||
      (priceList.effectiveFrom &&
        priceList.effectiveFrom.toISOString().slice(0, 10) > today) ||
      (priceList.effectiveUntil &&
        priceList.effectiveUntil.toISOString().slice(0, 10) < today)
    ) {
      throw new ConflictException(
        'Tabela de preço inativa ou fora do período de vigência.',
      );
    }
  }

  private assertCustomerActive(
    customer: { active: boolean } | null,
    customerId?: string,
  ) {
    if (customerId && !customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    if (customer && !customer.active) {
      throw new ConflictException('Cliente inativo não pode realizar venda.');
    }
  }

  private assertCustomerCanPurchasePce(
    customer: {
      hasCr: boolean;
      crExpiresAt: Date | null;
      authorizedPceClasses: string[];
    } | null,
    pceClasses: Set<string>,
  ) {
    if (pceClasses.size === 0) {
      return;
    }
    if (!customer) {
      throw new ConflictException(
        'Venda de PCE exige cliente identificado com CR válido e classes autorizadas.',
      );
    }
    const today = new Date().toISOString().slice(0, 10);
    const crExpires = customer.crExpiresAt?.toISOString().slice(0, 10);
    const unauthorized = [...pceClasses].filter(
      (riskClass) => !customer.authorizedPceClasses.includes(riskClass),
    );
    if (
      !customer.hasCr ||
      !crExpires ||
      crExpires < today ||
      unauthorized.length
    ) {
      throw new ConflictException({
        message: 'Cliente não está autorizado para os PCE desta venda.',
        reasons: [
          ...(!customer.hasCr
            ? ['Cliente sem Certificado de Registro informado.']
            : []),
          ...(customer.hasCr && (!crExpires || crExpires < today)
            ? ['Certificado de Registro vencido ou sem validade.']
            : []),
          ...(unauthorized.length
            ? [`Classes não autorizadas: ${unauthorized.join(', ')}.`]
            : []),
        ],
      });
    }
  }

  private effectiveQuoteStatus(quote: {
    status: SalesQuoteStatus;
    expiresAt: Date;
  }) {
    return quote.status === SalesQuoteStatus.EMITIDO &&
      quote.expiresAt <= new Date()
      ? SalesQuoteStatus.EXPIRADO
      : quote.status;
  }

  private withEffectiveQuoteStatus<
    T extends {
      status: SalesQuoteStatus;
      expiresAt: Date;
    },
  >(quote: T, now = new Date()) {
    return {
      ...quote,
      status:
        quote.status === SalesQuoteStatus.EMITIDO && quote.expiresAt <= now
          ? SalesQuoteStatus.EXPIRADO
          : quote.status,
    };
  }

  private assertNotExpired(expiresAt: Date) {
    if (
      expiresAt.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    ) {
      throw new ConflictException('Lote vencido não pode ser vendido.');
    }
  }

  private async lockLots(
    tx: Prisma.TransactionClient,
    lotIds: string[],
  ): Promise<void> {
    const conditions = lotIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id" FROM "produto_lotes"
        WHERE ${Prisma.join(conditions, ' OR ')}
        ORDER BY "id"
        FOR UPDATE
      `,
    );
    if (rows.length !== lotIds.length) {
      throw new NotFoundException('Um ou mais lotes não foram encontrados.');
    }
  }

  private async lockMagazine(
    tx: Prisma.TransactionClient,
    magazineId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "paioes" WHERE "id" = ${magazineId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException('Paiol do lote não encontrado.');
    }
  }

  private assertMagazineCanReceive(
    magazine: {
      active: boolean;
      fireLicenseExpiresAt: Date;
    } | null,
  ) {
    if (!magazine) {
      throw new NotFoundException('Paiol do lote não encontrado.');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (
      !magazine.active ||
      magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) < today
    ) {
      throw new ConflictException(
        'Paiol inativo ou com licença dos Bombeiros vencida não pode receber devolução.',
      );
    }
  }

  private async assertCapacity(
    tx: Prisma.TransactionClient,
    magazineId: string,
    additionalNeqKg: Prisma.Decimal,
  ) {
    const magazine = await tx.magazine.findUnique({
      where: { id: magazineId },
    });
    if (!magazine) {
      throw new NotFoundException('Paiol do lote não encontrado.');
    }
    const [row] = await tx.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
      FROM "produto_lotes" l
      JOIN "produtos" p ON p."id" = l."produto_id"
      WHERE l."paiol_id" = ${magazineId}::uuid
    `;
    const projected = (row?.neqKg ?? new Prisma.Decimal(0)).plus(
      additionalNeqKg,
    );
    if (projected.gt(magazine.maxNeqCapacityKg)) {
      throw new ConflictException({
        message: 'Devolução bloqueada: capacidade NEQ do paiol excedida.',
        magazineId,
        capacityKg: magazine.maxNeqCapacityKg.toString(),
        projectedNeqKg: projected.toString(),
      });
    }
  }

  private dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private paginated<T>(
    data: T[],
    total: number,
    query: { page: number; limit: number },
  ) {
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
