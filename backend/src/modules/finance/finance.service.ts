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
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CashFlowQueryDto,
  CreateFinancialEntryDto,
  CreateFinancialPaymentDto,
  FinanceEntriesQueryDto,
} from './finance.dto.js';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: FinanceEntriesQueryDto) {
    if (query.dueFrom && query.dueUntil && query.dueFrom > query.dueUntil) {
      throw new BadRequestException(
        'O início do período não pode ser posterior ao término.',
      );
    }
    const where: Prisma.FinancialEntryWhereInput = {
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.dueFrom || query.dueUntil
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: this.dateOnly(query.dueFrom) } : {}),
              ...(query.dueUntil ? { lte: this.dateOnly(query.dueUntil) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              {
                counterparty: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              ...(Number.isSafeInteger(Number(query.search))
                ? [{ code: Number(query.search) }]
                : []),
            ],
          }
        : {}),
    };
    const [entries, total] = await Promise.all([
      this.prisma.financialEntry.findMany({
        where,
        include: {
          customer: true,
          supplier: true,
          receiptBatch: {
            include: {
              purchase: {
                select: { id: true, code: true, reference: true },
              },
            },
          },
          serviceOrder: {
            select: {
              id: true,
              code: true,
              eventAt: true,
              eventLocation: true,
            },
          },
          payments: true,
        },
        orderBy: [{ dueDate: 'asc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.financialEntry.count({ where }),
    ]);
    return {
      data: entries.map((entry) => this.serialize(entry)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async create(dto: CreateFinancialEntryDto) {
    if (dto.direction === FinancialDirection.PAGAR && dto.customerId) {
      throw new BadRequestException(
        'Conta a pagar não pode ser vinculada a um cliente.',
      );
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
        select: { id: true, active: true, legalName: true },
      });
      if (!customer) {
        throw new NotFoundException('Cliente não encontrado.');
      }
      if (!customer.active) {
        throw new ConflictException(
          'Não é possível criar conta a receber para cliente inativo.',
        );
      }
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.financialEntry.create({
        data: {
          direction: dto.direction,
          description: dto.description.trim(),
          category: dto.category.trim(),
          counterparty: dto.counterparty.trim(),
          customerId: dto.customerId ?? null,
          amount: new Prisma.Decimal(dto.amount),
          dueDate: this.dateOnly(dto.dueDate),
          reference: dto.reference?.trim() || null,
        },
        include: {
          customer: true,
          supplier: true,
          receiptBatch: {
            include: {
              purchase: {
                select: { id: true, code: true, reference: true },
              },
            },
          },
          serviceOrder: {
            select: {
              id: true,
              code: true,
              eventAt: true,
              eventLocation: true,
            },
          },
          payments: true,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'finance.entry.created',
          aggregateType: 'FinancialEntry',
          aggregateId: created.id,
          after: {
            code: created.code,
            direction: created.direction,
            amount: created.amount.toString(),
            dueDate: dto.dueDate,
            category: created.category,
            customerId: created.customerId,
          },
        },
      });
      return created;
    });
    return this.serialize(entry);
  }

  async get(id: string) {
    const entry = await this.prisma.financialEntry.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        receiptBatch: {
          include: {
            purchase: { select: { id: true, code: true, reference: true } },
          },
        },
        serviceOrder: {
          select: { id: true, code: true, eventAt: true, eventLocation: true },
        },
        payments: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }
    return this.serialize(entry);
  }

  async createPayment(id: string, dto: CreateFinancialPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "lancamentos_financeiros"
        WHERE "id" = ${id}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }
      const entry = await tx.financialEntry.findUnique({
        where: { id },
        include: {
          customer: true,
          supplier: true,
          receiptBatch: {
            include: {
              purchase: {
                select: { id: true, code: true, reference: true },
              },
            },
          },
          payments: true,
        },
      });
      if (!entry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }
      if (
        entry.status === FinancialEntryStatus.CANCELADO ||
        entry.status === FinancialEntryStatus.PAGO
      ) {
        throw new ConflictException(
          'Não é possível registrar pagamento para lançamento pago ou cancelado.',
        );
      }
      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
      if (occurredAt.getTime() > Date.now()) {
        throw new BadRequestException(
          'A data do pagamento não pode estar no futuro.',
        );
      }
      const paid = entry.payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0),
      );
      const remaining = entry.amount.minus(paid);
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.gt(remaining)) {
        throw new ConflictException({
          message: 'O pagamento excede o saldo pendente.',
          outstanding: remaining.toString(),
          requested: amount.toString(),
        });
      }
      const payment = await tx.financialPayment.create({
        data: {
          entryId: entry.id,
          amount,
          method: dto.method,
          occurredAt,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      const nextPaid = paid.plus(amount);
      const nextStatus = nextPaid.eq(entry.amount)
        ? FinancialEntryStatus.PAGO
        : FinancialEntryStatus.PARCIAL;
      await tx.financialEntry.update({
        where: { id },
        data: { status: nextStatus },
      });
      await tx.auditLog.create({
        data: {
          action: 'finance.payment.registered',
          aggregateType: 'FinancialEntry',
          aggregateId: id,
          before: {
            status: entry.status,
            paid: paid.toString(),
            outstanding: remaining.toString(),
          },
          after: {
            paymentId: payment.id,
            amount: payment.amount.toString(),
            method: payment.method,
            occurredAt: payment.occurredAt.toISOString(),
            status: nextStatus,
            paid: nextPaid.toString(),
            outstanding: entry.amount.minus(nextPaid).toString(),
          },
        },
      });
      const updated = await tx.financialEntry.findUniqueOrThrow({
        where: { id },
        include: {
          customer: true,
          supplier: true,
          receiptBatch: {
            include: {
              purchase: {
                select: { id: true, code: true, reference: true },
              },
            },
          },
          serviceOrder: {
            select: {
              id: true,
              code: true,
              eventAt: true,
              eventLocation: true,
            },
          },
          payments: { orderBy: { occurredAt: 'asc' } },
        },
      });
      return this.serialize(updated);
    });
  }

  async cancel(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "lancamentos_financeiros"
        WHERE "id" = ${id}::uuid
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }
      const entry = await tx.financialEntry.findUnique({
        where: { id },
        include: { payments: true },
      });
      if (!entry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }
      if (
        entry.status !== FinancialEntryStatus.ABERTO ||
        entry.payments.length
      ) {
        throw new ConflictException(
          'Somente lançamento aberto sem pagamentos pode ser cancelado.',
        );
      }
      const cancelled = await tx.financialEntry.update({
        where: { id },
        data: { status: FinancialEntryStatus.CANCELADO },
        include: {
          customer: true,
          supplier: true,
          receiptBatch: {
            include: {
              purchase: {
                select: { id: true, code: true, reference: true },
              },
            },
          },
          serviceOrder: {
            select: {
              id: true,
              code: true,
              eventAt: true,
              eventLocation: true,
            },
          },
          payments: true,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'finance.entry.cancelled',
          aggregateType: 'FinancialEntry',
          aggregateId: id,
          before: { status: entry.status },
          after: { status: cancelled.status },
        },
      });
      return this.serialize(cancelled);
    });
  }

  async cashFlow(query: CashFlowQueryDto) {
    if (query.from > query.to) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }
    const payments = await this.prisma.financialPayment.findMany({
      where: {
        occurredAt: {
          gte: new Date(`${query.from}T00:00:00.000Z`),
          lt: new Date(`${this.addDays(query.to, 1)}T00:00:00.000Z`),
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

  private serialize<
    T extends {
      amount: Prisma.Decimal;
      dueDate: Date;
      status: FinancialEntryStatus;
      payments: Array<{ amount: Prisma.Decimal }>;
    },
  >(entry: T) {
    const paid = entry.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    const outstanding = entry.amount.minus(paid);
    const overdue =
      outstanding.gt(0) &&
      entry.status !== FinancialEntryStatus.CANCELADO &&
      entry.dueDate.toISOString().slice(0, 10) <
        new Date().toISOString().slice(0, 10);
    return {
      ...entry,
      amount: entry.amount.toString(),
      paid: paid.toString(),
      outstanding: outstanding.toString(),
      overdue,
      payments: entry.payments,
    };
  }

  private dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private addDays(value: string, days: number): string {
    const date = this.dateOnly(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
}
