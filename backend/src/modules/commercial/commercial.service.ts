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
  CreateProductPromotionDto,
  ProductPromotionsQueryDto,
  UpdateProductPromotionDto,
  PriceListsQueryDto,
  SaleSettlementCondition,
  SalesReportQueryDto,
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

  async listProductPromotions(query: ProductPromotionsQueryDto) {
    const where: Prisma.ProductPromotionWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.productId
        ? { items: { some: { productId: query.productId } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                items: {
                  some: {
                    product: {
                      name: { contains: query.search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.productPromotion.findMany({
        where,
        include: {
          items: {
            include: { product: true },
            orderBy: { product: { name: 'asc' } },
          },
        },
        orderBy: [{ effectiveFrom: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productPromotion.count({ where }),
    ]);
    return this.paginated(data, total, query);
  }

  async getProductPromotion(id: string) {
    const promotion = await this.prisma.productPromotion.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!promotion) {
      throw new NotFoundException('Promoção não encontrada.');
    }
    return promotion;
  }

  async createProductPromotion(dto: CreateProductPromotionDto) {
    if (dto.effectiveFrom > dto.effectiveUntil) {
      throw new BadRequestException(
        'O início da vigência não pode ser posterior ao término.',
      );
    }
    const productIds = dto.items.map((item) => item.productId).sort();
    return this.prisma.$transaction(async (tx) => {
      await this.lockProducts(tx, productIds);
      const products = await tx.product.count({
        where: { id: { in: productIds } },
      });
      if (products !== productIds.length) {
        throw new NotFoundException(
          'Um ou mais produtos não foram encontrados.',
        );
      }
      const effectiveFrom = this.dateOnly(dto.effectiveFrom);
      const effectiveUntil = this.dateOnly(dto.effectiveUntil);
      if (dto.active) {
        await this.assertNoOverlappingProductPromotions(
          tx,
          productIds,
          effectiveFrom,
          effectiveUntil,
        );
      }
      const promotion = await tx.productPromotion.create({
        data: {
          name: dto.name.trim(),
          active: dto.active,
          effectiveFrom,
          effectiveUntil,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              promotionalPrice: new Prisma.Decimal(item.promotionalPrice),
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
      await tx.auditLog.create({
        data: {
          action: 'pricing-promotion.created',
          aggregateType: 'ProductPromotion',
          aggregateId: promotion.id,
          after: {
            name: promotion.name,
            active: promotion.active,
            effectiveFrom: dto.effectiveFrom,
            effectiveUntil: dto.effectiveUntil,
            products: promotion.items.map((item) => ({
              productId: item.productId,
              promotionalPrice: item.promotionalPrice.toString(),
            })),
          },
        },
      });
      return promotion;
    });
  }

  async updateProductPromotion(id: string, dto: UpdateProductPromotionDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "promocoes_produto"
        WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException('Promoção não encontrada.');
      }
      const promotion = await tx.productPromotion.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!promotion) {
        throw new NotFoundException('Promoção não encontrada.');
      }
      const productIds = promotion.items.map((item) => item.productId).sort();
      await this.lockProducts(tx, productIds);
      if (dto.active && !promotion.active) {
        await this.assertNoOverlappingProductPromotions(
          tx,
          productIds,
          promotion.effectiveFrom,
          promotion.effectiveUntil,
          promotion.id,
        );
      }
      const updated = await tx.productPromotion.update({
        where: { id },
        data: { active: dto.active },
        include: { items: { include: { product: true } } },
      });
      await tx.auditLog.create({
        data: {
          action: 'pricing-promotion.updated',
          aggregateType: 'ProductPromotion',
          aggregateId: id,
          before: { active: promotion.active },
          after: { active: updated.active },
        },
      });
      return updated;
    });
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

  async salesReport(query: SalesReportQueryDto) {
    if (query.from > query.to) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }
    const from = new Date(`${query.from}T00:00:00.000Z`);
    const until = this.dateOnly(query.to);
    until.setUTCDate(until.getUTCDate() + 1);
    const salePeriod = { gte: from, lt: until };
    const [
      salesTotals,
      returnTotals,
      soldProducts,
      returnedProducts,
      soldCustomers,
      returnedCustomers,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { createdAt: salePeriod },
        _count: { _all: true },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<
        Array<{ returnsCount: bigint; amount: Prisma.Decimal }>
      >`
        SELECT
          COUNT(DISTINCT r."id") AS "returnsCount",
          COALESCE(SUM(ri."subtotal"), 0) AS amount
        FROM "devolucoes_venda" r
        INNER JOIN "itens_devolucao_venda" ri
          ON ri."devolucao_id" = r."id"
        WHERE r."created_at" >= ${from}
          AND r."created_at" < ${until}
      `,
      this.prisma.$queryRaw<
        Array<{
          productId: string;
          productName: string;
          quantity: Prisma.Decimal;
          amount: Prisma.Decimal;
        }>
      >`
        SELECT
          p."id" AS "productId",
          p."nome" AS "productName",
          SUM(si."quantity") AS quantity,
          SUM(si."subtotal") AS amount
        FROM "itens_venda" si
        INNER JOIN "vendas" s ON s."id" = si."venda_id"
        INNER JOIN "produtos" p ON p."id" = si."produto_id"
        WHERE s."created_at" >= ${from}
          AND s."created_at" < ${until}
        GROUP BY p."id", p."nome"
        ORDER BY SUM(si."subtotal") DESC, p."nome" ASC
      `,
      this.prisma.$queryRaw<
        Array<{
          productId: string;
          productName: string;
          quantity: Prisma.Decimal;
          amount: Prisma.Decimal;
        }>
      >`
        SELECT
          p."id" AS "productId",
          p."nome" AS "productName",
          SUM(ri."quantity") AS quantity,
          SUM(ri."subtotal") AS amount
        FROM "itens_devolucao_venda" ri
        INNER JOIN "devolucoes_venda" r ON r."id" = ri."devolucao_id"
        INNER JOIN "itens_venda" si ON si."id" = ri."item_venda_id"
        INNER JOIN "produtos" p ON p."id" = si."produto_id"
        WHERE r."created_at" >= ${from}
          AND r."created_at" < ${until}
        GROUP BY p."id", p."nome"
        ORDER BY SUM(ri."subtotal") DESC, p."nome" ASC
      `,
      this.prisma.$queryRaw<
        Array<{
          customerId: string | null;
          customerName: string;
          salesCount: bigint;
          amount: Prisma.Decimal;
        }>
      >`
        SELECT
          s."cliente_id" AS "customerId",
          COALESCE(c."razao_social", 'Venda de balcão sem cliente') AS "customerName",
          COUNT(s."id") AS "salesCount",
          SUM(s."total") AS amount
        FROM "vendas" s
        LEFT JOIN "clientes" c ON c."id" = s."cliente_id"
        WHERE s."created_at" >= ${from}
          AND s."created_at" < ${until}
        GROUP BY s."cliente_id", c."razao_social"
        ORDER BY SUM(s."total") DESC, "customerName" ASC
      `,
      this.prisma.$queryRaw<
        Array<{
          customerId: string | null;
          customerName: string;
          returnsCount: bigint;
          amount: Prisma.Decimal;
        }>
      >`
        SELECT
          s."cliente_id" AS "customerId",
          COALESCE(c."razao_social", 'Venda de balcão sem cliente') AS "customerName",
          COUNT(DISTINCT r."id") AS "returnsCount",
          SUM(ri."subtotal") AS amount
        FROM "devolucoes_venda" r
        INNER JOIN "vendas" s ON s."id" = r."venda_id"
        LEFT JOIN "clientes" c ON c."id" = s."cliente_id"
        INNER JOIN "itens_devolucao_venda" ri
          ON ri."devolucao_id" = r."id"
        WHERE r."created_at" >= ${from}
          AND r."created_at" < ${until}
        GROUP BY s."cliente_id", c."razao_social"
        ORDER BY SUM(ri."subtotal") DESC, "customerName" ASC
      `,
    ]);
    const zero = () => new Prisma.Decimal(0);
    const productTotals = new Map<
      string,
      {
        productId: string;
        productName: string;
        soldQuantity: Prisma.Decimal;
        returnedQuantity: Prisma.Decimal;
        grossSales: Prisma.Decimal;
        returned: Prisma.Decimal;
      }
    >();
    const getProduct = (id: string, name: string) => {
      const existing = productTotals.get(id);
      if (existing) {
        return existing;
      }
      const product = {
        productId: id,
        productName: name,
        soldQuantity: zero(),
        returnedQuantity: zero(),
        grossSales: zero(),
        returned: zero(),
      };
      productTotals.set(id, product);
      return product;
    };
    for (const row of soldProducts) {
      const product = getProduct(row.productId, row.productName);
      product.soldQuantity = row.quantity;
      product.grossSales = row.amount;
    }
    for (const row of returnedProducts) {
      const product = getProduct(row.productId, row.productName);
      product.returnedQuantity = row.quantity;
      product.returned = row.amount;
    }
    const customerTotals = new Map<
      string,
      {
        customerId: string | null;
        customerName: string;
        salesCount: number;
        returnsCount: number;
        grossSales: Prisma.Decimal;
        returned: Prisma.Decimal;
      }
    >();
    const getCustomer = (id: string | null, name: string) => {
      const key = id ?? 'walk-in';
      const existing = customerTotals.get(key);
      if (existing) {
        return existing;
      }
      const customer = {
        customerId: id,
        customerName: name,
        salesCount: 0,
        returnsCount: 0,
        grossSales: zero(),
        returned: zero(),
      };
      customerTotals.set(key, customer);
      return customer;
    };
    for (const row of soldCustomers) {
      const customer = getCustomer(row.customerId, row.customerName);
      customer.salesCount = Number(row.salesCount);
      customer.grossSales = row.amount;
    }
    for (const row of returnedCustomers) {
      const customer = getCustomer(row.customerId, row.customerName);
      customer.returnsCount = Number(row.returnsCount);
      customer.returned = row.amount;
    }
    const returnedAmount = returnTotals[0]?.amount ?? zero();
    return {
      period: { from: query.from, to: query.to },
      basis: {
        sales: 'data de finalização da venda',
        returns: 'data de registro da devolução',
      },
      totals: {
        salesCount: salesTotals._count._all,
        returnsCount: Number(returnTotals[0]?.returnsCount ?? 0),
        grossSales: (salesTotals._sum.total ?? zero()).toString(),
        returned: returnedAmount.toString(),
        netSales: (salesTotals._sum.total ?? zero())
          .minus(returnedAmount)
          .toString(),
      },
      byProduct: [...productTotals.values()]
        .sort(
          (first, second) =>
            second.grossSales.comparedTo(first.grossSales) ||
            first.productName.localeCompare(second.productName),
        )
        .map((product) => ({
          ...product,
          soldQuantity: product.soldQuantity.toString(),
          returnedQuantity: product.returnedQuantity.toString(),
          netQuantity: product.soldQuantity
            .minus(product.returnedQuantity)
            .toString(),
          grossSales: product.grossSales.toString(),
          netSales: product.grossSales.minus(product.returned).toString(),
          returned: product.returned.toString(),
        })),
      byCustomer: [...customerTotals.values()]
        .sort(
          (first, second) =>
            second.grossSales.comparedTo(first.grossSales) ||
            first.customerName.localeCompare(second.customerName),
        )
        .map((customer) => ({
          ...customer,
          grossSales: customer.grossSales.toString(),
          returned: customer.returned.toString(),
          netSales: customer.grossSales.minus(customer.returned).toString(),
        })),
    };
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
        const now = new Date();
        const promotionPriceByProduct = await this.getActivePromotionalPrices(
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

        for (const item of dto.items) {
          const lot = lotById.get(item.productLotId)!;
          const unitPrice = this.resolveUnitPrice(
            priceByProduct.get(lot.productId),
            promotionPriceByProduct.get(lot.productId),
          );
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
        refundEntry: { include: { payments: true } },
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
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          financialEntry: { select: { id: true } },
        },
      });
      if (!sale) {
        throw new NotFoundException('Venda não encontrada.');
      }
      let receivable:
        | (Prisma.FinancialEntryGetPayload<{
            include: { payments: true };
          }> & { id: string })
        | null = null;
      if (sale.financialEntry) {
        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "lancamentos_financeiros"
          WHERE "id" = ${sale.financialEntry.id}::uuid FOR UPDATE
        `;
        receivable = await tx.financialEntry.findUnique({
          where: { id: sale.financialEntry.id },
          include: { payments: true },
        });
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

      const returnTotal = returnLines.reduce(
        (sum, line) => sum.plus(line.subtotal),
        new Prisma.Decimal(0),
      );
      const paid = receivable
        ? receivable.payments.reduce(
            (sum, payment) => sum.plus(payment.amount),
            new Prisma.Decimal(0),
          )
        : new Prisma.Decimal(0);
      const outstanding = receivable
        ? receivable.status === FinancialEntryStatus.CANCELADO
          ? new Prisma.Decimal(0)
          : Prisma.Decimal.max(
              receivable.amount.minus(paid).minus(receivable.creditedAmount),
              0,
            )
        : new Prisma.Decimal(0);
      const creditApplied = Prisma.Decimal.min(returnTotal, outstanding);
      const refundAmount = returnTotal.minus(creditApplied);
      if (refundAmount.gt(0) && !dto.dueDate) {
        throw new BadRequestException(
          'Informe o vencimento do reembolso gerado pela devolução.',
        );
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          saleId,
          reason: dto.reason.trim(),
          creditApplied,
          refundAmount,
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

      if (receivable && creditApplied.gt(0)) {
        const nextCredited = receivable.creditedAmount.plus(creditApplied);
        const remaining = receivable.amount.minus(paid).minus(nextCredited);
        const nextStatus = remaining.eq(0)
          ? paid.eq(0)
            ? FinancialEntryStatus.COMPENSADO
            : FinancialEntryStatus.PAGO
          : FinancialEntryStatus.PARCIAL;
        await tx.financialEntry.update({
          where: { id: receivable.id },
          data: { creditedAmount: nextCredited, status: nextStatus },
        });
        await tx.auditLog.create({
          data: {
            action: 'finance.receivable.credit-applied',
            aggregateType: 'FinancialEntry',
            aggregateId: receivable.id,
            before: {
              status: receivable.status,
              creditedAmount: receivable.creditedAmount.toString(),
              outstanding: outstanding.toString(),
            },
            after: {
              status: nextStatus,
              creditedAmount: nextCredited.toString(),
              creditApplied: creditApplied.toString(),
              outstanding: remaining.toString(),
              saleReturnId: saleReturn.id,
            },
          },
        });
      }
      let refundEntry: {
        id: string;
        code: number;
        amount: Prisma.Decimal;
      } | null = null;
      if (refundAmount.gt(0)) {
        refundEntry = await tx.financialEntry.create({
          data: {
            direction: FinancialDirection.PAGAR,
            description: `Reembolso da devolução ${saleReturn.code}`,
            category: 'DEVOLUCAO_VENDA',
            counterparty: sale.customer?.legalName ?? 'Cliente de venda',
            customerId: sale.customerId,
            saleReturnId: saleReturn.id,
            amount: refundAmount,
            dueDate: this.dateOnly(dto.dueDate!),
            reference: `DEVOLUCAO-${saleReturn.code}`,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'finance.refund-entry.created',
            aggregateType: 'FinancialEntry',
            aggregateId: refundEntry.id,
            after: {
              code: refundEntry.code,
              direction: FinancialDirection.PAGAR,
              amount: refundEntry.amount.toString(),
              dueDate: dto.dueDate,
              saleReturnId: saleReturn.id,
              saleId,
              customerId: sale.customerId,
            },
          },
        });
      }

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
            total: returnTotal.toString(),
            creditApplied: creditApplied.toString(),
            refundAmount: refundAmount.toString(),
            refundEntryId: refundEntry?.id ?? null,
            items: returnLines.map((item) => ({
              saleItemId: item.saleItemId,
              productLotId: item.productLotId,
              quantity: item.quantity.toString(),
              subtotal: item.subtotal.toString(),
            })),
          },
        },
      });
      return tx.saleReturn.findUniqueOrThrow({
        where: { id: saleReturn.id },
        include: {
          refundEntry: { include: { payments: true } },
          items: {
            include: {
              saleItem: { include: { product: true } },
              productLot: true,
            },
          },
        },
      });
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
    const promotionPriceByProduct = quote
      ? new Map<string, Prisma.Decimal>()
      : await this.getActivePromotionalPrices(
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
            : this.resolveUnitPrice(
                priceByProduct.get(lot.productId),
                promotionPriceByProduct.get(lot.productId),
              );
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

  private async getActivePromotionalPrices(
    tx: Prisma.TransactionClient,
    productIds: string[],
    at = new Date(),
  ): Promise<Map<string, Prisma.Decimal>> {
    const ids = [...new Set(productIds)];
    if (!ids.length) {
      return new Map();
    }
    const day = this.dateOnly(at.toISOString().slice(0, 10));
    const items = await tx.productPromotionItem.findMany({
      where: {
        productId: { in: ids },
        promotion: {
          active: true,
          effectiveFrom: { lte: day },
          effectiveUntil: { gte: day },
        },
      },
      select: { productId: true, promotionalPrice: true, promotionId: true },
    });
    const prices = new Map<string, Prisma.Decimal>();
    for (const item of items) {
      if (prices.has(item.productId)) {
        throw new ConflictException(
          'Mais de uma promoção vigente encontrada para o mesmo produto.',
        );
      }
      prices.set(item.productId, item.promotionalPrice);
    }
    return prices;
  }

  private resolveUnitPrice(
    tablePrice: Prisma.Decimal | undefined,
    promotionalPrice: Prisma.Decimal | undefined,
  ): Prisma.Decimal | undefined {
    if (!promotionalPrice) {
      return tablePrice;
    }
    return !tablePrice || promotionalPrice.lt(tablePrice)
      ? promotionalPrice
      : tablePrice;
  }

  private async assertNoOverlappingProductPromotions(
    tx: Prisma.TransactionClient,
    productIds: string[],
    effectiveFrom: Date,
    effectiveUntil: Date,
    excludePromotionId?: string,
  ): Promise<void> {
    const overlapping = await tx.productPromotion.findFirst({
      where: {
        active: true,
        effectiveFrom: { lte: effectiveUntil },
        effectiveUntil: { gte: effectiveFrom },
        ...(excludePromotionId ? { id: { not: excludePromotionId } } : {}),
        items: { some: { productId: { in: productIds } } },
      },
      include: {
        items: {
          where: { productId: { in: productIds } },
          select: { productId: true },
        },
      },
    });
    if (overlapping) {
      throw new ConflictException({
        message:
          'Já existe promoção vigente ou futura sobreposta para produto.',
        promotionId: overlapping.id,
        promotionName: overlapping.name,
        productIds: overlapping.items.map((item) => item.productId),
      });
    }
  }

  private async lockProducts(
    tx: Prisma.TransactionClient,
    productIds: string[],
  ): Promise<void> {
    const ids = [...new Set(productIds)].sort();
    if (!ids.length) {
      return;
    }
    const conditions = ids.map((id) => Prisma.sql`"id" = ${id}::uuid`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id" FROM "produtos"
        WHERE ${Prisma.join(conditions, ' OR ')}
        ORDER BY "id"
        FOR UPDATE
      `,
    );
    if (rows.length !== ids.length) {
      throw new NotFoundException('Um ou mais produtos não foram encontrados.');
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
