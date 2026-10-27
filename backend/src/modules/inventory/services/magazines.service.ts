import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  currentNeqKg,
  lockMagazines,
  paginatedResult,
  Pagination,
  parseDateOnly,
} from '../inventory.common.js';
import {
  CreateMagazineDto,
  UpdateMagazineStatusDto,
} from '../inventory.dto.js';
import { rethrowInventoryError } from '../inventory.errors.js';

@Injectable()
export class MagazinesService {
  constructor(private readonly prisma: PrismaService) {}

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
      const magazineNeqKg =
        neqByMagazine.get(magazine.id) ?? new Prisma.Decimal(0);
      return {
        ...magazine,
        currentNeqKg: magazineNeqKg.toString(),
        remainingNeqKg: magazine.maxNeqCapacityKg
          .minus(magazineNeqKg)
          .toString(),
      };
    });

    return paginatedResult(data, total, query);
  }

  async getMagazine(id: string) {
    const magazine = await this.prisma.magazine.findUnique({ where: { id } });
    if (!magazine) {
      throw new NotFoundException('Paiol não encontrado.');
    }
    const magazineNeqKg = await currentNeqKg(this.prisma, id);
    return {
      ...magazine,
      currentNeqKg: magazineNeqKg.toString(),
      remainingNeqKg: magazine.maxNeqCapacityKg.minus(magazineNeqKg).toString(),
    };
  }

  async createMagazine(dto: CreateMagazineDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const magazine = await tx.magazine.create({
          data: {
            name: dto.name.trim(),
            maxNeqCapacityKg: new Prisma.Decimal(dto.maxNeqCapacityKg),
            fireLicenseExpiresAt: parseDateOnly(dto.fireLicenseExpiresAt),
          },
        });
        await createAuditLog(tx, {
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

  async updateMagazineStatus(id: string, dto: UpdateMagazineStatusDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockMagazines(tx, [id]);
        const magazine = await tx.magazine.findUnique({
          where: { id },
        });
        if (!magazine) {
          throw new NotFoundException('Paiol não encontrado.');
        }

        if (dto.active === false && magazine.active === true) {
          const [stockRow] = await tx.$queryRaw<
            Array<{ totalQty: string | number | null }>
          >`
            SELECT COALESCE(SUM("quantidade"), 0) AS "totalQty"
            FROM "produto_lotes"
            WHERE "paiol_id" = ${id}::uuid
          `;
          const currentTotalQuantity = new Prisma.Decimal(
            stockRow?.totalQty ?? 0,
          );
          if (currentTotalQuantity.gt(0)) {
            throw new ConflictException(
              'O paiol possui saldo de estoque ativo e não pode ser inativado. Transfira ou baixe todos os lotes antes de inativar.',
            );
          }
        }

        if (dto.active === true && magazine.active === false) {
          if (
            magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
            new Date().toISOString().slice(0, 10)
          ) {
            throw new ConflictException(
              'Paiol com licença dos Bombeiros vencida não pode ser reativado.',
            );
          }
        }

        const updated = await tx.magazine.update({
          where: { id },
          data: { active: dto.active },
        });

        await createAuditLog(tx, {
          data: {
            action: 'inventory.magazine.status-updated',
            aggregateType: 'Magazine',
            aggregateId: id,
            before: { active: magazine.active },
            after: { active: updated.active },
          },
        });

        const updatedNeqKg = await currentNeqKg(tx, id);
        return {
          ...updated,
          currentNeqKg: updatedNeqKg.toString(),
          remainingNeqKg: updated.maxNeqCapacityKg
            .minus(updatedNeqKg)
            .toString(),
        };
      });
    } catch (error) {
      rethrowInventoryError(error);
    }
  }
}
