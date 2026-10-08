import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductType,
  SalesQuoteStatus,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreateLotDto,
  CreateMagazineDto,
  CreateMovementDto,
  CreateProductDto,
  LotsQueryDto,
  MovementsQueryDto,
  ProductsQueryDto,
} from './inventory.dto.js';
import { rethrowInventoryError } from './inventory.errors.js';

type Pagination = { page: number; limit: number };

@Injectable()
export class InventoryService {
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

    return this.paginated(data, total, query);
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
        await tx.auditLog.create({
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

  async listMagazines(query: Pagination) {
    const [magazines, total, neqRows] = await Promise.all([
      this.prisma.magazine.findMany({
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.magazine.count(),
      this.prisma.$queryRaw<Array<{ magazineId: string; neqKg: unknown }>>`
        SELECT l."paiol_id" AS "magazineId",
               COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
        FROM "produto_lotes" l
        JOIN "produtos" p ON p."id" = l."produto_id"
        GROUP BY l."paiol_id"
      `,
    ]);
    const neqByMagazine = new Map(
      neqRows.map((row) => [
        row.magazineId,
        new Prisma.Decimal(String(row.neqKg)),
      ]),
    );
    const data = magazines.map((magazine) => {
      const currentNeqKg =
        neqByMagazine.get(magazine.id) ?? new Prisma.Decimal(0);
      return {
        ...magazine,
        currentNeqKg: currentNeqKg.toString(),
        remainingNeqKg: magazine.maxNeqCapacityKg
          .minus(currentNeqKg)
          .toString(),
      };
    });

    return this.paginated(data, total, query);
  }

  async getMagazine(id: string) {
    const magazine = await this.prisma.magazine.findUnique({ where: { id } });
    if (!magazine) {
      throw new NotFoundException('Paiol não encontrado.');
    }
    const currentNeqKg = await this.currentNeqKg(this.prisma, id);
    return {
      ...magazine,
      currentNeqKg: currentNeqKg.toString(),
      remainingNeqKg: magazine.maxNeqCapacityKg.minus(currentNeqKg).toString(),
    };
  }

  async createMagazine(dto: CreateMagazineDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const magazine = await tx.magazine.create({
          data: {
            name: dto.name.trim(),
            maxNeqCapacityKg: new Prisma.Decimal(dto.maxNeqCapacityKg),
            fireLicenseExpiresAt: this.dateOnly(dto.fireLicenseExpiresAt),
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'inventory.magazine.created',
            aggregateType: 'Magazine',
            aggregateId: magazine.id,
            after: {
              name: magazine.name,
              maxNeqCapacityKg: magazine.maxNeqCapacityKg.toString(),
              fireLicenseExpiresAt: dto.fireLicenseExpiresAt,
            },
          },
        });
        return {
          ...magazine,
          currentNeqKg: '0',
          remainingNeqKg: magazine.maxNeqCapacityKg.toString(),
        };
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }

  async listLots(query: LotsQueryDto) {
    const where: Prisma.ProductLotWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.magazineId ? { magazineId: query.magazineId } : {}),
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

    return this.paginated(
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
        await this.lockMagazines(tx, [dto.magazineId]);
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
        this.assertCanReceive(magazine);

        const quantity = new Prisma.Decimal(dto.quantity);
        const neqKg = quantity.mul(product.neqGrams).div(1000);
        await this.assertCapacity(tx, dto.magazineId, neqKg);

        const lot = await tx.productLot.create({
          data: {
            productId: dto.productId,
            magazineId: dto.magazineId,
            lotNumber: dto.lotNumber.trim(),
            quantity,
            manufacturedAt: this.dateOnly(dto.manufacturedAt),
            expiresAt: this.dateOnly(dto.expiresAt),
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
        await tx.auditLog.create({
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
    return this.paginated(data, total, query);
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
        await this.lockLot(tx, dto.productLotId);
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
        await this.lockMagazines(
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
          await this.assertUnreservedQuantity(tx, lot.id, quantityToRemove);
        }
        let nextQuantity = currentQuantity;
        let sourceMagazineId: string | null = null;
        let targetMagazineId: string | null = null;
        let capacityIncrease = new Prisma.Decimal(0);

        switch (dto.type) {
          case StockMovementType.ENTRADA:
            targetMagazineId = lot.magazineId;
            capacityIncrease = quantity.mul(lot.product.neqGrams).div(1000);
            nextQuantity = currentQuantity.plus(quantity);
            break;
          case StockMovementType.SAIDA:
            this.assertLotNotExpired(lot.expiresAt);
            sourceMagazineId = lot.magazineId;
            nextQuantity = currentQuantity.minus(quantity);
            break;
          case StockMovementType.TRANSFERENCIA: {
            if (!quantity.eq(currentQuantity)) {
              throw new BadRequestException(
                'A transferência deve mover o saldo total do lote. Para dividir o lote, é necessário cadastrar lotes separados.',
              );
            }
            this.assertLotNotExpired(lot.expiresAt);
            const destination = await tx.magazine.findUnique({
              where: { id: destinationId },
            });
            this.assertCanReceive(destination);
            sourceMagazineId = lot.magazineId;
            targetMagazineId = destinationId;
            capacityIncrease = quantity.mul(lot.product.neqGrams).div(1000);
            break;
          }
          case StockMovementType.AJUSTE:
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
          this.assertCanReceive(magazine);
        }
        if (nextQuantity.isNegative()) {
          throw new ConflictException(
            'Saldo insuficiente no lote para realizar esta movimentação.',
          );
        }
        if (capacityIncrease.gt(0)) {
          await this.assertCapacity(tx, targetMagazineId!, capacityIncrease);
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
        await tx.auditLog.create({
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

  private paginated<T>(data: T[], total: number, query: Pagination) {
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

  private dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async lockLot(
    tx: Prisma.TransactionClient,
    lotId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "produto_lotes" WHERE "id" = ${lotId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException('Lote não encontrado.');
    }
  }

  private async lockMagazines(
    tx: Prisma.TransactionClient,
    magazineIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(magazineIds)].sort();
    if (uniqueIds.length === 0) {
      return;
    }
    const conditions = uniqueIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id" FROM "paioes"
        WHERE ${Prisma.join(conditions, ' OR ')}
        ORDER BY "id"
        FOR UPDATE
      `,
    );
    if (rows.length !== uniqueIds.length) {
      throw new NotFoundException('Paiol não encontrado.');
    }
  }

  private async currentNeqKg(
    client: Prisma.TransactionClient | PrismaService,
    magazineId: string,
  ): Promise<Prisma.Decimal> {
    const [row] = await client.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
      FROM "produto_lotes" l
      JOIN "produtos" p ON p."id" = l."produto_id"
      WHERE l."paiol_id" = ${magazineId}::uuid
    `;
    return row?.neqKg ?? new Prisma.Decimal(0);
  }

  private async assertCapacity(
    tx: Prisma.TransactionClient,
    magazineId: string,
    additionalNeqKg: Prisma.Decimal,
  ): Promise<void> {
    const magazine = await tx.magazine.findUnique({
      where: { id: magazineId },
    });
    if (!magazine) {
      throw new NotFoundException('Paiol não encontrado.');
    }

    const current = await this.currentNeqKg(tx, magazineId);
    const projected = current.plus(additionalNeqKg);
    if (projected.gt(magazine.maxNeqCapacityKg)) {
      throw new ConflictException({
        message: 'Movimentação bloqueada: capacidade NEQ do paiol excedida.',
        magazineId,
        capacityKg: magazine.maxNeqCapacityKg.toString(),
        currentNeqKg: current.toString(),
        requestedIncreaseKg: additionalNeqKg.toString(),
        projectedNeqKg: projected.toString(),
      });
    }
  }

  private async assertUnreservedQuantity(
    tx: Prisma.TransactionClient,
    lotId: string,
    quantityToRemove: Prisma.Decimal,
  ): Promise<void> {
    const reserved = await tx.serviceOrderItem.aggregate({
      where: {
        productLotId: lotId,
        serviceOrder: {
          status: {
            in: [ServiceOrderStatus.APROVADO, ServiceOrderStatus.EM_MONTAGEM],
          },
        },
      },
      _sum: { plannedQuantity: true },
    });
    const reservedQuantity =
      reserved._sum.plannedQuantity ?? new Prisma.Decimal(0);
    const activeSalesQuotes = await tx.salesQuoteItem.aggregate({
      where: {
        productLotId: lotId,
        quote: {
          status: SalesQuoteStatus.EMITIDO,
          expiresAt: { gt: new Date() },
        },
      },
      _sum: { quantity: true },
    });
    const quoteReserved =
      activeSalesQuotes._sum.quantity ?? new Prisma.Decimal(0);
    const totalReserved = reservedQuantity.plus(quoteReserved);
    const lot = await tx.productLot.findUnique({
      where: { id: lotId },
      select: { quantity: true },
    });
    const available = (lot?.quantity ?? new Prisma.Decimal(0)).minus(
      totalReserved,
    );
    if (available.lt(quantityToRemove)) {
      throw new ConflictException({
        message:
          'Movimentação bloqueada: o saldo está reservado por ordem de serviço ou orçamento comercial.',
        lotId,
        available: available.toString(),
        requested: quantityToRemove.toString(),
      });
    }
  }

  private assertCanReceive(
    magazine: {
      active: boolean;
      fireLicenseExpiresAt: Date;
    } | null,
  ): void {
    if (!magazine) {
      throw new NotFoundException('Paiol não encontrado.');
    }
    if (!magazine.active) {
      throw new ConflictException(
        'O paiol está inativo e não pode receber estoque.',
      );
    }
    if (
      magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    ) {
      throw new ConflictException(
        'O paiol está com a licença dos Bombeiros vencida e não pode receber estoque.',
      );
    }
  }

  private assertLotNotExpired(expiresAt: Date): void {
    if (
      expiresAt.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    ) {
      throw new ConflictException(
        'Lote vencido não pode ser transferido ou baixado por este fluxo.',
      );
    }
  }
}
