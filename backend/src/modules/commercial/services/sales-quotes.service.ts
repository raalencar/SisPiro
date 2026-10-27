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
  SalesQuoteStatus,
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
  effectiveQuoteStatus,
  lockLots,
  paginated,
  SALES_QUOTE_VALIDITY_DAYS,
  withEffectiveQuoteStatus,
} from '../commercial.common.js';
import { ProductPromotionsService } from './product-promotions.service.js';
import {
  cancelQuoteInTransaction,
  prepareQuoteItemsAndTotal,
} from './sales-quotes.helper.js';

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
      quotes.map((quote) => withEffectiveQuoteStatus(quote)),
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
    const lotIds = dto.items.map((item) => item.productLotId);
    return this.prisma.$transaction(
      async (tx) => {
        await lockLots(tx, lotIds);
        const { quoteLines, total } = await prepareQuoteItemsAndTotal(
          tx,
          this.promotionsService,
          {
            items: dto.items,
            priceListId: dto.priceListId,
            customerId: dto.customerId,
          },
        );

        const expiresAt = new Date();
        expiresAt.setUTCDate(
          expiresAt.getUTCDate() + SALES_QUOTE_VALIDITY_DAYS,
        );

        const quote = await tx.salesQuote.create({
          data: {
            customerId: dto.customerId ?? null,
            priceListId: dto.priceListId,
            status: SalesQuoteStatus.EMITIDO,
            expiresAt,
            total,
            items: {
              create: quoteLines.map((line) => ({
                productId: line.productId,
                productLotId: line.productLotId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                subtotal: line.subtotal,
              })),
            },
          },
          include: {
            customer: true,
            priceList: true,
            items: { include: { product: true, productLot: true } },
          },
        });

        await createAuditLog(tx, {
          data: {
            action: 'commercial.quote.created',
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

        return withEffectiveQuoteStatus(quote);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async updateSalesQuote(id: string, dto: UpdateSalesQuoteDto) {
    const lotIds = dto.items.map((item) => item.productLotId);
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

        const { quoteLines, total } = await prepareQuoteItemsAndTotal(
          tx,
          this.promotionsService,
          {
            items: dto.items,
            priceListId: targetPriceListId,
            customerId: targetCustomerId,
            excludeQuoteId: id,
          },
        );

        await tx.salesQuoteItem.deleteMany({
          where: { quoteId: id },
        });

        const updated = await tx.salesQuote.update({
          where: { id },
          data: {
            customerId: targetCustomerId,
            priceListId: targetPriceListId,
            total,
            items: {
              create: quoteLines.map((line) => ({
                productId: line.productId,
                productLotId: line.productLotId,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                subtotal: line.subtotal,
              })),
            },
          },
          include: {
            customer: true,
            priceList: true,
            items: { include: { product: true, productLot: true } },
          },
        });

        await createAuditLog(tx, {
          data: {
            action: 'commercial.quote.updated',
            aggregateType: 'SalesQuote',
            aggregateId: id,
            before: {
              customerId: existingQuote.customerId,
              priceListId: existingQuote.priceListId,
              total: existingQuote.total.toString(),
              itemCount: existingQuote.items.length,
            },
            after: {
              customerId: updated.customerId,
              priceListId: updated.priceListId,
              total: updated.total.toString(),
              itemCount: updated.items.length,
            },
          },
        });

        return withEffectiveQuoteStatus(updated);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
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
    return this.prisma.$transaction(
      (tx) => cancelQuoteInTransaction(tx, id),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }
}
