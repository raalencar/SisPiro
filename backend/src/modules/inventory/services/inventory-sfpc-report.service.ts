import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { SfpcMonthlyMapQueryDto } from '../inventory.dto.js';

@Injectable()
export class InventorySfpcReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getSfpcMonthlyMap(query: SfpcMonthlyMapQueryDto) {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const pceProducts = await this.prisma.product.findMany({
      where: { isPce: true },
      orderBy: [{ riskClass: 'asc' }, { name: 'asc' }],
      include: {
        lots: {
          select: {
            id: true,
            quantity: true,
            status: true,
          },
        },
      },
    });

    const productIds = pceProducts.map((p) => p.id);
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        productLot: {
          productId: { in: productIds },
        },
        occurredAt: {
          gte: periodStart,
        },
      },
      include: {
        productLot: {
          select: {
            productId: true,
          },
        },
      },
      orderBy: { occurredAt: 'asc' },
    });

    const zero = () => new Prisma.Decimal(0);

    const items = pceProducts.map((product) => {
      const currentPhysical = product.lots.reduce(
        (sum, lot) => sum.plus(lot.quantity),
        zero(),
      );

      const productMovements = movements.filter(
        (m) => m.productLot.productId === product.id,
      );

      let purchasesInflow = zero();
      let returnsInflow = zero();
      let adjustmentsInflow = zero();

      let salesOutflow = zero();
      let serviceOrdersOutflow = zero();
      let adjustmentsOutflow = zero();

      let netDeltaSincePeriodStartToNow = zero();

      for (const m of productMovements) {
        const qty = m.quantity;
        const isWithinPeriod = m.occurredAt <= periodEnd;

        if (m.type === StockMovementType.ENTRADA) {
          const isSplitChild = m.reference?.startsWith('DESMEMBRADO_DE_');
          if (!isSplitChild) {
            netDeltaSincePeriodStartToNow = netDeltaSincePeriodStartToNow.plus(qty);
            if (isWithinPeriod) {
              if (
                m.reference?.includes('RECEBIMENTO') ||
                m.reference?.includes('COMPRA')
              ) {
                purchasesInflow = purchasesInflow.plus(qty);
              } else if (m.reference?.includes('DEVOLUCAO')) {
                returnsInflow = returnsInflow.plus(qty);
              } else {
                adjustmentsInflow = adjustmentsInflow.plus(qty);
              }
            }
          }
        } else if (m.type === StockMovementType.SAIDA) {
          netDeltaSincePeriodStartToNow = netDeltaSincePeriodStartToNow.minus(qty);
          if (isWithinPeriod) {
            if (m.reference?.includes('VENDA')) {
              salesOutflow = salesOutflow.plus(qty);
            } else if (
              m.reference?.startsWith('OS-') ||
              m.reference?.includes('ORDEM_SERVICO')
            ) {
              serviceOrdersOutflow = serviceOrdersOutflow.plus(qty);
            } else {
              adjustmentsOutflow = adjustmentsOutflow.plus(qty);
            }
          }
        } else if (m.type === StockMovementType.AJUSTE) {
          netDeltaSincePeriodStartToNow = netDeltaSincePeriodStartToNow.plus(qty);
          if (isWithinPeriod) {
            if (qty.isPositive()) {
              adjustmentsInflow = adjustmentsInflow.plus(qty);
            } else {
              adjustmentsOutflow = adjustmentsOutflow.plus(qty.abs());
            }
          }
        }
      }

      const totalInflow = purchasesInflow
        .plus(returnsInflow)
        .plus(adjustmentsInflow);
      const totalOutflow = salesOutflow
        .plus(serviceOrdersOutflow)
        .plus(adjustmentsOutflow);

      const initialQuantity = currentPhysical.minus(
        netDeltaSincePeriodStartToNow,
      );
      const finalQuantity = initialQuantity
        .plus(totalInflow)
        .minus(totalOutflow);

      const neqGrams = product.neqGrams;
      const initialNeqKg = initialQuantity.mul(neqGrams).div(1000);
      const inflowNeqKg = totalInflow.mul(neqGrams).div(1000);
      const outflowNeqKg = totalOutflow.mul(neqGrams).div(1000);
      const finalNeqKg = finalQuantity.mul(neqGrams).div(1000);

      return {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        riskClass: product.riskClass ?? 'NÃO CLASSIFICADO',
        unit: product.unit,
        neqGrams: neqGrams.toString(),
        initialQuantity: initialQuantity.toString(),
        inflowBreakdown: {
          purchases: purchasesInflow.toString(),
          returns: returnsInflow.toString(),
          adjustments: adjustmentsInflow.toString(),
          total: totalInflow.toString(),
        },
        outflowBreakdown: {
          sales: salesOutflow.toString(),
          serviceOrders: serviceOrdersOutflow.toString(),
          adjustments: adjustmentsOutflow.toString(),
          total: totalOutflow.toString(),
        },
        finalQuantity: finalQuantity.toString(),
        initialNeqKg: initialNeqKg.toString(),
        inflowNeqKg: inflowNeqKg.toString(),
        outflowNeqKg: outflowNeqKg.toString(),
        finalNeqKg: finalNeqKg.toString(),
      };
    });

    const byRiskClassMap = new Map<
      string,
      {
        riskClass: string;
        productCount: number;
        initialQuantity: Prisma.Decimal;
        inflowQuantity: Prisma.Decimal;
        outflowQuantity: Prisma.Decimal;
        finalQuantity: Prisma.Decimal;
        initialNeqKg: Prisma.Decimal;
        inflowNeqKg: Prisma.Decimal;
        outflowNeqKg: Prisma.Decimal;
        finalNeqKg: Prisma.Decimal;
      }
    >();

    for (const item of items) {
      const current = byRiskClassMap.get(item.riskClass) ?? {
        riskClass: item.riskClass,
        productCount: 0,
        initialQuantity: zero(),
        inflowQuantity: zero(),
        outflowQuantity: zero(),
        finalQuantity: zero(),
        initialNeqKg: zero(),
        inflowNeqKg: zero(),
        outflowNeqKg: zero(),
        finalNeqKg: zero(),
      };

      current.productCount += 1;
      current.initialQuantity = current.initialQuantity.plus(
        new Prisma.Decimal(item.initialQuantity),
      );
      current.inflowQuantity = current.inflowQuantity.plus(
        new Prisma.Decimal(item.inflowBreakdown.total),
      );
      current.outflowQuantity = current.outflowQuantity.plus(
        new Prisma.Decimal(item.outflowBreakdown.total),
      );
      current.finalQuantity = current.finalQuantity.plus(
        new Prisma.Decimal(item.finalQuantity),
      );
      current.initialNeqKg = current.initialNeqKg.plus(
        new Prisma.Decimal(item.initialNeqKg),
      );
      current.inflowNeqKg = current.inflowNeqKg.plus(
        new Prisma.Decimal(item.inflowNeqKg),
      );
      current.outflowNeqKg = current.outflowNeqKg.plus(
        new Prisma.Decimal(item.outflowNeqKg),
      );
      current.finalNeqKg = current.finalNeqKg.plus(
        new Prisma.Decimal(item.finalNeqKg),
      );

      byRiskClassMap.set(item.riskClass, current);
    }

    const byRiskClass = Array.from(byRiskClassMap.values()).map((rc) => ({
      riskClass: rc.riskClass,
      productCount: rc.productCount,
      initialQuantity: rc.initialQuantity.toString(),
      inflowQuantity: rc.inflowQuantity.toString(),
      outflowQuantity: rc.outflowQuantity.toString(),
      finalQuantity: rc.finalQuantity.toString(),
      initialNeqKg: rc.initialNeqKg.toString(),
      inflowNeqKg: rc.inflowNeqKg.toString(),
      outflowNeqKg: rc.outflowNeqKg.toString(),
      finalNeqKg: rc.finalNeqKg.toString(),
    }));

    const totals = items.reduce(
      (acc, item) => ({
        productCount: acc.productCount + 1,
        initialBalanceNeqKg: acc.initialBalanceNeqKg.plus(
          new Prisma.Decimal(item.initialNeqKg),
        ),
        inflowNeqKg: acc.inflowNeqKg.plus(new Prisma.Decimal(item.inflowNeqKg)),
        outflowNeqKg: acc.outflowNeqKg.plus(
          new Prisma.Decimal(item.outflowNeqKg),
        ),
        finalBalanceNeqKg: acc.finalBalanceNeqKg.plus(
          new Prisma.Decimal(item.finalNeqKg),
        ),
      }),
      {
        productCount: 0,
        initialBalanceNeqKg: zero(),
        inflowNeqKg: zero(),
        outflowNeqKg: zero(),
        finalBalanceNeqKg: zero(),
      },
    );

    return {
      year,
      month,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      generatedAt: now.toISOString(),
      totals: {
        productCount: totals.productCount,
        initialBalanceNeqKg: totals.initialBalanceNeqKg.toString(),
        inflowNeqKg: totals.inflowNeqKg.toString(),
        outflowNeqKg: totals.outflowNeqKg.toString(),
        finalBalanceNeqKg: totals.finalBalanceNeqKg.toString(),
      },
      byRiskClass,
      items,
    };
  }
}
