import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Prisma, SalesQuoteStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  QuotesConversionReportQueryDto,
  SalesReportQueryDto,
} from '../commercial.dto.js';
import { dateOnly, effectiveQuoteStatus } from '../commercial.common.js';

@Injectable()
export class CommercialReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async salesReport(query: SalesReportQueryDto) {
    if (query.from > query.to) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }
    const from = new Date(`${query.from}T00:00:00.000Z`);
    const until = dateOnly(query.to);
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

  async quotesConversionReport(query: QuotesConversionReportQueryDto) {
    const fromDate = dateOnly(query.from);
    const toDateExclusive = new Date(
      dateOnly(query.to).getTime() + 24 * 60 * 60 * 1000,
    );

    const quotes = await this.prisma.salesQuote.findMany({
      where: {
        createdAt: {
          gte: fromDate,
          lt: toDateExclusive,
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        total: true,
        createdAt: true,
        expiresAt: true,
        convertedAt: true,
      },
    });

    const totalQuotes = quotes.length;
    let convertedQuotes = 0;
    let canceledQuotes = 0;
    let expiredQuotes = 0;
    let activeQuotes = 0;

    let totalQuotedAmount = new Prisma.Decimal(0);
    let totalConvertedAmount = new Prisma.Decimal(0);

    for (const q of quotes) {
      totalQuotedAmount = totalQuotedAmount.plus(q.total);
      const effective = effectiveQuoteStatus(q);
      if (effective === SalesQuoteStatus.CONVERTIDO) {
        convertedQuotes++;
        totalConvertedAmount = totalConvertedAmount.plus(q.total);
      } else if (effective === SalesQuoteStatus.CANCELADO) {
        canceledQuotes++;
      } else if (effective === SalesQuoteStatus.EXPIRADO) {
        expiredQuotes++;
      } else {
        activeQuotes++;
      }
    }

    const conversionRatePercent =
      totalQuotes > 0
        ? new Prisma.Decimal((convertedQuotes / totalQuotes) * 100)
            .toDecimalPlaces(2)
            .toNumber()
        : 0;

    const averageTicket =
      convertedQuotes > 0
        ? totalConvertedAmount.dividedBy(convertedQuotes).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    return {
      period: { from: query.from, to: query.to },
      totals: {
        quotesCount: totalQuotes,
        convertedCount: convertedQuotes,
        canceledCount: canceledQuotes,
        expiredCount: expiredQuotes,
        activeCount: activeQuotes,
        conversionRatePercent,
        quotedAmount: totalQuotedAmount.toString(),
        convertedAmount: totalConvertedAmount.toString(),
        averageTicket: averageTicket.toString(),
      },
    };
  }
}
