import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  ServiceOrdersQueryDto,
  ServiceOrdersReportQueryDto,
} from '../service-orders.dto.js';
import { serializeServiceOrder } from './service-orders.common.js';

@Injectable()
export class ServiceOrdersQueryService {
  constructor(private readonly prisma: PrismaService) {}

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
      data: data.map((order) => serializeServiceOrder(order)),
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
    return serializeServiceOrder(order);
  }
}
