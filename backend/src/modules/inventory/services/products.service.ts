import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductType } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { supplierCatalogImageUrl } from '../../../common/supplier-catalog.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { paginatedResult } from '../inventory.common.js';
import { CreateProductDto, ProductsQueryDto } from '../inventory.dto.js';
import { rethrowInventoryError } from '../inventory.errors.js';

const catalogImageInclude = {
  catalogItems: {
    where: { imagePaths: { isEmpty: false } },
    select: { id: true },
    orderBy: [{ importedAt: 'asc' }, { id: 'asc' }],
    take: 1,
  },
} satisfies Prisma.ProductInclude;

type ProductWithCatalogImage = Prisma.ProductGetPayload<{
  include: typeof catalogImageInclude;
}>;

function withImageUrl({ catalogItems, ...product }: ProductWithCatalogImage) {
  const [item] = catalogItems;
  return {
    ...product,
    imageUrl: item ? supplierCatalogImageUrl(item.id, 0) : null,
  };
}

async function lockCatalogItemForLink(
  tx: Prisma.TransactionClient,
  catalogItemId: string,
) {
  // Lock de linha: dois cadastros simultâneos do mesmo item não podem gerar dois produtos.
  const [item] = await tx.$queryRaw<
    Array<{ id: string; productId: string | null; supplierId: string }>
  >`
    SELECT "id", "produto_id" AS "productId", "fornecedor_id" AS "supplierId"
    FROM "fornecedor_catalogo_itens"
    WHERE "id" = ${catalogItemId}::uuid
    FOR UPDATE
  `;
  if (!item) {
    throw new NotFoundException(
      'Item do catálogo de fornecedor não encontrado.',
    );
  }
  if (item.productId) {
    throw new ConflictException({
      message: 'Item do catálogo de fornecedor já está vinculado a um produto.',
      productId: item.productId,
    });
  }
  return item;
}

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
        include: catalogImageInclude,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginatedResult(data.map(withImageUrl), total, query);
  }

  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: catalogImageInclude,
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
    return withImageUrl(product);
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
        const catalogItem = dto.supplierCatalogItemId
          ? await lockCatalogItemForLink(tx, dto.supplierCatalogItemId)
          : null;
        const product = await tx.product.create({
          data: {
            sku: dto.sku.trim(),
            name: dto.name.trim(),
            type: dto.type,
            isPce: dto.isPce,
            riskClass: dto.isPce ? dto.riskClass!.trim() : null,
            neqGrams,
            unit: dto.unit.trim(),
            description: dto.description?.trim() || null,
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
              description: product.description,
              supplierCatalogItemId: catalogItem?.id ?? null,
            },
          },
        });
        if (!catalogItem) {
          return { ...product, imageUrl: null };
        }

        const linked = await tx.supplierCatalogItem.update({
          where: { id: catalogItem.id },
          data: { productId: product.id },
          select: { id: true, imagePaths: true },
        });
        await createAuditLog(tx, {
          data: {
            action: 'procurement.supplier_catalog_item.linked',
            aggregateType: 'SupplierCatalogItem',
            aggregateId: catalogItem.id,
            before: { productId: null },
            after: {
              productId: product.id,
              productSku: product.sku,
              supplierId: catalogItem.supplierId,
            },
          },
        });
        return {
          ...product,
          imageUrl: linked.imagePaths.length
            ? supplierCatalogImageUrl(linked.id, 0)
            : null,
        };
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }
}
