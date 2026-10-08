import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderStatus, StockMovementType } from '@prisma/client';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreatePriceListDto,
  CreateSaleDto,
  CreateSaleReturnDto,
  PriceListsQueryDto,
  SalesQueryDto,
} from './commercial.dto.js';

@Injectable()
export class CommercialService {
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
    return this.paginated(data, total, query);
  }

  async getPriceList(id: string) {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      include: {
        items: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
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
              ? this.dateOnly(dto.effectiveFrom)
              : null,
            effectiveUntil: dto.effectiveUntil
              ? this.dateOnly(dto.effectiveUntil)
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
        await tx.auditLog.create({
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

  async listSales(query: SalesQueryDto) {
    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        include: {
          customer: true,
          priceList: true,
          items: { include: { product: true, productLot: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.sale.count(),
    ]);
    return this.paginated(data, total, query);
  }

  async getSale(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        priceList: true,
        items: { include: { product: true, productLot: true } },
      },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }
    return sale;
  }

  async listSaleReturns(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }
    return this.prisma.saleReturn.findMany({
      where: { saleId },
      include: {
        items: {
          include: {
            saleItem: { include: { product: true } },
            productLot: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSaleReturn(saleId: string, dto: CreateSaleReturnDto) {
    return this.prisma.$transaction(async (tx) => {
      const saleRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "vendas" WHERE "id" = ${saleId}::uuid FOR UPDATE
      `;
      if (saleRows.length === 0) {
        throw new NotFoundException('Venda não encontrada.');
      }

      const saleItemIds = dto.items.map((item) => item.saleItemId);
      const saleItems = await tx.saleItem.findMany({
        where: { id: { in: saleItemIds }, saleId },
        include: { product: true, productLot: true },
      });
      if (saleItems.length !== saleItemIds.length) {
        throw new NotFoundException(
          'Um ou mais itens não pertencem a esta venda.',
        );
      }
      const lotIds = [...new Set(saleItems.map((item) => item.productLotId))].sort();
      await this.lockLots(tx, lotIds);
      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true },
      });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      const returnLines: Array<{
        saleItemId: string;
        productLotId: string;
        quantity: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
      }> = [];

      for (const requestItem of dto.items) {
        const saleItem = saleItems.find(
          (item) => item.id === requestItem.saleItemId,
        )!;
        const lot = lotById.get(saleItem.productLotId);
        if (!lot) {
          throw new NotFoundException('Lote original não encontrado.');
        }
        this.assertNotExpired(lot.expiresAt);
        const existingReturns = await tx.saleReturnItem.aggregate({
          where: { saleItemId: saleItem.id },
          _sum: { quantity: true },
        });
        const alreadyReturned =
          existingReturns._sum.quantity ?? new Prisma.Decimal(0);
        const quantity = new Prisma.Decimal(requestItem.quantity);
        const remaining = saleItem.quantity.minus(alreadyReturned);
        if (quantity.gt(remaining)) {
          throw new ConflictException({
            message: 'A devolução excede a quantidade ainda não devolvida.',
            saleItemId: saleItem.id,
            soldQuantity: saleItem.quantity.toString(),
            alreadyReturned: alreadyReturned.toString(),
            requested: quantity.toString(),
            remaining: remaining.toString(),
          });
        }
        returnLines.push({
          saleItemId: saleItem.id,
          productLotId: lot.id,
          quantity,
          unitPrice: saleItem.unitPrice,
          subtotal: saleItem.unitPrice.mul(quantity).toDecimalPlaces(2),
        });
      }

      const magazineIds = [...new Set(lots.map((lot) => lot.magazineId))].sort();
      for (const magazineId of magazineIds) {
        await this.lockMagazine(tx, magazineId);
      }
      const neqByMagazine = new Map<string, Prisma.Decimal>();
      for (const line of returnLines) {
        const lot = lotById.get(line.productLotId)!;
        const additionalNeqKg = line.quantity
          .mul(lot.product.neqGrams)
          .div(1000);
        neqByMagazine.set(
          lot.magazineId,
          (neqByMagazine.get(lot.magazineId) ?? new Prisma.Decimal(0)).plus(
            additionalNeqKg,
          ),
        );
      }
      for (const [magazineId, additionalNeqKg] of neqByMagazine) {
        const magazine = await tx.magazine.findUnique({
          where: { id: magazineId },
        });
        this.assertMagazineCanReceive(magazine);
        await this.assertCapacity(tx, magazineId, additionalNeqKg);
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          saleId,
          reason: dto.reason.trim(),
          items: { create: returnLines },
        },
        include: {
          items: {
            include: {
              saleItem: { include: { product: true } },
              productLot: true,
            },
          },
        },
      });

      for (const line of returnLines) {
        const lot = lotById.get(line.productLotId)!;
        const nextQuantity = lot.quantity.plus(line.quantity);
        const movement = await tx.stockMovement.create({
          data: {
            type: StockMovementType.ENTRADA,
            productLotId: lot.id,
            quantity: line.quantity,
            destinationMagazineId: lot.magazineId,
            reference: `DEVOLUCAO-${saleReturn.code}`,
          },
        });
        await tx.productLot.update({
          where: { id: lot.id },
          data: { quantity: nextQuantity },
        });
        await tx.auditLog.create({
          data: {
            action: 'inventory.movement.entrada',
            aggregateType: 'ProductLot',
            aggregateId: lot.id,
            before: { quantity: lot.quantity.toString() },
            after: {
              quantity: nextQuantity.toString(),
              movementId: movement.id,
              reference: `DEVOLUCAO-${saleReturn.code}`,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'sale.returned',
          aggregateType: 'Sale',
          aggregateId: saleId,
          after: {
            returnId: saleReturn.id,
            returnCode: saleReturn.code,
            reason: saleReturn.reason,
            items: returnLines.map((item) => ({
              saleItemId: item.saleItemId,
              productLotId: item.productLotId,
              quantity: item.quantity.toString(),
              subtotal: item.subtotal.toString(),
            })),
          },
        },
      });
      return saleReturn;
    });
  }

  async createSale(dto: CreateSaleDto) {
    const lotIds = dto.items.map((item) => item.productLotId).sort();
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockLots(tx, lotIds);
        const [priceList, lots, customer] = await Promise.all([
          tx.priceList.findUnique({
            where: { id: dto.priceListId },
            include: { items: true },
          }),
          tx.productLot.findMany({
            where: { id: { in: lotIds } },
            include: { product: true },
          }),
          dto.customerId
            ? tx.customer.findUnique({ where: { id: dto.customerId } })
            : Promise.resolve(null),
        ]);
        if (!priceList) {
          throw new NotFoundException('Tabela de preço não encontrada.');
        }
        this.assertPriceListActive(priceList);
        if (dto.customerId && !customer) {
          throw new NotFoundException('Cliente não encontrado.');
        }
        if (customer && !customer.active) {
          throw new ConflictException('Cliente inativo não pode realizar venda.');
        }
        if (lots.length !== lotIds.length) {
          throw new NotFoundException('Um ou mais lotes não foram encontrados.');
        }
        const lotById = new Map(lots.map((lot) => [lot.id, lot]));
        const priceByProduct = new Map(
          priceList.items.map((item) => [item.productId, item.unitPrice]),
        );
        const saleLines: Array<{
          productId: string;
          productLotId: string;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];
        const pceClasses = new Set<string>();

        for (const item of dto.items) {
          const lot = lotById.get(item.productLotId)!;
          const unitPrice = priceByProduct.get(lot.productId);
          if (!unitPrice) {
            throw new ConflictException(
              `Produto ${lot.product.name} não possui preço nesta tabela.`,
            );
          }
          this.assertNotExpired(lot.expiresAt);
          if (lot.product.isPce) {
            if (!lot.product.riskClass) {
              throw new ConflictException(
                `Produto PCE ${lot.product.name} sem classe de risco não pode ser vendido.`,
              );
            }
            pceClasses.add(lot.product.riskClass);
          }
          const quantity = new Prisma.Decimal(item.quantity);
          const reserved = await tx.serviceOrderItem.aggregate({
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
          const reservedQuantity =
            reserved._sum.plannedQuantity ?? new Prisma.Decimal(0);
          const available = lot.quantity.minus(reservedQuantity);
          if (available.lt(quantity)) {
            throw new ConflictException({
              message: `Estoque disponível insuficiente para venda do lote ${lot.lotNumber}.`,
              lotId: lot.id,
              physicalQuantity: lot.quantity.toString(),
              alreadyReserved: reservedQuantity.toString(),
              requested: quantity.toString(),
              available: available.toString(),
            });
          }
          const subtotal = unitPrice.mul(quantity).toDecimalPlaces(2);
          saleLines.push({
            productId: lot.productId,
            productLotId: lot.id,
            quantity,
            unitPrice,
            subtotal,
          });
        }
        if (pceClasses.size > 0) {
          if (!customer) {
            throw new ConflictException(
              'Venda de PCE exige cliente identificado com CR válido e classes autorizadas.',
            );
          }
          const today = new Date().toISOString().slice(0, 10);
          const crExpires = customer.crExpiresAt?.toISOString().slice(0, 10);
          const unauthorized = [...pceClasses].filter(
            (riskClass) =>
              !customer.authorizedPceClasses.includes(riskClass),
          );
          if (!customer.hasCr || !crExpires || crExpires < today || unauthorized.length) {
            throw new ConflictException({
              message: 'Cliente não está autorizado para os PCE desta venda.',
              reasons: [
                ...(!customer.hasCr
                  ? ['Cliente sem Certificado de Registro informado.']
                  : []),
                ...(customer.hasCr && (!crExpires || crExpires < today)
                  ? ['Certificado de Registro vencido ou sem validade.']
                  : []),
                ...(unauthorized.length
                  ? [`Classes não autorizadas: ${unauthorized.join(', ')}.`]
                  : []),
              ],
            });
          }
        }

        const total = saleLines.reduce(
          (sum, item) => sum.plus(item.subtotal),
          new Prisma.Decimal(0),
        );
        const sale = await tx.sale.create({
          data: {
            customerId: dto.customerId ?? null,
            priceListId: priceList.id,
            total,
            items: { create: saleLines },
          },
          include: {
            customer: true,
            priceList: true,
            items: { include: { product: true, productLot: true } },
          },
        });

        for (const line of saleLines) {
          const lot = lotById.get(line.productLotId)!;
          const nextQuantity = lot.quantity.minus(line.quantity);
          const movement = await tx.stockMovement.create({
            data: {
              type: StockMovementType.SAIDA,
              productLotId: lot.id,
              quantity: line.quantity,
              sourceMagazineId: lot.magazineId,
              reference: `VENDA-${sale.code}`,
            },
          });
          await tx.productLot.update({
            where: { id: lot.id },
            data: { quantity: nextQuantity },
          });
          await tx.auditLog.create({
            data: {
              action: 'inventory.movement.saida',
              aggregateType: 'ProductLot',
              aggregateId: lot.id,
              before: { quantity: lot.quantity.toString() },
              after: {
                quantity: nextQuantity.toString(),
                movementId: movement.id,
                reference: `VENDA-${sale.code}`,
              },
            },
          });
        }
        await tx.auditLog.create({
          data: {
            action: 'sale.completed',
            aggregateType: 'Sale',
            aggregateId: sale.id,
            after: {
              code: sale.code,
              customerId: sale.customerId,
              priceListId: sale.priceListId,
              total: sale.total.toString(),
              itemCount: sale.items.length,
            },
          },
        });
        return sale;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private assertPriceListActive(priceList: {
    active: boolean;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
  }) {
    const today = new Date().toISOString().slice(0, 10);
    if (
      !priceList.active ||
      (priceList.effectiveFrom &&
        priceList.effectiveFrom.toISOString().slice(0, 10) > today) ||
      (priceList.effectiveUntil &&
        priceList.effectiveUntil.toISOString().slice(0, 10) < today)
    ) {
      throw new ConflictException(
        'Tabela de preço inativa ou fora do período de vigência.',
      );
    }
  }

  private assertNotExpired(expiresAt: Date) {
    if (expiresAt.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) {
      throw new ConflictException('Lote vencido não pode ser vendido.');
    }
  }

  private async lockLots(
    tx: Prisma.TransactionClient,
    lotIds: string[],
  ): Promise<void> {
    const conditions = lotIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id" FROM "produto_lotes"
        WHERE ${Prisma.join(conditions, ' OR ')}
        ORDER BY "id"
        FOR UPDATE
      `,
    );
    if (rows.length !== lotIds.length) {
      throw new NotFoundException('Um ou mais lotes não foram encontrados.');
    }
  }

  private async lockMagazine(
    tx: Prisma.TransactionClient,
    magazineId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "paioes" WHERE "id" = ${magazineId}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException('Paiol do lote não encontrado.');
    }
  }

  private assertMagazineCanReceive(
    magazine: {
      active: boolean;
      fireLicenseExpiresAt: Date;
    } | null,
  ) {
    if (!magazine) {
      throw new NotFoundException('Paiol do lote não encontrado.');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (
      !magazine.active ||
      magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) < today
    ) {
      throw new ConflictException(
        'Paiol inativo ou com licença dos Bombeiros vencida não pode receber devolução.',
      );
    }
  }

  private async assertCapacity(
    tx: Prisma.TransactionClient,
    magazineId: string,
    additionalNeqKg: Prisma.Decimal,
  ) {
    const magazine = await tx.magazine.findUnique({
      where: { id: magazineId },
    });
    if (!magazine) {
      throw new NotFoundException('Paiol do lote não encontrado.');
    }
    const [row] = await tx.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
      FROM "produto_lotes" l
      JOIN "produtos" p ON p."id" = l."produto_id"
      WHERE l."paiol_id" = ${magazineId}::uuid
    `;
    const projected = (row?.neqKg ?? new Prisma.Decimal(0)).plus(
      additionalNeqKg,
    );
    if (projected.gt(magazine.maxNeqCapacityKg)) {
      throw new ConflictException({
        message: 'Devolução bloqueada: capacidade NEQ do paiol excedida.',
        magazineId,
        capacityKg: magazine.maxNeqCapacityKg.toString(),
        projectedNeqKg: projected.toString(),
      });
    }
  }

  private dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private paginated<T>(
    data: T[],
    total: number,
    query: { page: number; limit: number },
  ) {
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
}
