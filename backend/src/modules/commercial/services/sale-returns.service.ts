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
  ProductLotStatus,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { CreateSaleReturnDto } from '../commercial.dto.js';
import {
  assertMagazineCapacity,
  assertMagazineCanReceive,
  assertNotExpired,
  dateOnly,
  lockLots,
  lockMagazine,
} from '../commercial.common.js';

@Injectable()
export class SaleReturnsService {
  constructor(private readonly prisma: PrismaService) {}

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
      await lockLots(tx, lotIds);
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
        if (lot.status === ProductLotStatus.BLOQUEADO) {
          throw new ConflictException(
            `Lote ${lot.lotNumber} está bloqueado e não pode receber devolução de produtos.`,
          );
        }
        assertNotExpired(lot.expiresAt);
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
        await lockMagazine(tx, magazineId);
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
        assertMagazineCanReceive(magazine);
        await assertMagazineCapacity(tx, magazineId, additionalNeqKg);
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
      let refundAmount = returnTotal.minus(creditApplied);
      if (refundAmount.gt(0) && !dto.dueDate) {
        if (!sale.financialEntry) {
          // Venda legada sem financeiro: se vencimento não for informado, a devolução é física sem gerar conta a pagar
          refundAmount = new Prisma.Decimal(0);
        } else {
          throw new BadRequestException(
            'Informe o vencimento do reembolso gerado pela devolução.',
          );
        }
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
        await createAuditLog(tx, {
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
            dueDate: dateOnly(dto.dueDate!),
            reference: `DEVOLUCAO-${saleReturn.code}`,
          },
        });
        await createAuditLog(tx, {
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
        await createAuditLog(tx, {
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

      await createAuditLog(tx, {
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
}
