import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialDirection,
  Prisma,
  ProductType,
  SalesQuoteStatus,
  ServiceOrderStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { CustomersService } from '../commercial/customers.service.js';
import {
  ServiceOrdersQueryDto,
  ServiceOrdersReportQueryDto,
} from './service-orders.dto.js';
import {
  ApproveServiceOrderDto,
  CloseServiceOrderDto,
  CreateServiceOrderDto,
} from './service-orders.dto.js';
import { BlastersService } from './blasters.service.js';

const RESERVED_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.APROVADO,
  ServiceOrderStatus.EM_MONTAGEM,
];

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly blasters: BlastersService,
  ) {}

  async list(query: ServiceOrdersQueryDto) {
    const where: Prisma.ServiceOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                eventLocation: { contains: query.search, mode: 'insensitive' },
              },
              {
                customer: {
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
      this.prisma.serviceOrder.findMany({
        where,
        include: {
          customer: true,
          responsibleBlaster: true,
          items: {
            include: {
              product: true,
              productLot: { include: { magazine: true } },
            },
          },
        },
        orderBy: [{ eventAt: 'desc' }, { code: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.serviceOrder.count({ where }),
    ]);

    return {
      data: data.map((order) => this.serializeOrder(order)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async report(query: ServiceOrdersReportQueryDto) {
    if (query.from > query.to) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }
    const from = new Date(`${query.from}T00:00:00.000Z`);
    const until = new Date(`${query.to}T00:00:00.000Z`);
    until.setUTCDate(until.getUTCDate() + 1);
    const groups = await this.prisma.serviceOrder.groupBy({
      by: ['status'],
      where: { eventAt: { gte: from, lt: until } },
      _count: { _all: true, contractedAmount: true },
      _sum: { contractedAmount: true },
    });
    const groupByStatus = new Map(groups.map((group) => [group.status, group]));
    const byStatus = Object.values(ServiceOrderStatus).map((status) => {
      const group = groupByStatus.get(status);
      return {
        status,
        orderCount: group?._count._all ?? 0,
        ordersWithoutContractedAmount: group
          ? group._count._all - group._count.contractedAmount
          : 0,
        contractedAmount: (
          group?._sum.contractedAmount ?? new Prisma.Decimal(0)
        ).toString(),
      };
    });
    const totalContractedAmount = groups.reduce(
      (sum, group) =>
        sum.plus(group._sum.contractedAmount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    return {
      period: { from: query.from, to: query.to, basis: 'data do evento' },
      totals: {
        orderCount: groups.reduce((sum, group) => sum + group._count._all, 0),
        ordersWithoutContractedAmount: groups.reduce(
          (sum, group) =>
            sum + group._count._all - group._count.contractedAmount,
          0,
        ),
        contractedAmount: totalContractedAmount.toString(),
      },
      byStatus,
    };
  }

  async get(id: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        responsibleBlaster: true,
        items: {
          include: {
            product: true,
            productLot: { include: { magazine: true } },
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }
    return this.serializeOrder(order);
  }

  async create(dto: CreateServiceOrderDto) {
    if (new Date(dto.eventAt).getTime() < Date.now()) {
      throw new BadRequestException('A data do evento deve estar no futuro.');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    if (!customer.active) {
      throw new ConflictException('Cliente inativo não pode receber nova OS.');
    }
    const lotIds = dto.items.map((item) => item.productLotId);
    if (new Set(lotIds).size !== lotIds.length) {
      throw new BadRequestException(
        'Informe cada lote uma única vez na OS; consolide as quantidades por lote.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true, magazine: true },
      });
      if (lots.length !== lotIds.length) {
        throw new NotFoundException('Um ou mais lotes informados não existem.');
      }
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      for (const item of dto.items) {
        const lot = lotById.get(item.productLotId)!;
        if (lot.productId !== item.productId) {
          throw new BadRequestException(
            'O produto informado não corresponde ao produto do lote.',
          );
        }
        if (lot.product.type === ProductType.SERVICO) {
          throw new BadRequestException(
            'Itens de OS precisam referenciar produtos com lote de estoque.',
          );
        }
      }

      const order = await tx.serviceOrder.create({
        data: {
          customerId: dto.customerId,
          contractedAmount: new Prisma.Decimal(dto.contractedAmount),
          eventAt: new Date(dto.eventAt),
          eventLocation: dto.eventLocation.trim(),
          status: ServiceOrderStatus.ORCAMENTO,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              productLotId: item.productLotId,
              plannedQuantity: new Prisma.Decimal(item.plannedQuantity),
            })),
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              productLot: { include: { magazine: true } },
            },
          },
        },
      });
      await this.audit(tx, 'service-order.created', order.id, undefined, {
        code: order.code,
        customerId: order.customerId,
        contractedAmount: order.contractedAmount?.toString() ?? null,
        eventAt: order.eventAt.toISOString(),
        itemCount: order.items.length,
        status: order.status,
      });
      return this.serializeOrder(order);
    });
  }

  async approve(id: string, dto: ApproveServiceOrderDto) {
    const summary = await this.get(id);
    const blasterEligibility = await this.blasters.checkEligibility(
      dto.responsibleBlasterId,
      { eventAt: summary.eventAt.toISOString() },
    );
    if (!blasterEligibility.eligible) {
      throw new ConflictException({
        message: 'Blaster não está habilitado para a data do evento.',
        reasons: blasterEligibility.reasons,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({
        where: { id },
        include: {
          customer: true,
          items: { include: { product: true, productLot: true } },
        },
      });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (order.status !== ServiceOrderStatus.ORCAMENTO) {
        throw new ConflictException(
          'Somente uma OS em orçamento pode ser aprovada.',
        );
      }
      if (!order.customer.active) {
        throw new ConflictException('Cliente inativo não pode aprovar a OS.');
      }
      const pceClasses = [
        ...new Set(
          order.items
            .filter((item) => item.product.isPce)
            .map((item) => item.product.riskClass!)
            .filter(Boolean),
        ),
      ];
      if (pceClasses.length > 0) {
        const eligibility = await this.customers.checkPceEligibility(
          order.customerId,
          { classes: pceClasses },
        );
        if (!eligibility.eligible) {
          throw new ConflictException({
            message: 'Cliente não está autorizado para os PCE desta OS.',
            reasons: eligibility.reasons,
          });
        }
      }

      const lotIds = order.items.map((item) => item.productLotId).sort();
      await this.lockLots(tx, lotIds);
      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true, magazine: true },
      });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));

      for (const item of order.items) {
        const lot = lotById.get(item.productLotId);
        if (!lot) {
          throw new NotFoundException('Lote reservado não encontrado.');
        }
        if (lot.productId !== item.productId) {
          throw new ConflictException('O produto do lote foi alterado.');
        }
        this.assertNotExpired(lot.expiresAt);
        this.assertMagazineCanStore(lot.magazine);
        const activeReservations = await tx.serviceOrderItem.aggregate({
          where: {
            productLotId: lot.id,
            serviceOrderId: { not: order.id },
            serviceOrder: { status: { in: RESERVED_STATUSES } },
          },
          _sum: { plannedQuantity: true },
        });
        const reserved =
          activeReservations._sum.plannedQuantity ?? new Prisma.Decimal(0);
        const activeSalesQuotes = await tx.salesQuoteItem.aggregate({
          where: {
            productLotId: lot.id,
            quote: {
              status: SalesQuoteStatus.EMITIDO,
              expiresAt: { gt: new Date() },
            },
          },
          _sum: { quantity: true },
        });
        const quoteReserved =
          activeSalesQuotes._sum.quantity ?? new Prisma.Decimal(0);
        const totalReserved = reserved.plus(quoteReserved);
        const available = lot.quantity.minus(totalReserved);
        if (available.lt(item.plannedQuantity)) {
          throw new ConflictException({
            message: `Estoque disponível insuficiente para o lote ${lot.lotNumber}.`,
            lotId: lot.id,
            physicalQuantity: lot.quantity.toString(),
            alreadyReserved: totalReserved.toString(),
            requested: item.plannedQuantity.toString(),
            available: available.toString(),
          });
        }
      }

      const updated = await tx.serviceOrder.update({
        where: { id },
        data: {
          status: ServiceOrderStatus.APROVADO,
          responsibleBlasterId: dto.responsibleBlasterId,
          artNumber: dto.artNumber?.trim() || null,
        },
        include: {
          customer: true,
          responsibleBlaster: true,
          items: {
            include: {
              product: true,
              productLot: { include: { magazine: true } },
            },
          },
        },
      });
      await this.audit(
        tx,
        'service-order.approved',
        id,
        {
          status: order.status,
        },
        {
          status: updated.status,
          responsibleBlasterId: updated.responsibleBlasterId,
          artNumber: updated.artNumber,
          reservedItems: updated.items.map((item) => ({
            itemId: item.id,
            productLotId: item.productLotId,
            quantity: item.plannedQuantity.toString(),
          })),
        },
      );
      return this.serializeOrder(updated);
    });
  }

  async start(id: string) {
    const summary = await this.get(id);
    if (!summary.responsibleBlasterId) {
      throw new ConflictException(
        'A OS precisa de blaster responsável antes de iniciar.',
      );
    }
    const eligibility = await this.blasters.checkEligibility(
      summary.responsibleBlasterId,
      { eventAt: summary.eventAt.toISOString() },
    );
    if (!eligibility.eligible) {
      throw new ConflictException({
        message: 'Blaster não está habilitado para iniciar esta OS.',
        reasons: eligibility.reasons,
      });
    }
    return this.transition(
      id,
      ServiceOrderStatus.APROVADO,
      ServiceOrderStatus.EM_MONTAGEM,
    );
  }

  async cancel(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({ where: { id } });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (
        order.status !== ServiceOrderStatus.ORCAMENTO &&
        order.status !== ServiceOrderStatus.APROVADO
      ) {
        throw new ConflictException(
          'Somente OS em orçamento ou aprovada podem ser canceladas.',
        );
      }
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.CANCELADO },
      });
      await this.audit(
        tx,
        'service-order.cancelled',
        id,
        { status: order.status },
        { status: updated.status, reservationsReleased: true },
      );
      return updated;
    });
  }

  async close(id: string, dto: CloseServiceOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({
        where: { id },
        include: {
          customer: true,
          items: { include: { product: true, productLot: true } },
        },
      });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (order.status !== ServiceOrderStatus.EM_MONTAGEM) {
        throw new ConflictException(
          'Somente uma OS em montagem pode receber o relatório de queima.',
        );
      }
      if (!order.contractedAmount || order.contractedAmount.lte(0)) {
        throw new ConflictException(
          'A OS não possui valor contratado. Cancele-a e crie uma nova OS com o valor informado.',
        );
      }
      if (dto.items.length !== order.items.length) {
        throw new BadRequestException(
          'O relatório deve informar a quantidade disparada de cada item da OS.',
        );
      }
      const reportByItem = new Map(
        dto.items.map((item) => [item.itemId, item]),
      );
      const itemIds = new Set(order.items.map((item) => item.id));
      if (dto.items.some((item) => !itemIds.has(item.itemId))) {
        throw new BadRequestException(
          'O relatório contém item que não pertence à OS.',
        );
      }

      const lotIds = [
        ...new Set(order.items.map((item) => item.productLotId)),
      ].sort();
      await this.lockLots(tx, lotIds);
      const totalsByLot = new Map<string, Prisma.Decimal>();
      for (const item of order.items) {
        const report = reportByItem.get(item.id)!;
        const fired = new Prisma.Decimal(report.firedQuantity);
        if (fired.gt(item.plannedQuantity)) {
          throw new ConflictException(
            'A quantidade disparada não pode exceder a quantidade reservada.',
          );
        }
        totalsByLot.set(
          item.productLotId,
          (totalsByLot.get(item.productLotId) ?? new Prisma.Decimal(0)).plus(
            fired,
          ),
        );
      }

      const lots = await tx.productLot.findMany({
        where: { id: { in: lotIds } },
        include: { product: true },
      });
      const lotById = new Map(lots.map((lot) => [lot.id, lot]));
      for (const [lotId, fired] of totalsByLot) {
        const lot = lotById.get(lotId);
        if (!lot) {
          throw new NotFoundException('Lote da OS não encontrado.');
        }
        if (lot.quantity.lt(fired)) {
          throw new ConflictException(
            `Saldo físico insuficiente para registrar a queima do lote ${lot.lotNumber}.`,
          );
        }
        if (fired.gt(0)) {
          const movement = await tx.stockMovement.create({
            data: {
              type: StockMovementType.SAIDA,
              productLotId: lot.id,
              quantity: fired,
              sourceMagazineId: lot.magazineId,
              reference: `OS-${order.code}`,
            },
          });
          await tx.productLot.update({
            where: { id: lot.id },
            data: { quantity: lot.quantity.minus(fired) },
          });
          await this.audit(
            tx,
            'service-order.material-consumed',
            id,
            undefined,
            {
              orderCode: order.code,
              productLotId: lot.id,
              quantity: fired.toString(),
              neqKg: fired.mul(lot.product.neqGrams).div(1000).toString(),
              movementId: movement.id,
            },
          );
        }
      }

      for (const item of order.items) {
        await tx.serviceOrderItem.update({
          where: { id: item.id },
          data: {
            firedQuantity: new Prisma.Decimal(
              reportByItem.get(item.id)!.firedQuantity,
            ),
          },
        });
      }
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: ServiceOrderStatus.EXECUTADO },
        include: {
          customer: true,
          responsibleBlaster: true,
          items: {
            include: {
              product: true,
              productLot: { include: { magazine: true } },
            },
          },
        },
      });
      await this.audit(
        tx,
        'service-order.executed',
        id,
        {
          status: order.status,
        },
        {
          status: updated.status,
          reportNotes: dto.reportNotes?.trim() ?? null,
          firedItems: dto.items.map((item) => ({
            itemId: item.itemId,
            quantity: item.firedQuantity,
          })),
          unusedReservationsReleased: true,
        },
      );
      const financialEntry = await tx.financialEntry.create({
        data: {
          direction: FinancialDirection.RECEBER,
          description: `Ordem de serviço ${order.code}`,
          category: 'SERVICO_PIROTECNICO',
          counterparty: order.customer.legalName,
          customerId: order.customerId,
          serviceOrderId: order.id,
          amount: order.contractedAmount,
          dueDate: this.dateOnly(dto.dueDate),
          reference: `OS-${order.code}`,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'finance.entry.created',
          aggregateType: 'FinancialEntry',
          aggregateId: financialEntry.id,
          after: {
            code: financialEntry.code,
            direction: financialEntry.direction,
            amount: financialEntry.amount.toString(),
            dueDate: dto.dueDate,
            category: financialEntry.category,
            customerId: financialEntry.customerId,
            serviceOrderId: order.id,
          },
        },
      });
      return {
        ...this.serializeOrder(updated),
        financialEntry: {
          id: financialEntry.id,
          code: financialEntry.code,
          amount: financialEntry.amount.toString(),
          dueDate: dto.dueDate,
          status: financialEntry.status,
        },
      };
    });
  }

  private async transition(
    id: string,
    expected: ServiceOrderStatus,
    next: ServiceOrderStatus,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, id);
      const order = await tx.serviceOrder.findUnique({ where: { id } });
      if (!order) {
        throw new NotFoundException('Ordem de serviço não encontrada.');
      }
      if (order.status !== expected) {
        throw new ConflictException(
          `Transição inválida: a OS precisa estar em ${expected}.`,
        );
      }
      const updated = await tx.serviceOrder.update({
        where: { id },
        data: { status: next },
      });
      await this.audit(
        tx,
        'service-order.started',
        id,
        { status: expected },
        { status: next },
      );
      return updated;
    });
  }

  private async lockOrder(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ordens_servico" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }
  }

  private async lockLots(
    tx: Prisma.TransactionClient,
    ids: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(ids)].sort();
    if (uniqueIds.length === 0) {
      return;
    }
    const conditions = uniqueIds.map((id) => Prisma.sql`"id" = ${id}::uuid`);
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT "id" FROM "produto_lotes"
        WHERE ${Prisma.join(conditions, ' OR ')}
        ORDER BY "id"
        FOR UPDATE
      `,
    );
    if (rows.length !== uniqueIds.length) {
      throw new NotFoundException('Um ou mais lotes não foram encontrados.');
    }
  }

  private assertNotExpired(expiresAt: Date): void {
    if (
      expiresAt.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    ) {
      throw new ConflictException(
        'Lote vencido não pode ser reservado para uma OS.',
      );
    }
  }

  private assertMagazineCanStore(magazine: {
    active: boolean;
    fireLicenseExpiresAt: Date;
  }): void {
    if (!magazine.active) {
      throw new ConflictException(
        'O paiol do lote está inativo e não pode ser reservado para OS.',
      );
    }
    if (
      magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    ) {
      throw new ConflictException(
        'O paiol do lote está com a licença dos Bombeiros vencida.',
      );
    }
  }

  private dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: string,
    aggregateId: string,
    before: Prisma.InputJsonValue | undefined,
    after: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        action,
        aggregateType: 'ServiceOrder',
        aggregateId,
        ...(before ? { before } : {}),
        after,
      },
    });
  }

  private serializeOrder<
    T extends {
      id: string;
      code: number;
      status: ServiceOrderStatus;
      items: Array<{
        id: string;
        plannedQuantity: Prisma.Decimal;
        firedQuantity: Prisma.Decimal | null;
        product: {
          neqGrams: Prisma.Decimal;
          isPce: boolean;
          riskClass: string | null;
        };
      }>;
    },
  >(order: T) {
    const reservedNeqKg = order.items
      .reduce(
        (total, item) =>
          total.plus(item.plannedQuantity.mul(item.product.neqGrams).div(1000)),
        new Prisma.Decimal(0),
      )
      .toString();
    return {
      ...order,
      reservationActive: RESERVED_STATUSES.includes(order.status),
      reservedNeqKg,
      items: order.items.map((item) => ({
        ...item,
        neqKg: item.plannedQuantity
          .mul(item.product.neqGrams)
          .div(1000)
          .toString(),
      })),
    };
  }
}
