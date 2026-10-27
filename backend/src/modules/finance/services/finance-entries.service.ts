import { randomUUID } from 'crypto';
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
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreateFinancialEntryDto,
  FinanceEntriesQueryDto,
} from '../finance.dto.js';
import { addDays, dateOnly, serializeEntry } from './finance.common.js';

@Injectable()
export class FinanceEntriesService {
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
              ...(query.dueFrom ? { gte: dateOnly(query.dueFrom) } : {}),
              ...(query.dueUntil ? { lte: dateOnly(query.dueUntil) } : {}),
            },
          }
        : {}),
      ...(query.installmentGroup
        ? { installmentGroup: query.installmentGroup }
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
          sale: {
            select: { id: true, code: true, quoteId: true, createdAt: true },
          },
          saleReturn: {
            select: {
              id: true,
              code: true,
              saleId: true,
              creditApplied: true,
              refundAmount: true,
            },
          },
          payments: { orderBy: { occurredAt: 'asc' } },
        },
        orderBy: [{ dueDate: 'asc' }, { code: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.financialEntry.count({ where }),
    ]);

    return {
      data: entries.map((entry) => serializeEntry(entry)),
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

    const installmentsCount = dto.installmentsCount ?? 1;
    if (installmentsCount > 1) {
      if (dto.amount < 0.01 * installmentsCount) {
        throw new BadRequestException(
          `O valor total deve ser de pelo menos R$ ${(0.01 * installmentsCount).toFixed(2)} para ${installmentsCount} parcelas.`,
        );
      }
    }

    let dueDates: string[] = [];
    if (dto.customDueDates && dto.customDueDates.length > 0) {
      if (dto.customDueDates.length !== installmentsCount) {
        throw new BadRequestException(
          `O número de datas customizadas (${dto.customDueDates.length}) deve corresponder ao número de parcelas (${installmentsCount}).`,
        );
      }
      for (let i = 0; i < dto.customDueDates.length - 1; i++) {
        if (dto.customDueDates[i] >= dto.customDueDates[i + 1]) {
          throw new BadRequestException(
            'As datas de vencimento das parcelas devem estar em ordem cronológica estritamente crescente.',
          );
        }
      }
      dueDates = dto.customDueDates;
    } else {
      const interval = dto.intervalDays ?? 30;
      dueDates = Array.from({ length: installmentsCount }, (_, i) =>
        i === 0 ? dto.dueDate : addDays(dto.dueDate, i * interval),
      );
    }

    const totalCents = Math.round(dto.amount * 100);
    const baseCents = Math.floor(totalCents / installmentsCount);
    const remainderCents = totalCents - baseCents * installmentsCount;
    const installmentGroup = installmentsCount > 1 ? randomUUID() : null;

    const entries = await this.prisma.$transaction(async (tx) => {
      const createdList = [];
      for (let i = 0; i < installmentsCount; i++) {
        const k = i + 1;
        const parcelCents = i === 0 ? baseCents + remainderCents : baseCents;
        const parcelAmount = new Prisma.Decimal((parcelCents / 100).toFixed(2));
        const parcelDesc =
          installmentsCount > 1
            ? `${dto.description.trim()} (${k}/${installmentsCount})`
            : dto.description.trim();

        const created = await tx.financialEntry.create({
          data: {
            direction: dto.direction,
            description: parcelDesc,
            category: dto.category.trim(),
            counterparty: dto.counterparty.trim(),
            customerId: dto.customerId ?? null,
            amount: parcelAmount,
            dueDate: dateOnly(dueDates[i]),
            reference: dto.reference?.trim() || null,
            installmentNumber: installmentsCount > 1 ? k : null,
            installmentCount: installmentsCount > 1 ? installmentsCount : null,
            installmentGroup,
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
            sale: {
              select: { id: true, code: true, quoteId: true, createdAt: true },
            },
            saleReturn: {
              select: {
                id: true,
                code: true,
                saleId: true,
                creditApplied: true,
                refundAmount: true,
              },
            },
            payments: true,
          },
        });

        await createAuditLog(tx, {
          data: {
            action: 'finance.entry.created',
            aggregateType: 'FinancialEntry',
            aggregateId: created.id,
            after: {
              code: created.code,
              direction: created.direction,
              amount: created.amount.toString(),
              dueDate: dueDates[i],
              category: created.category,
              customerId: created.customerId,
              installmentNumber: created.installmentNumber,
              installmentCount: created.installmentCount,
              installmentGroup: created.installmentGroup,
            },
          },
        });

        createdList.push(created);
      }
      return createdList;
    });

    if (installmentsCount === 1) {
      return serializeEntry(entries[0]);
    }

    return {
      ...serializeEntry(entries[0]),
      installments: entries.map((e) => serializeEntry(e)),
    };
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
        sale: {
          select: { id: true, code: true, quoteId: true, createdAt: true },
        },
        saleReturn: {
          select: {
            id: true,
            code: true,
            saleId: true,
            creditApplied: true,
            refundAmount: true,
          },
        },
        payments: { orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado.');
    }
    return serializeEntry(entry);
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
          sale: {
            select: { id: true, code: true, quoteId: true, createdAt: true },
          },
          saleReturn: {
            select: {
              id: true,
              code: true,
              saleId: true,
              creditApplied: true,
              refundAmount: true,
            },
          },
          payments: true,
        },
      });
      await createAuditLog(tx, {
        data: {
          action: 'finance.entry.cancelled',
          aggregateType: 'FinancialEntry',
          aggregateId: id,
          before: { status: entry.status },
          after: { status: cancelled.status },
        },
      });
      return serializeEntry(cancelled);
    });
  }
}
