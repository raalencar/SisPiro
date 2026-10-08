import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Customer } from '@prisma/client';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  isValidCnpj,
  isValidCpf,
  normalizeBrazilianTaxId,
} from '../../common/brazilian-tax-id.js';
import {
  CheckPceEligibilityDto,
  CreateCustomerDto,
  CustomersQueryDto,
  UpdateCustomerDto,
} from './customers.dto.js';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CustomersQueryDto) {
    const where: Prisma.CustomerWhereInput = {
      ...(query.active !== undefined
        ? { active: query.active === 'true' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { taxId: { contains: normalizeBrazilianTaxId(query.search) } },
              { crNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { legalName: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return this.paginated(data, total, query);
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    const taxId = normalizeBrazilianTaxId(dto.taxId);
    this.assertValidTaxId(taxId);
    this.assertCrData(
      dto.hasCr,
      dto.crNumber,
      dto.crExpiresAt,
      dto.authorizedPceClasses ?? [],
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            legalName: dto.legalName.trim(),
            taxId,
            hasCr: dto.hasCr,
            crNumber: dto.hasCr ? dto.crNumber?.trim() : null,
            crExpiresAt:
              dto.hasCr && dto.crExpiresAt
                ? this.dateOnly(dto.crExpiresAt)
                : null,
            authorizedPceClasses: dto.hasCr
              ? (dto.authorizedPceClasses ?? [])
              : [],
          },
        });
        await this.audit(
          tx,
          'customer.created',
          customer.id,
          undefined,
          customer,
        );
        return customer;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateCustomerDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.customer.findUnique({ where: { id } });
        if (!before) {
          throw new NotFoundException('Cliente não encontrado.');
        }
        const next = {
          hasCr: dto.hasCr ?? before.hasCr,
          crNumber:
            dto.hasCr === false ? null : (dto.crNumber ?? before.crNumber),
          crExpiresAt:
            dto.hasCr === false
              ? null
              : dto.crExpiresAt === undefined
                ? before.crExpiresAt
                : dto.crExpiresAt === null
                  ? null
                  : this.dateOnly(dto.crExpiresAt),
          authorizedPceClasses:
            dto.hasCr === false
              ? []
              : (dto.authorizedPceClasses ?? before.authorizedPceClasses),
        };
        this.assertCrData(
          next.hasCr,
          next.crNumber ?? undefined,
          next.crExpiresAt?.toISOString().slice(0, 10),
          next.authorizedPceClasses,
        );

        const customer = await tx.customer.update({
          where: { id },
          data: {
            ...(dto.legalName !== undefined
              ? { legalName: dto.legalName.trim() }
              : {}),
            ...next,
            ...(dto.active !== undefined ? { active: dto.active } : {}),
          },
        });
        await this.audit(tx, 'customer.updated', customer.id, before, customer);
        return customer;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async checkPceEligibility(id: string, dto: CheckPceEligibilityDto) {
    const customer = await this.get(id);
    const today = new Date().toISOString().slice(0, 10);
    const crExpiry = customer.crExpiresAt?.toISOString().slice(0, 10);
    const reasons: string[] = [];
    const unauthorizedClasses = dto.classes.filter(
      (item) => !customer.authorizedPceClasses.includes(item),
    );

    if (!customer.active) {
      reasons.push('O cadastro do cliente está inativo.');
    }
    if (!customer.hasCr) {
      reasons.push('O cliente não possui Certificado de Registro informado.');
    } else if (!crExpiry || crExpiry < today) {
      reasons.push('O Certificado de Registro está vencido ou sem validade.');
    }
    if (customer.hasCr && unauthorizedClasses.length > 0) {
      reasons.push(
        `O CR não informa autorização para: ${unauthorizedClasses.join(', ')}.`,
      );
    }

    return {
      customerId: customer.id,
      eligible: reasons.length === 0,
      checkedClasses: dto.classes,
      unauthorizedClasses,
      reasons,
      checkedAt: new Date().toISOString(),
      disclaimer:
        'Validação baseada somente nos dados cadastrados; não consulta sistemas oficiais nem substitui conferência documental.',
    };
  }

  private assertValidTaxId(taxId: string): void {
    if (!(isValidCpf(taxId) || isValidCnpj(taxId))) {
      throw new BadRequestException('CPF ou CNPJ inválido.');
    }
  }

  private assertCrData(
    hasCr: boolean,
    crNumber: string | undefined,
    crExpiresAt: string | undefined,
    classes: string[],
  ): void {
    if (hasCr && (!crNumber?.trim() || !crExpiresAt)) {
      throw new BadRequestException(
        'CR informado exige número e data de validade.',
      );
    }
    if (!hasCr && (crNumber || crExpiresAt || classes.length > 0)) {
      throw new BadRequestException(
        'Número, validade e classes autorizadas só podem ser informados para cliente com CR.',
      );
    }
    if (classes.some((item) => item.length === 0)) {
      throw new BadRequestException(
        'As classes PCE autorizadas não podem estar vazias.',
      );
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

  private async audit(
    tx: Prisma.TransactionClient,
    action: string,
    aggregateId: string,
    before: Customer | undefined,
    after: Customer,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        action,
        aggregateType: 'Customer',
        aggregateId,
        ...(before
          ? {
              before: {
                legalName: before.legalName,
                hasCr: before.hasCr,
                crExpiresAt: before.crExpiresAt?.toISOString() ?? null,
                authorizedPceClasses: before.authorizedPceClasses,
                active: before.active,
              },
            }
          : {}),
        after: {
          legalName: after.legalName,
          hasCr: after.hasCr,
          crExpiresAt: after.crExpiresAt?.toISOString() ?? null,
          authorizedPceClasses: after.authorizedPceClasses,
          active: after.active,
        },
      },
    });
  }
}
