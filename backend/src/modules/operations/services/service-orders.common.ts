import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';

export const RESERVED_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.APROVADO,
  ServiceOrderStatus.EM_MONTAGEM,
];

export async function lockOrder(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "ordens_servico" WHERE "id" = ${id}::uuid FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new NotFoundException('Ordem de serviço não encontrada.');
  }
}

export async function lockLots(
  tx: Prisma.TransactionClient,
  ids: string[],
): Promise<void> {
  const uniqueIds = [...new Set(ids)].sort();
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

export function assertNotExpired(expiresAt: Date): void {
  if (
    expiresAt.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  ) {
    throw new ConflictException(
      'Lote vencido não pode ser reservado para uma OS.',
    );
  }
}

export function assertMagazineCanStore(magazine: {
  active: boolean;
  fireLicenseExpiresAt: Date;
}): void {
  if (!magazine.active) {
    throw new ConflictException(
      'O paiol do lote está inativo e não pode ser reservado para OS.',
    );
  }
  if (
    magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  ) {
    throw new ConflictException(
      'O paiol do lote está com a licença dos Bombeiros vencida.',
    );
  }
}

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function auditServiceOrder(
  tx: Prisma.TransactionClient,
  action: string,
  aggregateId: string,
  before: Prisma.InputJsonValue | undefined,
  after: Prisma.InputJsonValue,
): Promise<void> {
  await createAuditLog(tx, {
    data: {
      action,
      aggregateType: 'ServiceOrder',
      aggregateId,
      ...(before ? { before } : {}),
      after,
    },
  });
}

export function serializeServiceOrder<
  T extends {
    id: string;
    code: number;
    status: ServiceOrderStatus;
    customer?: {
      taxId?: string;
      crNumber?: string | null;
      [key: string]: unknown;
    };
    responsibleBlaster?: {
      taxId?: string;
      [key: string]: unknown;
    } | null;
    items: Array<{
      id: string;
      plannedQuantity: Prisma.Decimal;
      firedQuantity: Prisma.Decimal | null;
      product: {
        neqGrams: Prisma.Decimal;
        isPce: boolean;
        riskClass: string | null;
      };
    }>;
  },
>(order: T) {
  const { customer, responsibleBlaster, ...orderData } = order;
  const safeCustomer = customer
    ? (({ taxId: _taxId, crNumber: _crNumber, ...data }) => data)(customer)
    : undefined;
  const safeBlaster = responsibleBlaster
    ? (({ taxId: _taxId, ...data }) => data)(responsibleBlaster)
    : responsibleBlaster;
  const reservedNeqKg = order.items
    .reduce(
      (total, item) =>
        total.plus(item.plannedQuantity.mul(item.product.neqGrams).div(1000)),
      new Prisma.Decimal(0),
    )
    .toString();
  return {
    ...orderData,
    ...(safeCustomer ? { customer: safeCustomer } : {}),
    ...(safeBlaster ? { responsibleBlaster: safeBlaster } : {}),
    reservationActive: RESERVED_STATUSES.includes(order.status),
    reservedNeqKg,
    items: order.items.map((item) => ({
      ...item,
      neqKg: item.plannedQuantity
        .mul(item.product.neqGrams)
        .div(1000)
        .toString(),
    })),
  };
}
