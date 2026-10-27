import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { paginatedResult } from '../inventory.common.js';
import { CreateProductDto, ProductsQueryDto } from '../inventory.dto.js';
import { rethrowInventoryError } from '../inventory.errors.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(query: ProductsQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.isPce !== undefined ? { isPce: query.isPce === 'true' } : {}),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginatedResult(data, total, query);
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
    return product;
  }

  async createProduct(dto: CreateProductDto) {
    const neqGrams = new Prisma.Decimal(dto.neqGrams ?? 0);
    if (dto.isPce && dto.type === ProductType.SERVICO) {
      throw new BadRequestException(
        'Um serviço não pode ser cadastrado como produto PCE.',
      );
    }
    if (dto.isPce && (!dto.riskClass?.trim() || neqGrams.lte(0))) {
      throw new BadRequestException(
        'PCE exige classe de risco e massa NEQ unitária maior que zero.',
      );
    }
    if (!dto.isPce && neqGrams.gt(0)) {
      throw new BadRequestException(
        'Produto não PCE não pode declarar massa NEQ.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: dto.sku.trim(),
            name: dto.name.trim(),
            type: dto.type,
            isPce: dto.isPce,
            riskClass: dto.isPce ? dto.riskClass!.trim() : null,
            neqGrams,
            unit: dto.unit.trim(),
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'inventory.product.created',
            aggregateType: 'Product',
            aggregateId: product.id,
            after: {
              sku: product.sku,
              name: product.name,
              type: product.type,
              isPce: product.isPce,
              riskClass: product.riskClass,
              neqGrams: product.neqGrams.toString(),
            },
          },
        });
        return product;
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }
}
