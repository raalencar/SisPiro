import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { rethrowKnownPrismaError } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreatePriceListDto,
  PriceListsQueryDto,
} from '../commercial.dto.js';
import { dateOnly, paginated } from '../commercial.common.js';

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPriceLists(query: PriceListsQueryDto) {
    const where: Prisma.PriceListWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.priceList.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.priceList.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async getPriceList(id: string) {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!list) {
      throw new NotFoundException('Tabela de preço não encontrada.');
    }
    return list;
  }

  async createPriceList(dto: CreatePriceListDto) {
    if (
      dto.effectiveFrom &&
      dto.effectiveUntil &&
      dto.effectiveFrom > dto.effectiveUntil
    ) {
      throw new BadRequestException(
        'O início da vigência não pode ser posterior ao término.',
      );
    }
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('Um ou mais produtos não foram encontrados.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const list = await tx.priceList.create({
          data: {
            name: dto.name.trim(),
            active: dto.active,
            effectiveFrom: dto.effectiveFrom
              ? dateOnly(dto.effectiveFrom)
              : null,
            effectiveUntil: dto.effectiveUntil
              ? dateOnly(dto.effectiveUntil)
              : null,
            items: {
              create: dto.items.map((item) => ({
                productId: item.productId,
                unitPrice: new Prisma.Decimal(item.unitPrice),
              })),
            },
          },
          include: { items: { include: { product: true } } },
        });
        await createAuditLog(tx, {
          data: {
            action: 'pricing-list.created',
            aggregateType: 'PriceList',
            aggregateId: list.id,
            after: {
              name: list.name,
              active: list.active,
              itemCount: list.items.length,
            },
          },
        });
        return list;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }
}
