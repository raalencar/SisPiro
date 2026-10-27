import { Injectable } from '@nestjs/common';
import {
  FinancialDirection,
  FinancialEntryStatus,
  FinancialPaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  AgingReportQueryDto,
  CashFlowQueryDto,
  FinanceDashboardQueryDto,
  FinancePaymentReportQueryDto,
} from '../finance.dto.js';
import {
  addDays,
  assertValidPeriod,
  dateOnly,
} from './finance.common.js';

@Injectable()
export class FinanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async cashFlow(query: CashFlowQueryDto) {
    assertValidPeriod(query);
    const payments = await this.prisma.financialPayment.findMany({
      where: {
        occurredAt: {
          gte: new Date(`${query.from}T00:00:00.000Z`),
          lt: new Date(`${addDays(query.to, 1)}T00:00:00.000Z`),
        },
      },
      include: { entry: { select: { direction: true, category: true } } },
      orderBy: { occurredAt: 'asc' },
    });
    const days = new Map<
      string,
      { received: Prisma.Decimal; paid: Prisma.Decimal; net: Prisma.Decimal }
    >();
    let received = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    for (const payment of payments) {
      const day = payment.occurredAt.toISOString().slice(0, 10);
      const totals = days.get(day) ?? {
        received: new Prisma.Decimal(0),
        paid: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
      };
      if (payment.entry.direction === FinancialDirection.RECEBER) {
        received = received.plus(payment.amount);
        totals.received = totals.received.plus(payment.amount);
        totals.net = totals.net.plus(payment.amount);
      } else {
        paid = paid.plus(payment.amount);
        totals.paid = totals.paid.plus(payment.amount);
        totals.net = totals.net.minus(payment.amount);
      }
      days.set(day, totals);
    }
    return {
      from: query.from,
      to: query.to,
      basis: 'pagamentos realizados no período',
      totals: {
        received: received.toString(),
        paid: paid.toString(),
        net: received.minus(paid).toString(),
      },
      days: [...days.entries()].map(([date, totals]) => ({
        date,
        received: totals.received.toString(),
        paid: totals.paid.toString(),
        net: totals.net.toString(),
      })),
    };
  }

  async dashboard(query: FinanceDashboardQueryDto) {
    assertValidPeriod(query);
    const asOf = new Date();
    const [realized, balanceRows] = await Promise.all([
      this.cashFlow(query),
      this.prisma.$queryRaw<
        Array<{
          direction: FinancialDirection;
          bucket: 'dueBeforePeriod' | 'dueInPeriod';
          amount: Prisma.Decimal;
        }>
      >`
        WITH eligible_entries AS (
          SELECT
            "id",
            "direction",
            "data_vencimento",
            "amount",
            "credito_aplicado"
          FROM "lancamentos_financeiros"
          WHERE "status" <> 'CANCELADO'
            AND "data_vencimento" <= ${dateOnly(query.to)}
        ),
        payment_totals AS (
          SELECT p."lancamento_id", SUM(p."amount") AS paid
          FROM "pagamentos_financeiros" p
          INNER JOIN eligible_entries e ON e."id" = p."lancamento_id"
          GROUP BY p."lancamento_id"
        ),
        open_balances AS (
          SELECT
            e."direction",
            CASE
              WHEN e."data_vencimento" < ${dateOnly(query.from)}
                THEN 'dueBeforePeriod'
              ELSE 'dueInPeriod'
            END AS bucket,
            e."amount" - e."credito_aplicado" - COALESCE(p.paid, 0) AS amount
          FROM eligible_entries e
          LEFT JOIN payment_totals p ON p."lancamento_id" = e."id"
        )
        SELECT direction, bucket, SUM(amount) AS amount
        FROM open_balances
        WHERE amount > 0
        GROUP BY direction, bucket
      `,
    ]);
    const zero = () => ({
      receivable: new Prisma.Decimal(0),
      payable: new Prisma.Decimal(0),
    });
    const openBalances = {
      dueBeforePeriod: zero(),
      dueInPeriod: zero(),
    };
    for (const row of balanceRows) {
      const directionKey =
        row.direction === FinancialDirection.RECEBER ? 'receivable' : 'payable';
      openBalances[row.bucket][directionKey] = row.amount;
    }
    return {
      period: { from: query.from, to: query.to },
      realized,
      openBalances: {
        asOf: asOf.toISOString(),
        dueBeforePeriod: {
          receivable: openBalances.dueBeforePeriod.receivable.toString(),
          payable: openBalances.dueBeforePeriod.payable.toString(),
        },
        dueInPeriod: {
          receivable: openBalances.dueInPeriod.receivable.toString(),
          payable: openBalances.dueInPeriod.payable.toString(),
        },
      },
    };
  }

  async paymentBreakdown(query: FinancePaymentReportQueryDto) {
    assertValidPeriod(query);
    const rows = await this.prisma.$queryRaw<
      Array<{
        category: string;
        direction: FinancialDirection;
        method: FinancialPaymentMethod;
        paymentCount: bigint;
        amount: Prisma.Decimal;
      }>
    >`
      SELECT
        e."category",
        e."direction",
        p."method",
        COUNT(p."id") AS "paymentCount",
        SUM(p."amount") AS amount
      FROM "pagamentos_financeiros" p
      INNER JOIN "lancamentos_financeiros" e
        ON e."id" = p."lancamento_id"
      WHERE p."ocorrido_em" >= ${dateOnly(query.from)}
        AND p."ocorrido_em" < ${dateOnly(addDays(query.to, 1))}
      GROUP BY e."category", e."direction", p."method"
      ORDER BY e."category" ASC, p."method" ASC
    `;
    type PaymentTotals = {
      paymentCount: number;
      received: Prisma.Decimal;
      paid: Prisma.Decimal;
    };
    const zeroTotals = (): PaymentTotals => ({
      paymentCount: 0,
      received: new Prisma.Decimal(0),
      paid: new Prisma.Decimal(0),
    });
    const categoryTotals = new Map<string, PaymentTotals>();
    const methodTotals = new Map<FinancialPaymentMethod, PaymentTotals>();
    const categoryMethodTotals = new Map<
      string,
      PaymentTotals & {
        category: string;
        method: FinancialPaymentMethod;
      }
    >();
    const totals = zeroTotals();
    for (const row of rows) {
      const count = Number(row.paymentCount);
      const category = categoryTotals.get(row.category) ?? zeroTotals();
      const method = methodTotals.get(row.method) ?? zeroTotals();
      const categoryMethodKey = JSON.stringify([row.category, row.method]);
      const categoryMethod = categoryMethodTotals.get(categoryMethodKey) ?? {
        ...zeroTotals(),
        category: row.category,
        method: row.method,
      };
      for (const aggregate of [totals, category, method, categoryMethod]) {
        aggregate.paymentCount += count;
        if (row.direction === FinancialDirection.RECEBER) {
          aggregate.received = aggregate.received.plus(row.amount);
        } else {
          aggregate.paid = aggregate.paid.plus(row.amount);
        }
      }
      categoryTotals.set(row.category, category);
      methodTotals.set(row.method, method);
      categoryMethodTotals.set(categoryMethodKey, categoryMethod);
    }
    const serializeTotals = (aggregate: PaymentTotals) => ({
      paymentCount: aggregate.paymentCount,
      received: aggregate.received.toString(),
      paid: aggregate.paid.toString(),
      net: aggregate.received.minus(aggregate.paid).toString(),
    });
    return {
      period: { from: query.from, to: query.to },
      basis: 'pagamentos e recebimentos pela data de ocorrência',
      totals: serializeTotals(totals),
      byCategory: [...categoryTotals.entries()]
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([category, aggregate]) => ({
          category,
          ...serializeTotals(aggregate),
        })),
      byMethod: Object.values(FinancialPaymentMethod).map((method) => ({
        method,
        ...serializeTotals(methodTotals.get(method) ?? zeroTotals()),
      })),
      byCategoryAndMethod: [...categoryMethodTotals.values()]
        .sort(
          (first, second) =>
            first.category.localeCompare(second.category) ||
            first.method.localeCompare(second.method),
        )
        .map((aggregate) => ({
          category: aggregate.category,
          method: aggregate.method,
          ...serializeTotals(aggregate),
        })),
    };
  }

  async agingReport(query: AgingReportQueryDto) {
    const referenceStr =
      query.referenceDate ?? new Date().toISOString().slice(0, 10);
    const referenceDate = dateOnly(referenceStr);

    const where: Prisma.FinancialEntryWhereInput = {
      status: {
        in: [FinancialEntryStatus.ABERTO, FinancialEntryStatus.PARCIAL],
      },
      ...(query.direction ? { direction: query.direction } : {}),
    };

    const entries = await this.prisma.financialEntry.findMany({
      where,
      include: {
        payments: { select: { amount: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const createBucket = () => ({
      count: 0,
      amount: new Prisma.Decimal(0),
    });

    const createDirectionAging = () => ({
      current: createBucket(),
      overdue1to30: createBucket(),
      overdue31to60: createBucket(),
      overdue61to90: createBucket(),
      overdueOver90: createBucket(),
      total: createBucket(),
    });

    const report = {
      payable: createDirectionAging(),
      receivable: createDirectionAging(),
    };

    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      const paid = entry.payments.reduce(
        (sum, p) => sum.plus(p.amount),
        new Prisma.Decimal(0),
      );
      const remaining = entry.amount.minus(paid).minus(entry.creditedAmount);
      if (remaining.lte(0)) {
        continue;
      }

      const dirKey =
        entry.direction === FinancialDirection.PAGAR ? 'payable' : 'receivable';
      const targetAging = report[dirKey];

      const entryDue = dateOnly(entry.dueDate.toISOString().slice(0, 10));
      const diffMs = referenceDate.getTime() - entryDue.getTime();
      const daysOverdue = Math.floor(diffMs / MS_PER_DAY);

      let bucket: { count: number; amount: Prisma.Decimal };
      if (daysOverdue <= 0) {
        bucket = targetAging.current;
      } else if (daysOverdue <= 30) {
        bucket = targetAging.overdue1to30;
      } else if (daysOverdue <= 60) {
        bucket = targetAging.overdue31to60;
      } else if (daysOverdue <= 90) {
        bucket = targetAging.overdue61to90;
      } else {
        bucket = targetAging.overdueOver90;
      }

      bucket.count++;
      bucket.amount = bucket.amount.plus(remaining);

      targetAging.total.count++;
      targetAging.total.amount = targetAging.total.amount.plus(remaining);
    }

    const serializeBucket = (b: {
      count: number;
      amount: Prisma.Decimal;
    }) => ({
      count: b.count,
      amount: b.amount.toString(),
    });

    const serializeDirection = (
      d: ReturnType<typeof createDirectionAging>,
    ) => ({
      current: serializeBucket(d.current),
      overdue1to30: serializeBucket(d.overdue1to30),
      overdue31to60: serializeBucket(d.overdue31to60),
      overdue61to90: serializeBucket(d.overdue61to90),
      overdueOver90: serializeBucket(d.overdueOver90),
      total: serializeBucket(d.total),
    });

    return {
      referenceDate: referenceStr,
      direction: query.direction ?? null,
      payable: serializeDirection(report.payable),
      receivable: serializeDirection(report.receivable),
    };
  }
}
