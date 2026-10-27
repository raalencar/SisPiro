import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductLotStatus,
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
} from '../inventory.common.js';
import { CreateMovementDto, MovementsQueryDto } from '../inventory.dto.js';
import { rethrowInventoryError } from '../inventory.errors.js';

@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMovements(query: MovementsQueryDto) {
    const where: Prisma.StockMovementWhereInput = {
      ...(query.productLotId ? { productLotId: query.productLotId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? {
            OR: [
              { reference: { contains: query.search, mode: 'insensitive' } },
              {
                productLot: {
                  lotNumber: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          productLot: {
            include: { product: true },
          },
          sourceMagazine: true,
          destinationMagazine: true,
        },
        orderBy: { occurredAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginatedResult(data, total, query);
  }

  async createMovement(dto: CreateMovementDto) {
    if (
      dto.type === StockMovementType.TRANSFERENCIA &&
      !dto.destinationMagazineId
    ) {
      throw new BadRequestException(
        'Paiol de destino é obrigatório para transferência.',
      );
    }
    if (
      dto.type !== StockMovementType.TRANSFERENCIA &&
      dto.destinationMagazineId
    ) {
      throw new BadRequestException(
        'Paiol de destino só pode ser informado em uma transferência.',
      );
    }
    if (dto.type !== StockMovementType.AJUSTE && dto.quantity <= 0) {
      throw new BadRequestException(
        'A quantidade de entrada, saída ou transferência deve ser positiva.',
      );
    }
    if (dto.type === StockMovementType.AJUSTE && dto.quantity === 0) {
      throw new BadRequestException('O ajuste deve ser diferente de zero.');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockLot(tx, dto.productLotId);
        const lot = await tx.productLot.findUnique({
          where: { id: dto.productLotId },
          include: { product: true },
        });
        if (!lot) {
          throw new NotFoundException('Lote não encontrado.');
        }

        const destinationId =
          dto.type === StockMovementType.TRANSFERENCIA
            ? dto.destinationMagazineId!
            : lot.magazineId;
        if (
          dto.type === StockMovementType.TRANSFERENCIA &&
          destinationId === lot.magazineId
        ) {
          throw new BadRequestException(
            'O paiol de destino deve ser diferente do paiol atual.',
          );
        }
        await lockMagazines(
          tx,
          dto.type === StockMovementType.TRANSFERENCIA
            ? [lot.magazineId, destinationId]
            : [lot.magazineId],
        );

        const quantity = new Prisma.Decimal(dto.quantity);
        const currentQuantity = lot.quantity;
        const quantityToRemove =
          dto.type === StockMovementType.SAIDA ||
          dto.type === StockMovementType.TRANSFERENCIA
            ? quantity
            : dto.type === StockMovementType.AJUSTE && quantity.isNegative()
              ? quantity.abs()
              : new Prisma.Decimal(0);
        if (quantityToRemove.gt(0)) {
          await assertUnreservedQuantity(tx, lot.id, quantityToRemove);
        }
        let nextQuantity = currentQuantity;
        let sourceMagazineId: string | null = null;
        let targetMagazineId: string | null = null;
        let capacityIncrease = new Prisma.Decimal(0);

        switch (dto.type) {
          case StockMovementType.ENTRADA:
            if (lot.status !== ProductLotStatus.DISPONIVEL) {
              throw new ConflictException(
                `Lote com status ${lot.status} não pode receber novas entradas de estoque. Libere o lote antes de prosseguir.`,
              );
            }
            targetMagazineId = lot.magazineId;
            capacityIncrease = quantity.mul(lot.product.neqGrams).div(1000);
            nextQuantity = currentQuantity.plus(quantity);
            break;
          case StockMovementType.SAIDA:
            if (lot.status !== ProductLotStatus.DISPONIVEL) {
              throw new ConflictException(
                `Lote com status ${lot.status} não pode ser movimentado para saída. Libere o lote antes de prosseguir.`,
              );
            }
            assertLotNotExpired(lot.expiresAt);
            sourceMagazineId = lot.magazineId;
            nextQuantity = currentQuantity.minus(quantity);
            break;
          case StockMovementType.TRANSFERENCIA: {
            if (lot.status !== ProductLotStatus.DISPONIVEL) {
              throw new ConflictException(
                `Lote com status ${lot.status} não pode ser transferido. Libere o lote antes de prosseguir.`,
              );
            }
            if (!quantity.eq(currentQuantity)) {
              throw new BadRequestException(
                'A transferência deve mover o saldo total do lote. Para dividir o lote, é necessário cadastrar lotes separados.',
              );
            }
            assertLotNotExpired(lot.expiresAt);
            const destination = await tx.magazine.findUnique({
              where: { id: destinationId },
            });
            assertCanReceive(destination);
            sourceMagazineId = lot.magazineId;
            targetMagazineId = destinationId;
            capacityIncrease = quantity.mul(lot.product.neqGrams).div(1000);
            break;
          }
          case StockMovementType.AJUSTE:
            if (lot.status !== ProductLotStatus.DISPONIVEL) {
              throw new ConflictException(
                `Lote com status ${lot.status} não pode receber ajuste de estoque. Libere o lote antes de prosseguir.`,
              );
            }
            if (quantity.isNegative()) {
              sourceMagazineId = lot.magazineId;
              nextQuantity = currentQuantity.plus(quantity);
            } else {
              targetMagazineId = lot.magazineId;
              capacityIncrease = quantity.mul(lot.product.neqGrams).div(1000);
              nextQuantity = currentQuantity.plus(quantity);
            }
            break;
        }

        if (
          dto.type === StockMovementType.ENTRADA ||
          (dto.type === StockMovementType.AJUSTE && quantity.isPositive())
        ) {
          const magazine = await tx.magazine.findUnique({
            where: { id: lot.magazineId },
          });
          assertCanReceive(magazine);
        }
        if (nextQuantity.isNegative()) {
          throw new ConflictException(
            'Saldo insuficiente no lote para realizar esta movimentação.',
          );
        }
        if (capacityIncrease.gt(0)) {
          await assertCapacity(tx, targetMagazineId!, capacityIncrease);
        }

        const [movement] = await Promise.all([
          tx.stockMovement.create({
            data: {
              type: dto.type,
              productLotId: lot.id,
              quantity,
              sourceMagazineId,
              destinationMagazineId: targetMagazineId,
              reference: dto.reference?.trim(),
            },
            include: {
              productLot: {
                include: { product: true },
              },
              sourceMagazine: true,
              destinationMagazine: true,
            },
          }),
          tx.productLot.update({
            where: { id: lot.id },
            data: {
              quantity: nextQuantity,
              ...(dto.type === StockMovementType.TRANSFERENCIA
                ? { magazineId: destinationId }
                : {}),
            },
          }),
        ]);
        await createAuditLog(tx, {
          data: {
            action: `inventory.movement.${dto.type.toLowerCase()}`,
            aggregateType: 'ProductLot',
            aggregateId: lot.id,
            before: {
              quantity: currentQuantity.toString(),
              magazineId: lot.magazineId,
            },
            after: {
              quantity: nextQuantity.toString(),
              magazineId:
                dto.type === StockMovementType.TRANSFERENCIA
                  ? destinationId
                  : lot.magazineId,
              movementId: movement.id,
              type: dto.type,
              neqKg: quantity.mul(lot.product.neqGrams).div(1000).toString(),
            },
          },
        });
        return movement;
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }
}
