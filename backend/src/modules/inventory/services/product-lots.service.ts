import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductType,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  assertCanReceive,
  assertCapacity,
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
import { ProductLotsOperationsService } from './product-lots-operations.service.js';

@Injectable()
export class ProductLotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationsService: ProductLotsOperationsService,
  ) {}

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
    return this.operationsService.splitLot(parentLotId, dto);
  }

  async updateLotStatus(id: string, dto: UpdateLotStatusDto) {
    return this.operationsService.updateLotStatus(id, dto);
  }
}
