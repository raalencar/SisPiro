import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  query: { page: number; limit: number },
) {
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

export function assertCrData(
  hasCr: boolean,
  crNumber: string | undefined,
  crExpiresAt: string | undefined,
  classes: string[],
) {
  if (hasCr && (!crNumber?.trim() || !crExpiresAt)) {
    throw new BadRequestException(
      'CR informado exige número e data de validade.',
    );
  }
  if (!hasCr && (crNumber || crExpiresAt || classes.length > 0)) {
    throw new BadRequestException(
      'Número, validade e classes PCE só podem ser informados para fornecedor com CR.',
    );
  }
  if (classes.some((item) => item.length === 0)) {
    throw new BadRequestException(
      'As classes PCE autorizadas não podem estar vazias.',
    );
  }
}

export function assertSupplierPceEligible(
  supplier: {
    legalName: string;
    active: boolean;
    hasCr: boolean;
    crExpiresAt: Date | null;
    authorizedPceClasses: string[];
  },
  riskClass: string | null,
) {
  const today = new Date().toISOString().slice(0, 10);
  const expiry = supplier.crExpiresAt?.toISOString().slice(0, 10);
  if (
    !supplier.active ||
    !supplier.hasCr ||
    !expiry ||
    expiry < today ||
    !riskClass ||
    !supplier.authorizedPceClasses.includes(riskClass)
  ) {
    throw new ConflictException({
      message: `Fornecedor não está habilitado para fornecer o PCE ${riskClass ?? '(sem classe)'}.`,
      supplier: supplier.legalName,
    });
  }
}

export async function lockMagazine(
  tx: Prisma.TransactionClient,
  magazineId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "paioes" WHERE "id" = ${magazineId}::uuid FOR UPDATE
  `;
  if (!rows.length) {
    throw new NotFoundException('Paiol não encontrado.');
  }
}

export function assertMagazineCanReceive(
  magazine: { active: boolean; fireLicenseExpiresAt: Date } | undefined,
) {
  if (!magazine) {
    throw new NotFoundException('Paiol não encontrado.');
  }
  if (!magazine.active) {
    throw new ConflictException('Paiol inativo não pode receber estoque.');
  }
  if (
    magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  ) {
    throw new ConflictException(
      'Paiol com licença dos Bombeiros vencida não pode receber estoque.',
    );
  }
}

export async function assertMagazineCapacity(
  tx: Prisma.TransactionClient,
  magazineId: string,
  increase: Prisma.Decimal,
) {
  const magazine = await tx.magazine.findUnique({
    where: { id: magazineId },
  });
  if (!magazine) {
    throw new NotFoundException('Paiol não encontrado.');
  }
  const [row] = await tx.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
    SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
    FROM "produto_lotes" l
    JOIN "produtos" p ON p."id" = l."produto_id"
    WHERE l."paiol_id" = ${magazineId}::uuid
  `;
  const projected = (row?.neqKg ?? new Prisma.Decimal(0)).plus(increase);
  if (projected.gt(magazine.maxNeqCapacityKg)) {
    throw new ConflictException({
      message: 'Recebimento bloqueado: capacidade NEQ do paiol excedida.',
      magazineId,
      capacityKg: magazine.maxNeqCapacityKg.toString(),
      currentNeqKg: (row?.neqKg ?? new Prisma.Decimal(0)).toString(),
      projectedNeqKg: projected.toString(),
    });
  }
}
