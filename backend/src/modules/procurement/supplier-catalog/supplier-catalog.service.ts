import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { supplierCatalogImageUrl } from '../../../common/supplier-catalog.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { paginatedResult } from '../services/procurement.common.js';
import {
  SupplierCatalogCategoriesQueryDto,
  SupplierCatalogQueryDto,
} from './supplier-catalog.dto.js';

const relations = {
  supplier: { select: { legalName: true } },
  product: { select: { sku: true } },
} satisfies Prisma.SupplierCatalogItemInclude;

type CatalogItemWithRelations = Prisma.SupplierCatalogItemGetPayload<{
  include: typeof relations;
}>;

function summary(item: CatalogItemWithRelations) {
  return {
    id: item.id,
    supplierId: item.supplierId,
    supplierName: item.supplier.legalName,
    externalId: item.externalId,
    supplierCode: item.supplierCode,
    name: item.name,
    effect: item.effect,
    unitPackaging: item.unitPackaging,
    masterPackaging: item.masterPackaging,
    approxDuration: item.approxDuration,
    categories: item.categories,
    thumbnailUrl: item.imagePaths.length
      ? supplierCatalogImageUrl(item.id, 0)
      : null,
    productId: item.productId,
    productSku: item.product?.sku ?? null,
  };
}

@Injectable()
export class SupplierCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: SupplierCatalogQueryDto) {
    const search = query.q || query.search?.trim();
    const where: Prisma.SupplierCatalogItemWhereInput = {
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.category ? { categories: { has: query.category } } : {}),
      ...(query.linked === 'true' ? { productId: { not: null } } : {}),
      ...(query.linked === 'false' ? { productId: null } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { supplierCode: { contains: search, mode: 'insensitive' } },
              { effect: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.supplierCatalogItem.findMany({
        where,
        include: relations,
        orderBy: [
          { supplierCode: { sort: 'asc', nulls: 'last' } },
          { name: 'asc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supplierCatalogItem.count({ where }),
    ]);
    return paginatedResult(items.map(summary), total, query);
  }

  async listCategories(query: SupplierCatalogCategoriesQueryDto) {
    const supplierFilter = query.supplierId
      ? Prisma.sql`WHERE "fornecedor_id" = ${query.supplierId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<Array<{ category: string }>>`
      SELECT DISTINCT unnest("categorias") AS "category"
      FROM "fornecedor_catalogo_itens"
      ${supplierFilter}
      ORDER BY 1
    `;
    return { data: rows.map((row) => row.category) };
  }

  async get(id: string) {
    const item = await this.prisma.supplierCatalogItem.findUnique({
      where: { id },
      include: relations,
    });
    if (!item) {
      throw new NotFoundException('Item do catálogo de fornecedor não encontrado.');
    }
    return {
      ...summary(item),
      description: item.description,
      notes: item.notes,
      extraAttributes: item.extraAttributes,
      sourceUrl: item.sourceUrl,
      importedAt: item.importedAt,
      updatedAt: item.updatedAt,
      images: item.imagePaths.map((_, index) => ({
        index,
        url: supplierCatalogImageUrl(item.id, index),
      })),
    };
  }
}
