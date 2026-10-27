import { BadRequestException } from '@nestjs/common';
import { FinancialEntryStatus, Prisma } from '@prisma/client';
import { CashFlowQueryDto } from '../finance.dto.js';

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: string, days: number): string {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function assertValidPeriod(query: CashFlowQueryDto) {
  if (query.from > query.to) {
    throw new BadRequestException(
      'A data inicial não pode ser posterior à data final.',
    );
  }
}

export function serializeEntry<
  T extends {
    amount: Prisma.Decimal;
    creditedAmount: Prisma.Decimal;
    dueDate: Date;
    status: FinancialEntryStatus;
    payments: Array<{ amount: Prisma.Decimal }>;
  },
>(entry: T) {
  const paid = entry.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );
  const outstanding = entry.amount.minus(paid).minus(entry.creditedAmount);
  const overdue =
    outstanding.gt(0) &&
    entry.status !== FinancialEntryStatus.CANCELADO &&
    entry.dueDate.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10);
  return {
    ...entry,
    amount: entry.amount.toString(),
    paid: paid.toString(),
    creditedAmount: entry.creditedAmount.toString(),
    outstanding: outstanding.toString(),
    overdue,
    payments: entry.payments,
  };
}
