import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialEntryStatus,
  Prisma,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CreateFinancialPaymentDto } from '../finance.dto.js';
import { serializeEntry } from './finance.common.js';

@Injectable()
export class FinanceSettlementsService {
  constructor(private readonly prisma: PrismaService) {}

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
      if (!entry) {
        throw new NotFoundException('Lançamento financeiro não encontrado.');
      }
      if (
        entry.status === FinancialEntryStatus.CANCELADO ||
        entry.status === FinancialEntryStatus.PAGO ||
        entry.status === FinancialEntryStatus.COMPENSADO
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
      const remaining = entry.amount.minus(paid).minus(entry.creditedAmount);
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
      const outstanding = entry.amount
        .minus(nextPaid)
        .minus(entry.creditedAmount);
      const nextStatus = outstanding.eq(0)
        ? nextPaid.eq(0)
          ? FinancialEntryStatus.COMPENSADO
          : FinancialEntryStatus.PAGO
        : FinancialEntryStatus.PARCIAL;
      await tx.financialEntry.update({
        where: { id },
        data: { status: nextStatus },
      });
      await createAuditLog(tx, {
        data: {
          action: 'finance.payment.registered',
          aggregateType: 'FinancialEntry',
          aggregateId: id,
          before: {
            status: entry.status,
            paid: paid.toString(),
            creditedAmount: entry.creditedAmount.toString(),
            outstanding: remaining.toString(),
          },
          after: {
            paymentId: payment.id,
            amount: payment.amount.toString(),
            method: payment.method,
            occurredAt: payment.occurredAt.toISOString(),
            status: nextStatus,
            paid: nextPaid.toString(),
            creditedAmount: entry.creditedAmount.toString(),
            outstanding: outstanding.toString(),
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
      return serializeEntry(updated);
    });
  }
}
