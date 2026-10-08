import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Blaster } from '@prisma/client';
import { isValidCpf } from '../../common/brazilian-tax-id.js';
import { createAuditLog } from '../../common/audit-log.js';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  BlastersQueryDto,
  CreateBlasterDto,
  UpdateBlasterDto,
  CheckBlasterEligibilityDto,
} from './blasters.dto.js';

@Injectable()
export class BlastersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: BlastersQueryDto) {
    const where: Prisma.BlasterWhereInput = {
      ...(query.active !== undefined
        ? { active: query.active === 'true' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { taxId: { contains: query.search.replace(/[.-]/g, '') } },
              {
                licenseNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.blaster.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.blaster.count({ where }),
    ]);
    return {
      data: data.map((blaster) => ({
        ...blaster,
        licenseStatus: this.licenseStatus(
          blaster.licenseExpiresAt,
          blaster.active,
        ),
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(id: string) {
    const blaster = await this.prisma.blaster.findUnique({ where: { id } });
    if (!blaster) {
      throw new NotFoundException('Blaster não encontrado.');
    }
    return {
      ...blaster,
      licenseStatus: this.licenseStatus(
        blaster.licenseExpiresAt,
        blaster.active,
      ),
    };
  }

  async create(dto: CreateBlasterDto) {
    if (!isValidCpf(dto.taxId)) {
      throw new BadRequestException('CPF inválido.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const blaster = await tx.blaster.create({
          data: {
            name: dto.name.trim(),
            taxId: dto.taxId,
            licenseNumber: dto.licenseNumber.trim(),
            licenseExpiresAt: this.dateOnly(dto.licenseExpiresAt),
            category: dto.category?.trim() || null,
          },
        });
        await this.audit(tx, 'blaster.created', blaster.id, undefined, blaster);
        return {
          ...blaster,
          licenseStatus: this.licenseStatus(
            blaster.licenseExpiresAt,
            blaster.active,
          ),
        };
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateBlasterDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.blaster.findUnique({ where: { id } });
        if (!before) {
          throw new NotFoundException('Blaster não encontrado.');
        }
        const blaster = await tx.blaster.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.licenseNumber !== undefined
              ? { licenseNumber: dto.licenseNumber.trim() }
              : {}),
            ...(dto.licenseExpiresAt !== undefined
              ? { licenseExpiresAt: this.dateOnly(dto.licenseExpiresAt) }
              : {}),
            ...(dto.category !== undefined
              ? { category: dto.category?.trim() || null }
              : {}),
            ...(dto.active !== undefined ? { active: dto.active } : {}),
          },
        });
        await this.audit(tx, 'blaster.updated', blaster.id, before, blaster);
        return {
          ...blaster,
          licenseStatus: this.licenseStatus(
            blaster.licenseExpiresAt,
            blaster.active,
          ),
        };
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async checkEligibility(id: string, dto: CheckBlasterEligibilityDto) {
    const blaster = await this.get(id);
    const eventDay = dto.eventAt.slice(0, 10);
    const licenseExpiry = blaster.licenseExpiresAt.toISOString().slice(0, 10);
    const reasons: string[] = [];

    if (!blaster.active) {
      reasons.push('O cadastro do blaster está inativo.');
    }
    if (licenseExpiry < eventDay) {
      reasons.push('A habilitação estará vencida na data do evento.');
    }

    return {
      blasterId: blaster.id,
      eligible: reasons.length === 0,
      eventAt: dto.eventAt,
      licenseExpiresAt: licenseExpiry,
      reasons,
      checkedAt: new Date().toISOString(),
      disclaimer:
        'Validação baseada somente nos dados cadastrados; não consulta sistemas oficiais nem substitui conferência documental.',
    };
  }

  private licenseStatus(expiresAt: Date, active: boolean) {
    const today = new Date().toISOString().slice(0, 10);
    const expiry = expiresAt.toISOString().slice(0, 10);
    return {
      active,
      valid: active && expiry >= today,
      expiresAt: expiry,
    };
  }

  private dateOnly(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: string,
    aggregateId: string,
    before: Blaster | undefined,
    after: Blaster,
  ): Promise<void> {
    await createAuditLog(tx, {
      data: {
        action,
        aggregateType: 'Blaster',
        aggregateId,
        ...(before
          ? {
              before: {
                name: before.name,
                licenseNumber: before.licenseNumber,
                licenseExpiresAt: before.licenseExpiresAt.toISOString(),
                category: before.category,
                active: before.active,
              },
            }
          : {}),
        after: {
          name: after.name,
          licenseNumber: after.licenseNumber,
          licenseExpiresAt: after.licenseExpiresAt.toISOString(),
          category: after.category,
          active: after.active,
        },
      },
    });
  }
}
