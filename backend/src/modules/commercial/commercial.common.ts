import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PromotionDiscountType,
  SalesQuoteStatus,
} from '@prisma/client';
import { CreateSaleDto, SaleSettlementCondition } from './commercial.dto.js';

export interface ActivePromotionItem {
  promotionId: string;
  productId: string;
  discountType: PromotionDiscountType;
  promotionalPrice: Prisma.Decimal | null;
  discountPercent: Prisma.Decimal | null;
}

export const SALES_QUOTE_VALIDITY_DAYS = 7;

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function paginated<T>(
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

export async function lockProducts(
  tx: Prisma.TransactionClient,
  productIds: string[],
): Promise<void> {
  const ids = [...new Set(productIds)].sort();
  if (!ids.length) {
    return;
  }
  const conditions = ids.map((id) => Prisma.sql`"id" = ${id}::uuid`);
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "produtos"
      WHERE ${Prisma.join(conditions, ' OR ')}
      ORDER BY "id"
      FOR UPDATE
    `,
  );
  if (rows.length !== ids.length) {
    throw new NotFoundException('Um ou mais produtos não foram encontrados.');
  }
}

export async function lockLots(
  tx: Prisma.TransactionClient,
  lotIds: string[],
): Promise<void> {
  const conditions = lotIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id" FROM "produto_lotes"
      WHERE ${Prisma.join(conditions, ' OR ')}
      ORDER BY "id"
      FOR UPDATE
    `,
  );
  if (rows.length !== lotIds.length) {
    throw new NotFoundException('Um ou mais lotes não foram encontrados.');
  }
}

export async function lockMagazine(
  tx: Prisma.TransactionClient,
  magazineId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "paioes" WHERE "id" = ${magazineId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new NotFoundException('Paiol do lote não encontrado.');
  }
}

export function assertPriceListActive(priceList: {
  active: boolean;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  if (
    !priceList.active ||
    (priceList.effectiveFrom &&
      priceList.effectiveFrom.toISOString().slice(0, 10) > today) ||
    (priceList.effectiveUntil &&
      priceList.effectiveUntil.toISOString().slice(0, 10) < today)
  ) {
    throw new ConflictException(
      'Tabela de preço inativa ou fora do período de vigência.',
    );
  }
}

export function assertCustomerActive(
  customer: { active: boolean } | null,
  customerId?: string,
) {
  if (customerId && !customer) {
    throw new NotFoundException('Cliente não encontrado.');
  }
  if (customer && !customer.active) {
    throw new ConflictException('Cliente inativo não pode realizar venda.');
  }
}

export function assertCustomerCanPurchasePce(
  customer: {
    hasCr: boolean;
    crExpiresAt: Date | null;
    authorizedPceClasses: string[];
  } | null,
  pceClasses: Set<string>,
) {
  if (pceClasses.size === 0) {
    return;
  }
  if (!customer) {
    throw new ConflictException(
      'Venda de PCE exige cliente identificado com CR válido e classes autorizadas.',
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const crExpires = customer.crExpiresAt?.toISOString().slice(0, 10);
  const unauthorized = [...pceClasses].filter(
    (riskClass) => !customer.authorizedPceClasses.includes(riskClass),
  );
  if (
    !customer.hasCr ||
    !crExpires ||
    crExpires < today ||
    unauthorized.length
  ) {
    throw new ConflictException({
      message: 'Cliente não está autorizado para os PCE desta venda.',
      reasons: [
        ...(!customer.hasCr
          ? ['Cliente sem Certificado de Registro informado.']
          : []),
        ...(customer.hasCr && (!crExpires || crExpires < today)
          ? ['Certificado de Registro vencido ou sem validade.']
          : []),
        ...(unauthorized.length
          ? [`Classes não autorizadas: ${unauthorized.join(', ')}.`]
          : []),
      ],
    });
  }
}

export function effectiveQuoteStatus(quote: {
  status: SalesQuoteStatus;
  expiresAt: Date;
}) {
  return quote.status === SalesQuoteStatus.EMITIDO &&
    quote.expiresAt <= new Date()
    ? SalesQuoteStatus.EXPIRADO
    : quote.status;
}

export function withEffectiveQuoteStatus<
  T extends {
    status: SalesQuoteStatus;
    expiresAt: Date;
  },
>(quote: T, now = new Date()) {
  return {
    ...quote,
    status:
      quote.status === SalesQuoteStatus.EMITIDO && quote.expiresAt <= now
        ? SalesQuoteStatus.EXPIRADO
        : quote.status,
  };
}

export function assertNotExpired(expiresAt: Date) {
  if (
    expiresAt.toISOString().slice(0, 10) <
    new Date().toISOString().slice(0, 10)
  ) {
    throw new ConflictException('Lote vencido não pode ser vendido.');
  }
}

export function assertSaleSettlement(
  dto: CreateSaleDto,
  customerId: string | null,
): void {
  if (
    dto.condition === SaleSettlementCondition.IMEDIATO &&
    (dto.dueDate !== undefined || dto.paymentMethod === undefined)
  ) {
    throw new BadRequestException(
      'Venda imediata exige método de pagamento e não aceita vencimento.',
    );
  }
  if (
    dto.condition === SaleSettlementCondition.PRAZO &&
    (dto.paymentMethod !== undefined ||
      dto.dueDate === undefined ||
      customerId === null)
  ) {
    throw new BadRequestException(
      'Venda a prazo exige cliente cadastrado e vencimento, e não aceita método de pagamento imediato.',
    );
  }
}

export function assertMagazineCanReceive(
  magazine: {
    active: boolean;
    fireLicenseExpiresAt: Date;
  } | null,
) {
  if (!magazine) {
    throw new NotFoundException('Paiol do lote não encontrado.');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (
    !magazine.active ||
    magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) < today
  ) {
    throw new ConflictException(
      'Paiol inativo ou com licença dos Bombeiros vencida não pode receber devolução.',
    );
  }
}

export async function assertMagazineCapacity(
  tx: Prisma.TransactionClient,
  magazineId: string,
  additionalNeqKg: Prisma.Decimal,
) {
  const magazine = await tx.magazine.findUnique({
    where: { id: magazineId },
  });
  if (!magazine) {
    throw new NotFoundException('Paiol do lote não encontrado.');
  }
  const [row] = await tx.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
    SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
    FROM "produto_lotes" l
    JOIN "produtos" p ON p."id" = l."produto_id"
    WHERE l."paiol_id" = ${magazineId}::uuid
  `;
  const projected = (row?.neqKg ?? new Prisma.Decimal(0)).plus(
    additionalNeqKg,
  );
  if (projected.gt(magazine.maxNeqCapacityKg)) {
    throw new ConflictException({
      message: 'Devolução bloqueada: capacidade NEQ do paiol excedida.',
      magazineId,
      capacityKg: magazine.maxNeqCapacityKg.toString(),
      projectedNeqKg: projected.toString(),
    });
  }
}
