import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import {
  isValidCnpj,
  isValidCpf,
  normalizeBrazilianTaxId,
} from '../../../common/brazilian-tax-id.js';
import { rethrowKnownPrismaError } from '../../../common/prisma-errors.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  CreateSupplierDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
} from '../procurement.dto.js';
import {
  assertCrData,
  dateOnly,
  paginatedResult,
} from './procurement.common.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSuppliers(query: SuppliersQueryDto) {
    const where: Prisma.SupplierWhereInput = {
      ...(query.active !== undefined ? { active: query.active } : {}),
      ...(query.search
        ? {
            OR: [
              {
                legalName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { taxId: { contains: normalizeBrazilianTaxId(query.search) } },
              { crNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { legalName: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginatedResult(data, total, query);
  }

  async getSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchases: true } } },
    });
    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }
    return supplier;
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.supplier.findUnique({ where: { id } });
        if (!before) {
          throw new NotFoundException('Fornecedor não encontrado.');
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
                : dateOnly(dto.crExpiresAt),
          authorizedPceClasses:
            dto.hasCr === false
              ? []
              : (dto.authorizedPceClasses ?? before.authorizedPceClasses),
        };
        assertCrData(
          next.hasCr,
          next.crNumber ?? undefined,
          next.crExpiresAt?.toISOString().slice(0, 10),
          next.authorizedPceClasses,
        );
        const supplier = await tx.supplier.update({
          where: { id },
          data: {
            ...(dto.legalName !== undefined
              ? { legalName: dto.legalName.trim() }
              : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
            ...next,
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'supplier.updated',
            aggregateType: 'Supplier',
            aggregateId: id,
            before: {
              legalName: before.legalName,
              hasCr: before.hasCr,
              crNumber: before.crNumber,
              crExpiresAt: before.crExpiresAt?.toISOString() ?? null,
              authorizedPceClasses: before.authorizedPceClasses,
              active: before.active,
            },
            after: {
              legalName: supplier.legalName,
              hasCr: supplier.hasCr,
              crNumber: supplier.crNumber,
              crExpiresAt: supplier.crExpiresAt?.toISOString() ?? null,
              authorizedPceClasses: supplier.authorizedPceClasses,
              active: supplier.active,
            },
          },
        });
        return supplier;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async createSupplier(dto: CreateSupplierDto) {
    const taxId = normalizeBrazilianTaxId(dto.taxId);
    if (!(isValidCpf(taxId) || isValidCnpj(taxId))) {
      throw new BadRequestException('CPF ou CNPJ do fornecedor inválido.');
    }
    assertCrData(
      dto.hasCr,
      dto.crNumber,
      dto.crExpiresAt,
      dto.authorizedPceClasses ?? [],
    );
    try {
      return await this.prisma.$transaction(async (tx) => {
        const supplier = await tx.supplier.create({
          data: {
            legalName: dto.legalName.trim(),
            taxId,
            hasCr: dto.hasCr,
            crNumber: dto.hasCr ? dto.crNumber?.trim() : null,
            crExpiresAt:
              dto.hasCr && dto.crExpiresAt
                ? dateOnly(dto.crExpiresAt)
                : null,
            authorizedPceClasses: dto.hasCr
              ? (dto.authorizedPceClasses ?? [])
              : [],
          },
        });
        await createAuditLog(tx, {
          data: {
            action: 'supplier.created',
            aggregateType: 'Supplier',
            aggregateId: supplier.id,
            after: {
              legalName: supplier.legalName,
              taxId: supplier.taxId,
              hasCr: supplier.hasCr,
              crNumber: supplier.crNumber,
              crExpiresAt: supplier.crExpiresAt?.toISOString() ?? null,
              authorizedPceClasses: supplier.authorizedPceClasses,
            },
          },
        });
        return supplier;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }
}
