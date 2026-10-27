import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  Prisma,
  ProductLotStatus,
  SalesQuoteStatus,
  ServiceOrderStatus,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreateSalesQuoteDto,
  SalesQuotesQueryDto,
  SendSalesQuoteDto,
  UpdateSalesQuoteDto,
} from '../commercial.dto.js';
import {
  assertCustomerActive,
  assertCustomerCanPurchasePce,
  assertNotExpired,
  assertPriceListActive,
  effectiveQuoteStatus,
  lockLots,
  paginated,
  SALES_QUOTE_VALIDITY_DAYS,
  withEffectiveQuoteStatus,
} from '../commercial.common.js';
import { ProductPromotionsService } from './product-promotions.service.js';

@Injectable()
export class SalesQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionsService: ProductPromotionsService,
    @Optional()
    @InjectQueue('background')
    private readonly backgroundQueue?: Queue,
  ) {}

  async listSalesQuotes(query: SalesQuotesQueryDto) {
    const now = new Date();
    const conditions: Prisma.SalesQuoteWhereInput[] = [];
    if (query.status === SalesQuoteStatus.EXPIRADO) {
      conditions.push({
        OR: [
          { status: SalesQuoteStatus.EXPIRADO },
          {
            status: SalesQuoteStatus.EMITIDO,
            expiresAt: { lte: now },
          },
        ],
      });
    } else if (query.status === SalesQuoteStatus.EMITIDO) {
      conditions.push({
        status: SalesQuoteStatus.EMITIDO,
        expiresAt: { gt: now },
      });
    } else if (query.status) {
      conditions.push({ status: query.status });
    }
    if (query.search) {
      conditions.push({
        OR: [
          ...(Number.isSafeInteger(Number(query.search))
            ? [{ code: Number(query.search) }]
            : []),
          {
            customer: {
              legalName: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }
    const where: Prisma.SalesQuoteWhereInput = conditions.length
      ? { AND: conditions }
      : {};
    const [quotes, total] = await Promise.all([
      this.prisma.salesQuote.findMany({
        where,
        include: {
          customer: true,
          priceList: true,
          items: { include: { product: true, productLot: true } },
          sale: { select: { id: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.salesQuote.count({ where }),
    ]);
    return paginated(
      quotes.map((quote) => withEffectiveQuoteStatus(quote, now)),
      total,
      query,
    );
  }

  async getSalesQuote(id: string) {
    const quote = await this.prisma.salesQuote.findUnique({
      where: { id },
      include: {
        customer: true,
        priceList: true,
        items: { include: { product: true, productLot: true } },
        sale: { select: { id: true, code: true } },
      },
    });
    if (!quote) {
      throw new NotFoundException('Orçamento comercial não encontrado.');
    }
    return withEffectiveQuoteStatus(quote);
  }

  async createSalesQuote(dto: CreateSalesQuoteDto) {
    const lotIds = dto.items.map((item) => item.productLotId).sort();
    return this.prisma.$transaction(
      async (tx) => {
        await lockLots(tx, lotIds);
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
        assertPriceListActive(priceList);
        assertCustomerActive(customer, dto.customerId);
        if (lots.length !== lotIds.length) {
          throw new NotFoundException(
            'Um ou mais lotes não foram encontrados.',
          );
        }
        const lotById = new Map(lots.map((lot) => [lot.id, lot]));
        const priceByProduct = new Map(
          priceList.items.map((item) => [item.productId, item.unitPrice]),
        );
        const now = new Date();
        const promotionPriceByProduct =
          await this.promotionsService.getActivePromotionalPrices(
            tx,
            lots.map((lot) => lot.productId),
            now,
          );
        const pceClasses = new Set<string>();
        const quoteLines: Array<{
          productId: string;
          productLotId: string;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];

        for (const item of dto.items) {
          const lot = lotById.get(item.productLotId)!;
          const unitPrice = this.promotionsService.resolveUnitPrice(
            priceByProduct.get(lot.productId),
            promotionPriceByProduct.get(lot.productId),
          );
          if (!unitPrice) {
            throw new ConflictException(
              `Produto ${lot.product.name} não possui preço nesta tabela.`,
            );
          }
          if (lot.status !== ProductLotStatus.DISPONIVEL) {
            throw new ConflictException(
              `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser orçado.`,
            );
          }
          assertNotExpired(lot.expiresAt);
          if (lot.product.isPce) {
            if (!lot.product.riskClass) {
              throw new ConflictException(
                `Produto PCE ${lot.product.name} sem classe de risco não pode ser orçado.`,
              );
            }
            pceClasses.add(lot.product.riskClass);
          }

          const quantity = new Prisma.Decimal(item.quantity);
          const serviceReservations = await tx.serviceOrderItem.aggregate({
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
          const quoteReservations = await tx.salesQuoteItem.aggregate({
            where: {
              productLotId: lot.id,
              quote: {
                status: SalesQuoteStatus.EMITIDO,
                expiresAt: { gt: now },
              },
            },
            _sum: { quantity: true },
          });
          const serviceReserved =
            serviceReservations._sum.plannedQuantity ?? new Prisma.Decimal(0);
          const quoteReserved =
            quoteReservations._sum.quantity ?? new Prisma.Decimal(0);
          const reserved = serviceReserved.plus(quoteReserved);
          const available = lot.quantity.minus(reserved);
          if (available.lt(quantity)) {
            throw new ConflictException({
              message: `Estoque disponível insuficiente para orçar o lote ${lot.lotNumber}.`,
              lotId: lot.id,
              physicalQuantity: lot.quantity.toString(),
              alreadyReserved: reserved.toString(),
              requested: quantity.toString(),
              available: available.toString(),
            });
          }
          quoteLines.push({
            productId: lot.productId,
            productLotId: lot.id,
            quantity,
            unitPrice,
            subtotal: unitPrice.mul(quantity).toDecimalPlaces(2),
          });
        }
        assertCustomerCanPurchasePce(customer, pceClasses);
        const total = quoteLines.reduce(
          (sum, line) => sum.plus(line.subtotal),
          new Prisma.Decimal(0),
        );
        const expiresAt = new Date(
          now.getTime() + SALES_QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
        );
        const quote = await tx.salesQuote.create({
          data: {
            customerId: customer?.id ?? null,
            priceListId: priceList.id,
            total,
            expiresAt,
            items: { create: quoteLines },
          },
          include: {
            customer: true,
            priceList: true,
            items: { include: { product: true, productLot: true } },
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'sales-quote.created',
            aggregateType: 'SalesQuote',
            aggregateId: quote.id,
            after: {
              code: quote.code,
              status: quote.status,
              customerId: quote.customerId,
              priceListId: quote.priceListId,
              total: quote.total.toString(),
              expiresAt: quote.expiresAt.toISOString(),
              itemCount: quote.items.length,
            },
          },
        });
        return quote;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async updateSalesQuote(id: string, dto: UpdateSalesQuoteDto) {
    const lotIds = dto.items.map((item) => item.productLotId).sort();
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "orcamentos_venda" WHERE "id" = ${id}::uuid FOR UPDATE
        `;
        if (!rows.length) {
          throw new NotFoundException('Orçamento comercial não encontrado.');
        }
        const existingQuote = await tx.salesQuote.findUnique({
          where: { id },
          include: { customer: true, items: true },
        });
        if (!existingQuote) {
          throw new NotFoundException('Orçamento comercial não encontrado.');
        }

        const currentEffectiveStatus = effectiveQuoteStatus(existingQuote);
        if (currentEffectiveStatus !== SalesQuoteStatus.EMITIDO) {
          throw new ConflictException(
            'Somente orçamentos emitidos e dentro da validade podem ser editados.',
          );
        }

        await lockLots(tx, lotIds);

        const targetCustomerId =
          dto.customerId !== undefined
            ? dto.customerId
            : existingQuote.customerId;
        const targetPriceListId =
          dto.priceListId !== undefined
            ? dto.priceListId
            : existingQuote.priceListId;

        const [priceList, lots, customer] = await Promise.all([
          tx.priceList.findUnique({
            where: { id: targetPriceListId },
            include: { items: true },
          }),
          tx.productLot.findMany({
            where: { id: { in: lotIds } },
            include: { product: true },
          }),
          targetCustomerId
            ? tx.customer.findUnique({ where: { id: targetCustomerId } })
            : Promise.resolve(null),
        ]);

        if (!priceList) {
          throw new NotFoundException('Tabela de preço não encontrada.');
        }
        assertPriceListActive(priceList);
        assertCustomerActive(customer, targetCustomerId ?? undefined);
        if (lots.length !== lotIds.length) {
          throw new NotFoundException(
            'Um ou mais lotes não foram encontrados.',
          );
        }

        const lotById = new Map(lots.map((lot) => [lot.id, lot]));
        const priceByProduct = new Map(
          priceList.items.map((item) => [item.productId, item.unitPrice]),
        );
        const now = new Date();
        const activePromotions =
          await this.promotionsService.getActivePromotionalPrices(
            tx,
            lots.map((lot) => lot.productId),
            now,
          );

        const pceClasses = new Set<string>();
        const quoteLines: Array<{
          productId: string;
          productLotId: string;
          quantity: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];

        for (const item of dto.items) {
          const lot = lotById.get(item.productLotId)!;
          const unitPrice = this.promotionsService.resolveUnitPrice(
            priceByProduct.get(lot.productId),
            activePromotions.get(lot.productId),
          );
          if (!unitPrice) {
            throw new ConflictException(
              `Produto ${lot.product.name} não possui preço nesta tabela.`,
            );
          }
          if (lot.status !== ProductLotStatus.DISPONIVEL) {
            throw new ConflictException(
              `Lote ${lot.lotNumber} está em situação ${lot.status.toLowerCase()} e não pode ser orçado.`,
            );
          }
          assertNotExpired(lot.expiresAt);
          if (lot.product.isPce) {
            if (!lot.product.riskClass) {
              throw new ConflictException(
                `Produto PCE ${lot.product.name} sem classe de risco não pode ser orçado.`,
              );
            }
            pceClasses.add(lot.product.riskClass);
          }

          const quantity = new Prisma.Decimal(item.quantity);
          const serviceReservations = await tx.serviceOrderItem.aggregate({
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

          // Exclui o orçamento atual que está sendo editado para não reservar contra si mesmo
          const quoteReservations = await tx.salesQuoteItem.aggregate({
            where: {
              productLotId: lot.id,
              quote: {
                id: { not: id },
                status: SalesQuoteStatus.EMITIDO,
                expiresAt: { gt: now },
              },
            },
            _sum: { quantity: true },
          });

          const serviceReserved =
            serviceReservations._sum.plannedQuantity ?? new Prisma.Decimal(0);
          const quoteReserved =
            quoteReservations._sum.quantity ?? new Prisma.Decimal(0);
          const reserved = serviceReserved.plus(quoteReserved);
          const available = lot.quantity.minus(reserved);
          if (available.lt(quantity)) {
            throw new ConflictException({
              message: `Estoque disponível insuficiente para orçar o lote ${lot.lotNumber}.`,
              lotId: lot.id,
              physicalQuantity: lot.quantity.toString(),
              alreadyReserved: reserved.toString(),
              requested: quantity.toString(),
              available: available.toString(),
            });
          }

          quoteLines.push({
            productId: lot.productId,
            productLotId: lot.id,
            quantity,
            unitPrice,
            subtotal: unitPrice.mul(quantity).toDecimalPlaces(2),
          });
        }

        assertCustomerCanPurchasePce(customer, pceClasses);

        const total = quoteLines.reduce(
          (sum, line) => sum.plus(line.subtotal),
          new Prisma.Decimal(0),
        );
        const expiresAt = new Date(
          now.getTime() + SALES_QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
        );

        await tx.salesQuoteItem.deleteMany({
          where: { quoteId: id },
        });

        const updatedQuote = await tx.salesQuote.update({
          where: { id },
          data: {
            customerId: customer?.id ?? null,
            priceListId: priceList.id,
            total,
            expiresAt,
            items: { create: quoteLines },
          },
          include: {
            customer: true,
            priceList: true,
            items: { include: { product: true, productLot: true } },
          },
        });

        await createAuditLog(tx, {
          data: {
            action: 'sales-quote.updated',
            aggregateType: 'SalesQuote',
            aggregateId: id,
            before: {
              total: existingQuote.total.toString(),
              customerId: existingQuote.customerId,
              priceListId: existingQuote.priceListId,
              itemCount: existingQuote.items.length,
            },
            after: {
              total: updatedQuote.total.toString(),
              customerId: updatedQuote.customerId,
              priceListId: updatedQuote.priceListId,
              expiresAt: updatedQuote.expiresAt.toISOString(),
              itemCount: updatedQuote.items.length,
            },
          },
        });

        return withEffectiveQuoteStatus(updatedQuote);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async sendSalesQuote(id: string, dto?: SendSalesQuoteDto) {
    const quote = await this.prisma.salesQuote.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!quote) {
      throw new NotFoundException('Orçamento comercial não encontrado.');
    }
    const currentEffectiveStatus = effectiveQuoteStatus(quote);
    if (currentEffectiveStatus !== SalesQuoteStatus.EMITIDO) {
      throw new ConflictException(
        'Apenas orçamentos emitidos e dentro da validade podem ser enviados ao cliente.',
      );
    }
    const recipientEmail = dto?.recipientEmail?.trim();
    if (!recipientEmail) {
      throw new BadRequestException(
        'Informe o e-mail de destino para envio do orçamento.',
      );
    }

    if (this.backgroundQueue) {
      try {
        await this.backgroundQueue.add(
          'commercial.quote.send-email',
          {
            quoteId: quote.id,
            code: quote.code,
            recipientEmail,
            total: quote.total.toString(),
            expiresAt: quote.expiresAt.toISOString(),
          },
          { removeOnComplete: true, attempts: 3 },
        );
      } catch {
        // Ignora falha de enfileiramento em ambientes sem Redis ativo
      }
    }

    await createAuditLog(this.prisma, {
      data: {
        action: 'sales-quote.sent',
        aggregateType: 'SalesQuote',
        aggregateId: quote.id,
        after: {
          code: quote.code,
          recipientEmail,
          total: quote.total.toString(),
        },
      },
    });

    return {
      success: true,
      quoteId: quote.id,
      code: quote.code,
      recipientEmail,
      message: 'Orçamento enviado com sucesso.',
    };
  }

  async cancelSalesQuote(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "orcamentos_venda" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException('Orçamento comercial não encontrado.');
      }
      const quote = await tx.salesQuote.findUnique({ where: { id } });
      if (!quote) {
        throw new NotFoundException('Orçamento comercial não encontrado.');
      }
      const currentEffectiveStatus = effectiveQuoteStatus(quote);
      if (currentEffectiveStatus !== SalesQuoteStatus.EMITIDO) {
        throw new ConflictException(
          'Somente orçamentos emitidos e dentro da validade podem ser cancelados.',
        );
      }
      const cancelled = await tx.salesQuote.update({
        where: { id },
        data: {
          status: SalesQuoteStatus.CANCELADO,
          cancelledAt: new Date(),
        },
        include: {
          customer: true,
          priceList: true,
          items: { include: { product: true, productLot: true } },
        },
      });
      await createAuditLog(tx, {
        data: {
          action: 'sales-quote.cancelled',
          aggregateType: 'SalesQuote',
          aggregateId: id,
          before: { status: quote.status },
          after: { status: cancelled.status },
        },
      });
      return cancelled;
    });
  }
}
