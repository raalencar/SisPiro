import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  SalesQuoteStatus,
  ServiceOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export type Pagination = { page: number; limit: number };

export const EXPIRING_LOT_DAYS = 30;

export function paginatedResult<T>(data: T[], total: number, query: Pagination) {
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

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function lockLot(
  tx: Prisma.TransactionClient,
  lotId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "produto_lotes" WHERE "id" = ${lotId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new NotFoundException('Lote não encontrado.');
  }
}

export async function lockLots(
  tx: Prisma.TransactionClient,
  lotIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(lotIds)].sort();
  if (uniqueIds.length === 0) {
    return;
  }
  const conditions = uniqueIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "produto_lotes"
      WHERE ${Prisma.join(conditions, ' OR ')}
      ORDER BY "id"
      FOR UPDATE
    `,
  );
  if (rows.length !== uniqueIds.length) {
    throw new NotFoundException('Um ou mais lotes não foram encontrados.');
  }
}

export async function lockMagazines(
  tx: Prisma.TransactionClient,
  magazineIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(magazineIds)].sort();
  if (uniqueIds.length === 0) {
    return;
  }
  const conditions = uniqueIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "paioes"
      WHERE ${Prisma.join(conditions, ' OR ')}
      ORDER BY "id"
      FOR UPDATE
    `,
  );
  if (rows.length !== uniqueIds.length) {
    throw new NotFoundException('Paiol não encontrado.');
  }
}

export async function currentNeqKg(
  client: Prisma.TransactionClient | PrismaService,
  magazineId: string,
): Promise<Prisma.Decimal> {
  const [row] = await client.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
    SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
    FROM "produto_lotes" l
    JOIN "produtos" p ON p."id" = l."produto_id"
    WHERE l."paiol_id" = ${magazineId}::uuid
  `;
  return row?.neqKg ?? new Prisma.Decimal(0);
}

export async function assertCapacity(
  tx: Prisma.TransactionClient,
  magazineId: string,
  additionalNeqKg: Prisma.Decimal,
): Promise<void> {
  const magazine = await tx.magazine.findUnique({
    where: { id: magazineId },
  });
  if (!magazine) {
    throw new NotFoundException('Paiol não encontrado.');
  }

  const current = await currentNeqKg(tx, magazineId);
  const projected = current.plus(additionalNeqKg);
  if (projected.gt(magazine.maxNeqCapacityKg)) {
    throw new ConflictException({
      message: 'Movimentação bloqueada: capacidade NEQ do paiol excedida.',
      magazineId,
      capacityKg: magazine.maxNeqCapacityKg.toString(),
      currentNeqKg: current.toString(),
      requestedIncreaseKg: additionalNeqKg.toString(),
      projectedNeqKg: projected.toString(),
    });
  }
}

export async function assertUnreservedQuantity(
  tx: Prisma.TransactionClient,
  lotId: string,
  quantityToRemove: Prisma.Decimal,
): Promise<void> {
  const reserved = await tx.serviceOrderItem.aggregate({
    where: {
      productLotId: lotId,
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
  const activeSalesQuotes = await tx.salesQuoteItem.aggregate({
    where: {
      productLotId: lotId,
      quote: {
        status: SalesQuoteStatus.EMITIDO,
        expiresAt: { gt: new Date() },
      },
    },
    _sum: { quantity: true },
  });
  const quoteReserved =
    activeSalesQuotes._sum.quantity ?? new Prisma.Decimal(0);
  const totalReserved = reservedQuantity.plus(quoteReserved);
  const lot = await tx.productLot.findUnique({
    where: { id: lotId },
    select: { quantity: true },
  });
  const available = (lot?.quantity ?? new Prisma.Decimal(0)).minus(
    totalReserved,
  );
  if (available.lt(quantityToRemove)) {
    throw new ConflictException({
      message:
        'Movimentação bloqueada: o saldo está reservado por ordem de serviço ou orçamento comercial.',
      lotId,
      available: available.toString(),
      requested: quantityToRemove.toString(),
    });
  }
}

export function assertCanReceive(
  magazine: {
    active: boolean;
    fireLicenseExpiresAt: Date;
  } | null,
): void {
  if (!magazine) {
    throw new NotFoundException('Paiol não encontrado.');
  }
  if (!magazine.active) {
    throw new ConflictException(
      'O paiol está inativo e não pode receber estoque.',
    );
  }
  if (
    magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  ) {
    throw new ConflictException(
      'O paiol está com a licença dos Bombeiros vencida e não pode receber estoque.',
    );
  }
}

export function assertLotNotExpired(expiresAt: Date): void {
  if (
    expiresAt.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  ) {
    throw new ConflictException(
      'Lote vencido não pode ser transferido ou baixado por este fluxo.',
    );
  }
}
