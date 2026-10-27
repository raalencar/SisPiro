import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseStatus,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { rethrowKnownPrismaError } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreatePurchaseDto,
  PurchasesQueryDto,
  ReceivePurchaseDto,
} from '../procurement.dto.js';
import { paginatedResult } from './procurement.common.js';
import { receivePurchaseInTransaction } from './purchases-receipt.helper.js';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPurchases(query: PurchasesQueryDto) {
    const where: Prisma.PurchaseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              {
                supplier: {
                  legalName: { contains: query.search, mode: 'insensitive' },
                },
              },
              ...(Number.isSafeInteger(Number(query.search))
                ? [{ code: Number(query.search) }]
                : []),
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          items: { include: { product: true, receipts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return paginatedResult(data, total, query);
  }

  async getPurchase(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            receipts: { include: { productLot: true, magazine: true } },
          },
        },
      },
    });
    if (!purchase) {
      throw new NotFoundException('Compra não encontrada.');
    }
    return purchase;
  }

  async createPurchase(dto: CreatePurchaseDto) {
    const productIds = dto.items.map((item) => item.productId);
    const [supplier, products] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
      }),
    ]);
    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }
    if (!supplier.active) {
      throw new ConflictException(
        'Fornecedor inativo não pode receber novas compras.',
      );
    }
    if (products.length !== productIds.length) {
      throw new NotFoundException('Um ou mais produtos não foram encontrados.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            supplierId: dto.supplierId,
            reference: dto.reference?.trim() || null,
            items: {
              create: dto.items.map((item) => ({
                productId: item.productId,
                orderedQuantity: new Prisma.Decimal(item.orderedQuantity),
                unitCost: new Prisma.Decimal(item.unitCost),
              })),
            },
          },
          include: {
            supplier: true,
            items: { include: { product: true } },
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'procurement.purchase.created',
            aggregateType: 'Purchase',
            aggregateId: purchase.id,
            after: {
              code: purchase.code,
              supplierId: purchase.supplierId,
              reference: purchase.reference,
              itemCount: purchase.items.length,
              status: purchase.status,
            },
          },
        });
        return purchase;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async receivePurchase(id: string, dto: ReceivePurchaseDto) {
    try {
      return await this.prisma.$transaction((tx) =>
        receivePurchaseInTransaction(tx, id, dto),
      );
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async cancelPurchase(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "compras" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException('Compra não encontrada.');
      }
      const purchase = await tx.purchase.findUnique({ where: { id } });
      if (!purchase) {
        throw new NotFoundException('Compra não encontrada.');
      }
      if (purchase.status !== PurchaseStatus.PENDENTE) {
        throw new ConflictException(
          'Somente compras pendentes podem ser canceladas.',
        );
      }
      const cancelled = await tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELADO },
      });
      await createAuditLog(tx, {
        data: {
          action: 'procurement.purchase.cancelled',
          aggregateType: 'Purchase',
          aggregateId: id,
          before: { status: purchase.status },
          after: { status: cancelled.status },
        },
      });
      return cancelled;
    });
  }
}
