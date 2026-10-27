import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { EXPIRING_LOT_DAYS, parseDateOnly } from '../inventory.common.js';
import { SfpcMonthlyMapQueryDto } from '../inventory.dto.js';

@Injectable()
export class InventoryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async stockReport() {
    const now = new Date();
    const today = parseDateOnly(now.toISOString().slice(0, 10));
    const expiryLimit = new Date(today);
    expiryLimit.setUTCDate(expiryLimit.getUTCDate() + EXPIRING_LOT_DAYS);
    const reservationCte = Prisma.sql`
      WITH reservation_sources AS (
        SELECT
          soi."produto_lote_id" AS lot_id,
          SUM(soi."quantidade_planejada") AS quantity
        FROM "ordem_servico_itens" soi
        INNER JOIN "ordens_servico" so
          ON so."id" = soi."ordem_servico_id"
        WHERE so."status" IN ('APROVADO', 'EM_MONTAGEM')
        GROUP BY soi."produto_lote_id"
        UNION ALL
        SELECT
          sqi."produto_lote_id" AS lot_id,
          SUM(sqi."quantity") AS quantity
        FROM "itens_orcamento_venda" sqi
        INNER JOIN "orcamentos_venda" sq
          ON sq."id" = sqi."orcamento_id"
        WHERE sq."status" = 'EMITIDO'
          AND sq."expira_em" > ${now}
        GROUP BY sqi."produto_lote_id"
      ),
      reservations AS (
        SELECT lot_id, SUM(quantity) AS quantity
        FROM reservation_sources
        GROUP BY lot_id
      )
    `;
    const [productRows, lotRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          productId: string;
          sku: string;
          productName: string;
          unit: string;
          neqGrams: Prisma.Decimal;
          lotCount: bigint;
          physicalQuantity: Prisma.Decimal;
          reservedQuantity: Prisma.Decimal;
          availableQuantity: Prisma.Decimal;
          quarantinedQuantity: Prisma.Decimal;
          blockedQuantity: Prisma.Decimal;
          expiredQuantity: Prisma.Decimal;
          expiringQuantity: Prisma.Decimal;
        }>
      >(
        Prisma.sql`${reservationCte}
          SELECT
            p."id" AS "productId",
            p."codigo_sku" AS sku,
            p."nome" AS "productName",
            p."unidade_medida" AS unit,
            p."massa_neq_gramas" AS "neqGrams",
            COUNT(l."id") AS "lotCount",
            SUM(l."quantidade") AS "physicalQuantity",
            SUM(COALESCE(r.quantity, 0)) AS "reservedQuantity",
            SUM(
              CASE
                WHEN l."status" = 'DISPONIVEL' AND l."data_validade" >= ${today}
                  THEN GREATEST(l."quantidade" - COALESCE(r.quantity, 0), 0)
                ELSE 0
              END
            ) AS "availableQuantity",
            SUM(
              CASE WHEN l."status" = 'QUARENTENA' THEN l."quantidade" ELSE 0 END
            ) AS "quarantinedQuantity",
            SUM(
              CASE WHEN l."status" = 'BLOQUEADO' THEN l."quantidade" ELSE 0 END
            ) AS "blockedQuantity",
            SUM(
              CASE WHEN l."data_validade" < ${today}
                THEN l."quantidade" ELSE 0 END
            ) AS "expiredQuantity",
            SUM(
              CASE
                WHEN l."data_validade" >= ${today}
                  AND l."data_validade" <= ${expiryLimit}
                  THEN l."quantidade"
                ELSE 0
              END
            ) AS "expiringQuantity"
          FROM "produto_lotes" l
          INNER JOIN "produtos" p ON p."id" = l."produto_id"
          LEFT JOIN reservations r ON r.lot_id = l."id"
          WHERE l."quantidade" > 0
          GROUP BY p."id", p."codigo_sku", p."nome", p."unidade_medida",
            p."massa_neq_gramas"
          ORDER BY SUM(l."quantidade") DESC, p."nome" ASC`,
      ),
      this.prisma.$queryRaw<
        Array<{
          lotId: string;
          productId: string;
          sku: string;
          productName: string;
          unit: string;
          lotNumber: string;
          magazineId: string;
          magazineName: string;
          expiresAt: Date;
          status: string;
          statusReason: string | null;
          physicalQuantity: Prisma.Decimal;
          reservedQuantity: Prisma.Decimal;
          availableQuantity: Prisma.Decimal;
        }>
      >(
        Prisma.sql`${reservationCte}
          SELECT
            l."id" AS "lotId",
            p."id" AS "productId",
            p."codigo_sku" AS sku,
            p."nome" AS "productName",
            p."unidade_medida" AS unit,
            l."numero_lote" AS "lotNumber",
            m."id" AS "magazineId",
            m."nome" AS "magazineName",
            l."data_validade" AS "expiresAt",
            l."status"::text AS "status",
            l."motivo_status" AS "statusReason",
            l."quantidade" AS "physicalQuantity",
            COALESCE(r.quantity, 0) AS "reservedQuantity",
            CASE
              WHEN l."status" != 'DISPONIVEL' OR l."data_validade" < ${today} THEN 0
              ELSE GREATEST(l."quantidade" - COALESCE(r.quantity, 0), 0)
            END AS "availableQuantity"
          FROM "produto_lotes" l
          INNER JOIN "produtos" p ON p."id" = l."produto_id"
          INNER JOIN "paioes" m ON m."id" = l."paiol_id"
          LEFT JOIN reservations r ON r.lot_id = l."id"
          WHERE l."quantidade" > 0
            AND l."data_validade" <= ${expiryLimit}
          ORDER BY l."data_validade" ASC, l."numero_lote" ASC`,
      ),
    ]);
    const zero = () => new Prisma.Decimal(0);
    const totals = productRows.reduce(
      (sum, product) => ({
        lotCount: sum.lotCount + Number(product.lotCount),
        physicalQuantity: sum.physicalQuantity.plus(product.physicalQuantity),
        reservedQuantity: sum.reservedQuantity.plus(product.reservedQuantity),
        availableQuantity: sum.availableQuantity.plus(
          product.availableQuantity,
        ),
        quarantinedQuantity: sum.quarantinedQuantity.plus(
          product.quarantinedQuantity,
        ),
        blockedQuantity: sum.blockedQuantity.plus(product.blockedQuantity),
        expiredQuantity: sum.expiredQuantity.plus(product.expiredQuantity),
        expiringQuantity: sum.expiringQuantity.plus(product.expiringQuantity),
      }),
      {
        lotCount: 0,
        physicalQuantity: zero(),
        reservedQuantity: zero(),
        availableQuantity: zero(),
        quarantinedQuantity: zero(),
        blockedQuantity: zero(),
        expiredQuantity: zero(),
        expiringQuantity: zero(),
      },
    );
    const serializeLot = (lot: (typeof lotRows)[number]) => ({
      lotId: lot.lotId,
      productId: lot.productId,
      sku: lot.sku,
      productName: lot.productName,
      unit: lot.unit,
      lotNumber: lot.lotNumber,
      magazineId: lot.magazineId,
      magazineName: lot.magazineName,
      expiresAt: lot.expiresAt,
      status: lot.status,
      statusReason: lot.statusReason,
      physicalQuantity: lot.physicalQuantity.toString(),
      reservedQuantity: lot.reservedQuantity.toString(),
      availableQuantity: lot.availableQuantity.toString(),
    });
    const todayString = now.toISOString().slice(0, 10);
    return {
      asOf: now.toISOString(),
      expiryWindowDays: EXPIRING_LOT_DAYS,
      totals: {
        lotCount: totals.lotCount,
        physicalQuantity: totals.physicalQuantity.toString(),
        reservedQuantity: totals.reservedQuantity.toString(),
        availableQuantity: totals.availableQuantity.toString(),
        quarantinedQuantity: totals.quarantinedQuantity.toString(),
        blockedQuantity: totals.blockedQuantity.toString(),
        expiredQuantity: totals.expiredQuantity.toString(),
        expiringQuantity: totals.expiringQuantity.toString(),
      },
      byProduct: productRows.map((product) => ({
        productId: product.productId,
        sku: product.sku,
        productName: product.productName,
        unit: product.unit,
        lotCount: Number(product.lotCount),
        neqKg: product.physicalQuantity
          .mul(product.neqGrams)
          .div(1000)
          .toString(),
        physicalQuantity: product.physicalQuantity.toString(),
        reservedQuantity: product.reservedQuantity.toString(),
        availableQuantity: product.availableQuantity.toString(),
        quarantinedQuantity: product.quarantinedQuantity.toString(),
        blockedQuantity: product.blockedQuantity.toString(),
        expiredQuantity: product.expiredQuantity.toString(),
        expiringQuantity: product.expiringQuantity.toString(),
      })),
      expiringLots: lotRows
        .filter(
          (lot) => lot.expiresAt.toISOString().slice(0, 10) >= todayString,
        )
        .map(serializeLot),
      expiredLots: lotRows
        .filter((lot) => lot.expiresAt.toISOString().slice(0, 10) < todayString)
        .map(serializeLot),
    };
  }

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
