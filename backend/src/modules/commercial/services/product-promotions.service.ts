import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PromotionDiscountType } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreateProductPromotionDto,
  ProductPromotionsQueryDto,
  UpdateProductPromotionDto,
} from '../commercial.dto.js';
import {
  ActivePromotionItem,
  dateOnly,
  lockProducts,
  paginated,
} from '../commercial.common.js';

@Injectable()
export class ProductPromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProductPromotions(query: ProductPromotionsQueryDto) {
    const where: Prisma.ProductPromotionWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.productId
        ? { items: { some: { productId: query.productId } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                items: {
                  some: {
                    product: {
                      name: { contains: query.search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.productPromotion.findMany({
        where,
        include: {
          items: {
            include: { product: true },
            orderBy: { product: { name: 'asc' } },
          },
        },
        orderBy: [{ effectiveFrom: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productPromotion.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async getProductPromotion(id: string) {
    const promotion = await this.prisma.productPromotion.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!promotion) {
      throw new NotFoundException('Promoção não encontrada.');
    }
    return promotion;
  }

  async createProductPromotion(dto: CreateProductPromotionDto) {
    if (dto.effectiveFrom > dto.effectiveUntil) {
      throw new BadRequestException(
        'O início da vigência não pode ser posterior ao término.',
      );
    }
    for (const item of dto.items) {
      const discountType =
        item.discountType ?? PromotionDiscountType.PRECO_FIXO;
      if (discountType === PromotionDiscountType.PRECO_FIXO) {
        if (item.promotionalPrice === undefined || item.promotionalPrice <= 0) {
          throw new BadRequestException(
            'Preço promocional deve ser maior que zero para tipo PRECO_FIXO.',
          );
        }
      } else if (discountType === PromotionDiscountType.PERCENTUAL) {
        if (
          item.discountPercent === undefined ||
          item.discountPercent <= 0 ||
          item.discountPercent > 100
        ) {
          throw new BadRequestException(
            'Percentual de desconto deve ser entre 0.01% e 100% para tipo PERCENTUAL.',
          );
        }
      }
    }
    const productIds = dto.items.map((item) => item.productId).sort();
    return this.prisma.$transaction(async (tx) => {
      await lockProducts(tx, productIds);
      const products = await tx.product.count({
        where: { id: { in: productIds } },
      });
      if (products !== productIds.length) {
        throw new NotFoundException(
          'Um ou mais produtos não foram encontrados.',
        );
      }
      const effectiveFrom = dateOnly(dto.effectiveFrom);
      const effectiveUntil = dateOnly(dto.effectiveUntil);
      if (dto.active) {
        await this.assertNoOverlappingProductPromotions(
          tx,
          productIds,
          effectiveFrom,
          effectiveUntil,
        );
      }
      const promotion = await tx.productPromotion.create({
        data: {
          name: dto.name.trim(),
          active: dto.active,
          effectiveFrom,
          effectiveUntil,
          items: {
            create: dto.items.map((item) => {
              const discountType =
                item.discountType ?? PromotionDiscountType.PRECO_FIXO;
              return {
                productId: item.productId,
                discountType,
                promotionalPrice:
                  item.promotionalPrice !== undefined
                    ? new Prisma.Decimal(item.promotionalPrice)
                    : null,
                discountPercent:
                  item.discountPercent !== undefined
                    ? new Prisma.Decimal(item.discountPercent)
                    : null,
              };
            }),
          },
        },
        include: { items: { include: { product: true } } },
      });
      await createAuditLog(tx, {
        data: {
          action: 'pricing-promotion.created',
          aggregateType: 'ProductPromotion',
          aggregateId: promotion.id,
          after: {
            name: promotion.name,
            active: promotion.active,
            effectiveFrom: dto.effectiveFrom,
            effectiveUntil: dto.effectiveUntil,
            products: promotion.items.map((item) => ({
              productId: item.productId,
              discountType: item.discountType,
              promotionalPrice: item.promotionalPrice?.toString() ?? null,
              discountPercent: item.discountPercent?.toString() ?? null,
            })),
          },
        },
      });
      return promotion;
    });
  }

  async updateProductPromotion(id: string, dto: UpdateProductPromotionDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "promocoes_produto"
        WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException('Promoção não encontrada.');
      }
      const promotion = await tx.productPromotion.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!promotion) {
        throw new NotFoundException('Promoção não encontrada.');
      }
      const productIds = promotion.items.map((item) => item.productId).sort();
      await lockProducts(tx, productIds);
      if (dto.active && !promotion.active) {
        await this.assertNoOverlappingProductPromotions(
          tx,
          productIds,
          promotion.effectiveFrom,
          promotion.effectiveUntil,
          promotion.id,
        );
      }
      const updated = await tx.productPromotion.update({
        where: { id },
        data: { active: dto.active },
        include: { items: { include: { product: true } } },
      });
      await createAuditLog(tx, {
        data: {
          action: 'pricing-promotion.updated',
          aggregateType: 'ProductPromotion',
          aggregateId: id,
          before: { active: promotion.active },
          after: { active: updated.active },
        },
      });
      return updated;
    });
  }

  async getActivePromotionalPrices(
    tx: Prisma.TransactionClient,
    productIds: string[],
    at = new Date(),
  ): Promise<Map<string, ActivePromotionItem>> {
    const ids = [...new Set(productIds)];
    if (!ids.length) {
      return new Map();
    }
    const day = dateOnly(at.toISOString().slice(0, 10));
    const items = await tx.productPromotionItem.findMany({
      where: {
        productId: { in: ids },
        promotion: {
          active: true,
          effectiveFrom: { lte: day },
          effectiveUntil: { gte: day },
        },
      },
      select: {
        productId: true,
        promotionalPrice: true,
        discountPercent: true,
        discountType: true,
        promotionId: true,
      },
    });
    const promotions = new Map<string, ActivePromotionItem>();
    for (const item of items) {
      if (promotions.has(item.productId)) {
        throw new ConflictException(
          'Mais de uma promoção vigente encontrada para o mesmo produto.',
        );
      }
      promotions.set(item.productId, item);
    }
    return promotions;
  }

  resolveUnitPrice(
    tablePrice: Prisma.Decimal | undefined,
    promotion: ActivePromotionItem | undefined,
  ): Prisma.Decimal | undefined {
    if (!tablePrice) {
      if (
        promotion &&
        promotion.discountType === PromotionDiscountType.PRECO_FIXO &&
        promotion.promotionalPrice
      ) {
        return promotion.promotionalPrice;
      }
      return undefined;
    }
    if (!promotion) {
      return tablePrice;
    }
    let promoPrice: Prisma.Decimal | undefined;
    if (
      promotion.discountType === PromotionDiscountType.PRECO_FIXO &&
      promotion.promotionalPrice
    ) {
      promoPrice = promotion.promotionalPrice;
    } else if (
      promotion.discountType === PromotionDiscountType.PERCENTUAL &&
      promotion.discountPercent
    ) {
      const discount = tablePrice
        .mul(promotion.discountPercent)
        .div(100)
        .toDecimalPlaces(2);
      promoPrice = tablePrice.minus(discount);
    }
    if (!promoPrice) {
      return tablePrice;
    }
    return promoPrice.lt(tablePrice) ? promoPrice : tablePrice;
  }

  async assertNoOverlappingProductPromotions(
    tx: Prisma.TransactionClient,
    productIds: string[],
    effectiveFrom: Date,
    effectiveUntil: Date,
    excludePromotionId?: string,
  ): Promise<void> {
    const overlapping = await tx.productPromotion.findFirst({
      where: {
        active: true,
        effectiveFrom: { lte: effectiveUntil },
        effectiveUntil: { gte: effectiveFrom },
        ...(excludePromotionId ? { id: { not: excludePromotionId } } : {}),
        items: { some: { productId: { in: productIds } } },
      },
      include: {
        items: {
          where: { productId: { in: productIds } },
          select: { productId: true },
        },
      },
    });
    if (overlapping) {
      throw new ConflictException({
        message:
          'Já existe promoção vigente ou futura sobreposta para produto.',
        promotionId: overlapping.id,
        promotionName: overlapping.name,
        productIds: overlapping.items.map((item) => item.productId),
      });
    }
  }
}
