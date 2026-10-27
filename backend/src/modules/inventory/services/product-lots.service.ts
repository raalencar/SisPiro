import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductLotStatus,
  ProductType,
  SalesQuoteStatus,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  assertCanReceive,
  assertCapacity,
  assertLotNotExpired,
  assertUnreservedQuantity,
  lockLot,
  lockMagazines,
  paginatedResult,
  parseDateOnly,
} from '../inventory.common.js';
import {
  CreateLotDto,
  LotsQueryDto,
  SplitLotDto,
  UpdateLotStatusDto,
} from '../inventory.dto.js';
import { rethrowInventoryError } from '../inventory.errors.js';

@Injectable()
export class ProductLotsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLots(query: LotsQueryDto) {
    const where: Prisma.ProductLotWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.magazineId ? { magazineId: query.magazineId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { lotNumber: { contains: query.search, mode: 'insensitive' } },
              {
                manufacturerOrImporter: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                product: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.productLot.findMany({
        where,
        include: {
          product: true,
          magazine: true,
        },
        orderBy: [{ expiresAt: 'asc' }, { lotNumber: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productLot.count({ where }),
    ]);

    return paginatedResult(
      data.map((lot) => ({
        ...lot,
        neqKg: lot.quantity.mul(lot.product.neqGrams).div(1000).toString(),
      })),
      total,
      query,
    );
  }

  async listOperationalLots(query: LotsQueryDto) {
    const where: Prisma.ProductLotWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.magazineId ? { magazineId: query.magazineId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { lotNumber: { contains: query.search, mode: 'insensitive' } },
              {
                product: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.productLot.findMany({
        where,
        select: {
          id: true,
          productId: true,
          magazineId: true,
          lotNumber: true,
          quantity: true,
          status: true,
          statusReason: true,
          expiresAt: true,
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              type: true,
              isPce: true,
              riskClass: true,
              neqGrams: true,
              unit: true,
            },
          },
          magazine: {
            select: {
              id: true,
              name: true,
              active: true,
              fireLicenseExpiresAt: true,
            },
          },
        },
        orderBy: [{ expiresAt: 'asc' }, { lotNumber: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.productLot.count({ where }),
    ]);
    return paginatedResult(
      data.map((lot) => ({
        ...lot,
        neqKg: lot.quantity.mul(lot.product.neqGrams).div(1000).toString(),
      })),
      total,
      query,
    );
  }

  async getLot(id: string) {
    const lot = await this.prisma.productLot.findUnique({
      where: { id },
      include: { product: true, magazine: true },
    });
    if (!lot) {
      throw new NotFoundException('Lote não encontrado.');
    }
    return {
      ...lot,
      neqKg: lot.quantity.mul(lot.product.neqGrams).div(1000).toString(),
    };
  }

  async createLot(dto: CreateLotDto) {
    if (dto.expiresAt < dto.manufacturedAt) {
      throw new BadRequestException(
        'A validade do lote não pode anteceder a fabricação.',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockMagazines(tx, [dto.magazineId]);
        const [product, magazine] = await Promise.all([
          tx.product.findUnique({ where: { id: dto.productId } }),
          tx.magazine.findUnique({ where: { id: dto.magazineId } }),
        ]);
        if (!product) {
          throw new NotFoundException('Produto não encontrado.');
        }
        if (product.type === ProductType.SERVICO) {
          throw new BadRequestException(
            'Produtos do tipo serviço não podem ter lote em estoque.',
          );
        }
        assertCanReceive(magazine);

        const quantity = new Prisma.Decimal(dto.quantity);
        const neqKg = quantity.mul(product.neqGrams).div(1000);
        await assertCapacity(tx, dto.magazineId, neqKg);

        const lot = await tx.productLot.create({
          data: {
            productId: dto.productId,
            magazineId: dto.magazineId,
            lotNumber: dto.lotNumber.trim(),
            quantity,
            manufacturedAt: parseDateOnly(dto.manufacturedAt),
            expiresAt: parseDateOnly(dto.expiresAt),
            manufacturerOrImporter: dto.manufacturerOrImporter.trim(),
          },
          include: { product: true, magazine: true },
        });
        const movement = await tx.stockMovement.create({
          data: {
            type: StockMovementType.ENTRADA,
            productLotId: lot.id,
            quantity,
            destinationMagazineId: lot.magazineId,
            reference: 'RECEBIMENTO_INICIAL',
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'inventory.lot.received',
            aggregateType: 'ProductLot',
            aggregateId: lot.id,
            after: {
              lotNumber: lot.lotNumber,
              productId: lot.productId,
              magazineId: lot.magazineId,
              quantity: lot.quantity.toString(),
              neqKg: neqKg.toString(),
              movementId: movement.id,
            },
          },
        });
        return {
          ...lot,
          neqKg: neqKg.toString(),
          initialMovement: movement,
        };
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }

  async splitLot(parentLotId: string, dto: SplitLotDto) {
    if (dto.quantity <= 0) {
      throw new BadRequestException(
        'A quantidade a desmembrar deve ser positiva.',
      );
    }
    const splitQuantity = new Prisma.Decimal(dto.quantity);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockLot(tx, parentLotId);
        const parentLot = await tx.productLot.findUnique({
          where: { id: parentLotId },
          include: { product: true },
        });
        if (!parentLot) {
          throw new NotFoundException('Lote de origem não encontrado.');
        }

        assertLotNotExpired(parentLot.expiresAt);

        if (parentLot.status !== ProductLotStatus.DISPONIVEL) {
          throw new ConflictException(
            `Lotes com status ${parentLot.status} não podem ser desmembrados. Apenas lotes disponíveis podem ser divididos.`,
          );
        }

        if (splitQuantity.gte(parentLot.quantity)) {
          throw new ConflictException(
            'A quantidade a desmembrar deve ser estritamente menor que o saldo total do lote. Para transferir todo o saldo, use a transferência regular.',
          );
        }

        await assertUnreservedQuantity(tx, parentLot.id, splitQuantity);

        const existingChildLot = await tx.productLot.findUnique({
          where: {
            productId_lotNumber: {
              productId: parentLot.productId,
              lotNumber: dto.newLotNumber.trim(),
            },
          },
        });
        if (existingChildLot) {
          throw new ConflictException(
            'Já existe um lote com este número para o produto informado.',
          );
        }

        await lockMagazines(tx, [
          parentLot.magazineId,
          dto.destinationMagazineId,
        ]);
        const destinationMagazine = await tx.magazine.findUnique({
          where: { id: dto.destinationMagazineId },
        });
        assertCanReceive(destinationMagazine);

        const additionalNeqKg = splitQuantity
          .mul(parentLot.product.neqGrams)
          .div(1000);
        await assertCapacity(
          tx,
          dto.destinationMagazineId,
          additionalNeqKg,
        );

        const remainingParentQuantity = parentLot.quantity.minus(splitQuantity);

        await tx.productLot.update({
          where: { id: parentLot.id },
          data: { quantity: remainingParentQuantity },
        });

        const originMovement = await tx.stockMovement.create({
          data: {
            type: StockMovementType.TRANSFERENCIA,
            productLotId: parentLot.id,
            quantity: splitQuantity,
            sourceMagazineId: parentLot.magazineId,
            destinationMagazineId: dto.destinationMagazineId,
            reference: `DESMEMBRAMENTO_PARA_${dto.newLotNumber.trim()}`,
          },
        });

        const childLot = await tx.productLot.create({
          data: {
            productId: parentLot.productId,
            magazineId: dto.destinationMagazineId,
            lotNumber: dto.newLotNumber.trim(),
            quantity: splitQuantity,
            manufacturedAt: parentLot.manufacturedAt,
            expiresAt: parentLot.expiresAt,
            manufacturerOrImporter: parentLot.manufacturerOrImporter,
          },
          include: { product: true, magazine: true },
        });

        const childMovement = await tx.stockMovement.create({
          data: {
            type: StockMovementType.ENTRADA,
            productLotId: childLot.id,
            quantity: splitQuantity,
            destinationMagazineId: dto.destinationMagazineId,
            reference: `DESMEMBRADO_DE_${parentLot.lotNumber}`,
          },
        });

        await createAuditLog(tx, {
          data: {
            action: 'inventory.lot.split',
            aggregateType: 'ProductLot',
            aggregateId: parentLot.id,
            before: {
              quantity: parentLot.quantity.toString(),
              magazineId: parentLot.magazineId,
            },
            after: {
              remainingQuantity: remainingParentQuantity.toString(),
              childLotId: childLot.id,
              childLotNumber: childLot.lotNumber,
              splitQuantity: splitQuantity.toString(),
              originMovementId: originMovement.id,
              childMovementId: childMovement.id,
              destinationMagazineId: dto.destinationMagazineId,
              neqKg: additionalNeqKg.toString(),
            },
          },
        });

        return {
          parentLot: {
            ...parentLot,
            quantity: remainingParentQuantity,
            neqKg: remainingParentQuantity
              .mul(parentLot.product.neqGrams)
              .div(1000)
              .toString(),
          },
          childLot: {
            ...childLot,
            neqKg: additionalNeqKg.toString(),
          },
          originMovement,
          childMovement,
        };
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }

  async updateLotStatus(id: string, dto: UpdateLotStatusDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockLot(tx, id);
        const lot = await tx.productLot.findUnique({
          where: { id },
          include: { product: true, magazine: true },
        });
        if (!lot) {
          throw new NotFoundException('Lote não encontrado.');
        }

        if (
          dto.status !== ProductLotStatus.DISPONIVEL &&
          lot.status === ProductLotStatus.DISPONIVEL
        ) {
          const activeReservations = await tx.serviceOrderItem.aggregate({
            where: {
              productLotId: lot.id,
              serviceOrder: {
                status: {
                  in: [
                    ServiceOrderStatus.APROVADO,
                    ServiceOrderStatus.EM_MONTAGEM,
                  ],
                },
              },
            },
            _sum: { plannedQuantity: true },
          });
          const reservedQty =
            activeReservations._sum.plannedQuantity ?? new Prisma.Decimal(0);

          const activeQuotes = await tx.salesQuoteItem.aggregate({
            where: {
              productLotId: lot.id,
              quote: {
                status: SalesQuoteStatus.EMITIDO,
                expiresAt: { gt: new Date() },
              },
            },
            _sum: { quantity: true },
          });
          const quoteQty = activeQuotes._sum.quantity ?? new Prisma.Decimal(0);

          const totalReserved = reservedQty.plus(quoteQty);
          if (totalReserved.gt(0)) {
            throw new ConflictException({
              message:
                'O lote possui reservas ativas vinculadas a Ordens de Serviço ou Orçamentos Comerciais. Cancele ou reatribua as reservas antes de colocar o lote em quarentena ou bloqueio.',
              lotId: lot.id,
              lotNumber: lot.lotNumber,
              reservedQuantity: totalReserved.toString(),
            });
          }
        }

        const updated = await tx.productLot.update({
          where: { id },
          data: {
            status: dto.status,
            statusReason: dto.reason?.trim() ?? null,
          },
          include: { product: true, magazine: true },
        });

        await createAuditLog(tx, {
          data: {
            action: 'inventory.lot.status-updated',
            aggregateType: 'ProductLot',
            aggregateId: lot.id,
            before: {
              status: lot.status,
              statusReason: lot.statusReason,
            },
            after: {
              status: updated.status,
              statusReason: updated.statusReason,
              lotNumber: updated.lotNumber,
            },
          },
        });

        return {
          ...updated,
          neqKg: updated.quantity
            .mul(updated.product.neqGrams)
            .div(1000)
            .toString(),
        };
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }
}
