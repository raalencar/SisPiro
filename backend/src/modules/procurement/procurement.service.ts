import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductType,
  PurchaseStatus,
  StockMovementType,
} from '@prisma/client';
import {
  isValidCnpj,
  isValidCpf,
} from '../../common/brazilian-tax-id.js';
import { normalizeBrazilianTaxId } from '../../common/brazilian-tax-id.js';
import { rethrowKnownPrismaError } from '../../common/prisma-errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  CreatePurchaseDto,
  CreateSupplierDto,
  PurchasesQueryDto,
  ReceivePurchaseDto,
  SuppliersQueryDto,
  UpdateSupplierDto,
} from './procurement.dto.js';

@Injectable()
export class ProcurementService {
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
    return this.paginated(data, total, query);
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
        await tx.auditLog.create({
          data: {
            action: 'supplier.updated',
            aggregateType: 'Supplier',
            aggregateId: id,
            before: {
              legalName: before.legalName,
              hasCr: before.hasCr,
              crExpiresAt: before.crExpiresAt?.toISOString() ?? null,
              authorizedPceClasses: before.authorizedPceClasses,
              active: before.active,
            },
            after: {
              legalName: supplier.legalName,
              hasCr: supplier.hasCr,
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
    this.assertCrData(
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
                ? this.dateOnly(dto.crExpiresAt)
                : null,
            authorizedPceClasses: dto.hasCr
              ? (dto.authorizedPceClasses ?? [])
              : [],
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'supplier.created',
            aggregateType: 'Supplier',
            aggregateId: supplier.id,
            after: {
              legalName: supplier.legalName,
              taxId: supplier.taxId,
              hasCr: supplier.hasCr,
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

  async listPurchases(query: PurchasesQueryDto) {
    const where: Prisma.PurchaseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                supplier: {
                  legalName: { contains: query.search, mode: 'insensitive' },
                },
              },
              { reference: { contains: query.search, mode: 'insensitive' } },
              ...(Number.isSafeInteger(Number(query.search))
                ? [{ code: Number(query.search) }]
                : []),
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: {
          supplier: true,
          items: { include: { product: true, receipts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return this.paginated(data, total, query);
  }

  async getPurchase(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
            receipts: { include: { productLot: true, magazine: true } },
          },
        },
      },
    });
    if (!purchase) {
      throw new NotFoundException('Compra não encontrada.');
    }
    return purchase;
  }

  async createPurchase(dto: CreatePurchaseDto) {
    const productIds = dto.items.map((item) => item.productId);
    const [supplier, products] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.product.findMany({
        where: { id: { in: productIds } },
      }),
    ]);
    if (!supplier) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }
    if (!supplier.active) {
      throw new ConflictException(
        'Fornecedor inativo não pode receber novas compras.',
      );
    }
    if (products.length !== productIds.length) {
      throw new NotFoundException('Um ou mais produtos não foram encontrados.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            supplierId: dto.supplierId,
            reference: dto.reference?.trim() || null,
            items: {
              create: dto.items.map((item) => ({
                productId: item.productId,
                orderedQuantity: new Prisma.Decimal(item.orderedQuantity),
                unitCost: new Prisma.Decimal(item.unitCost),
              })),
            },
          },
          include: {
            supplier: true,
            items: { include: { product: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'procurement.purchase.created',
            aggregateType: 'Purchase',
            aggregateId: purchase.id,
            after: {
              code: purchase.code,
              supplierId: purchase.supplierId,
              reference: purchase.reference,
              itemCount: purchase.items.length,
              status: purchase.status,
            },
          },
        });
        return purchase;
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async receivePurchase(id: string, dto: ReceivePurchaseDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
      const purchaseRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "compras" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!purchaseRows.length) {
        throw new NotFoundException('Compra não encontrada.');
      }
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: {
          supplier: true,
          items: { include: { product: true, receipts: true } },
        },
      });
      if (!purchase) {
        throw new NotFoundException('Compra não encontrada.');
      }
      if (
        purchase.status !== PurchaseStatus.PENDENTE &&
        purchase.status !== PurchaseStatus.PARCIAL
      ) {
        throw new ConflictException(
          'Somente compras pendentes ou parcialmente recebidas podem receber novos lotes.',
        );
      }
      const itemsById = new Map(purchase.items.map((item) => [item.id, item]));
      const receivedQuantityByItem = new Map(
        purchase.items.map((item) => [
          item.id,
          item.receipts.reduce(
            (total, previous) => total.plus(previous.quantity),
            new Prisma.Decimal(0),
          ),
        ]),
      );
      for (const receipt of dto.items) {
        const item = itemsById.get(receipt.purchaseItemId);
        if (!item) {
          throw new BadRequestException(
            'O recebimento contém item que não pertence à compra.',
          );
        }
        const alreadyReceived = receivedQuantityByItem.get(item.id)!;
        const remaining = item.orderedQuantity.minus(alreadyReceived);
        if (new Prisma.Decimal(receipt.quantity).gt(remaining)) {
          throw new ConflictException({
            message: 'A quantidade recebida excede o saldo ainda não recebido.',
            purchaseItemId: item.id,
            orderedQuantity: item.orderedQuantity.toString(),
            alreadyReceived: alreadyReceived.toString(),
            requested: String(receipt.quantity),
            remaining: remaining.toString(),
          });
        }
        receivedQuantityByItem.set(
          item.id,
          alreadyReceived.plus(new Prisma.Decimal(receipt.quantity)),
        );
        if (item.product.type === ProductType.SERVICO) {
          throw new BadRequestException(
            'Produtos do tipo serviço não podem ser recebidos como estoque.',
          );
        }
        if (receipt.expiresAt < receipt.manufacturedAt) {
          throw new BadRequestException(
            'A validade do lote não pode anteceder a fabricação.',
          );
        }
        if (item.product.isPce) {
          this.assertSupplierPceEligible(
            purchase.supplier,
            item.product.riskClass,
          );
        }
      }

      const magazineIds = [...new Set(dto.items.map((item) => item.magazineId))].sort();
      for (const magazineId of magazineIds) {
        await this.lockMagazine(tx, magazineId);
      }
      const magazines = await tx.magazine.findMany({
        where: { id: { in: magazineIds } },
      });
      const magazineById = new Map(magazines.map((magazine) => [magazine.id, magazine]));
      const neqByMagazine = new Map<string, Prisma.Decimal>();
      for (const receipt of dto.items) {
        const item = itemsById.get(receipt.purchaseItemId)!;
        const magazine = magazineById.get(receipt.magazineId);
        this.assertMagazineCanReceive(magazine);
        const neqKg = new Prisma.Decimal(receipt.quantity)
          .mul(item.product.neqGrams)
          .div(1000);
        neqByMagazine.set(
          receipt.magazineId,
          (neqByMagazine.get(receipt.magazineId) ?? new Prisma.Decimal(0)).plus(
            neqKg,
          ),
        );
      }
      for (const [magazineId, increase] of neqByMagazine) {
        await this.assertCapacity(tx, magazineId, increase);
      }

      const receiptBatch = await tx.purchaseReceiptBatch.create({
        data: {
          purchaseId: purchase.id,
          invoiceReference: dto.invoiceReference,
          dueDate: this.dateOnly(dto.dueDate),
        },
      });
      const payableAmount = dto.items.reduce((total, receipt) => {
        const item = itemsById.get(receipt.purchaseItemId)!;
        return total.plus(
          item.unitCost.mul(new Prisma.Decimal(receipt.quantity)),
        );
      }, new Prisma.Decimal(0));
      const payable = await tx.financialEntry.create({
        data: {
          direction: 'PAGAR',
          description: `Recebimento da compra ${purchase.code}`,
          category: 'Compras',
          counterparty: purchase.supplier.legalName,
          supplierId: purchase.supplierId,
          receiptBatchId: receiptBatch.id,
          amount: payableAmount,
          dueDate: this.dateOnly(dto.dueDate),
          reference: dto.invoiceReference,
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'finance.entry.created',
          aggregateType: 'FinancialEntry',
          aggregateId: payable.id,
          after: {
            code: payable.code,
            direction: payable.direction,
            amount: payable.amount.toString(),
            dueDate: dto.dueDate,
            category: payable.category,
            supplierId: payable.supplierId,
            purchaseId: purchase.id,
            receiptBatchId: receiptBatch.id,
            reference: payable.reference,
          },
        },
      });

      const receivedLots = [];
      for (const receipt of dto.items) {
        const item = itemsById.get(receipt.purchaseItemId)!;
        const quantity = new Prisma.Decimal(receipt.quantity);
        const neqKg = quantity.mul(item.product.neqGrams).div(1000);
        const lot = await tx.productLot.create({
          data: {
            productId: item.productId,
            magazineId: receipt.magazineId,
            lotNumber: receipt.lotNumber.trim(),
            quantity,
            manufacturedAt: this.dateOnly(receipt.manufacturedAt),
            expiresAt: this.dateOnly(receipt.expiresAt),
            manufacturerOrImporter: receipt.manufacturerOrImporter.trim(),
          },
          include: { product: true, magazine: true },
        });
        const movement = await tx.stockMovement.create({
          data: {
            type: StockMovementType.ENTRADA,
            productLotId: lot.id,
            quantity,
            destinationMagazineId: lot.magazineId,
            reference: `COMPRA-${purchase.code}`,
          },
        });
        const receiptRecord = await tx.purchaseReceipt.create({
          data: {
            purchaseItemId: item.id,
            receiptBatchId: receiptBatch.id,
            productLotId: lot.id,
            magazineId: receipt.magazineId,
            lotNumber: receipt.lotNumber.trim(),
            manufacturedAt: this.dateOnly(receipt.manufacturedAt),
            expiresAt: this.dateOnly(receipt.expiresAt),
            manufacturerOrImporter: receipt.manufacturerOrImporter.trim(),
            quantity,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'inventory.lot.received',
            aggregateType: 'ProductLot',
            aggregateId: lot.id,
            after: {
              purchaseId: purchase.id,
              purchaseCode: purchase.code,
              purchaseItemId: item.id,
              lotNumber: lot.lotNumber,
              productId: lot.productId,
              magazineId: lot.magazineId,
              quantity: lot.quantity.toString(),
              neqKg: neqKg.toString(),
              movementId: movement.id,
              receiptId: receiptRecord.id,
            },
          },
        });
        receivedLots.push({ lot, receipt: receiptRecord, movement });
      }
      const allItemsReceived = purchase.items.every((item) =>
        receivedQuantityByItem.get(item.id)!.eq(item.orderedQuantity),
      );
      const nextStatus = allItemsReceived
        ? PurchaseStatus.RECEBIDO
        : PurchaseStatus.PARCIAL;
      const finalized = await tx.purchase.update({
        where: { id },
        data: {
          status: nextStatus,
          receivedAt: allItemsReceived ? new Date() : null,
        },
        include: {
          supplier: true,
          items: { include: { product: true, receipts: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          action: 'procurement.purchase.received',
          aggregateType: 'Purchase',
          aggregateId: purchase.id,
          before: { status: purchase.status },
          after: {
            status: finalized.status,
            receivedAt: finalized.receivedAt?.toISOString() ?? null,
            receiptBatchId: receiptBatch.id,
            financialEntryId: payable.id,
            lotIds: receivedLots.map(({ lot }) => lot.id),
          },
        },
      });
      return { ...finalized, receiptBatch, financialEntry: payable, receivedLots };
      });
    } catch (error) {
      rethrowKnownPrismaError(error);
    }
  }

  async cancelPurchase(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "compras" WHERE "id" = ${id}::uuid FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException('Compra não encontrada.');
      }
      const purchase = await tx.purchase.findUnique({ where: { id } });
      if (!purchase) {
        throw new NotFoundException('Compra não encontrada.');
      }
      if (purchase.status !== PurchaseStatus.PENDENTE) {
        throw new ConflictException(
          'Somente compras pendentes podem ser canceladas.',
        );
      }
      const cancelled = await tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELADO },
      });
      await tx.auditLog.create({
        data: {
          action: 'procurement.purchase.cancelled',
          aggregateType: 'Purchase',
          aggregateId: id,
          before: { status: purchase.status },
          after: { status: cancelled.status },
        },
      });
      return cancelled;
    });
  }

  private assertSupplierPceEligible(
    supplier: {
      legalName: string;
      active: boolean;
      hasCr: boolean;
      crExpiresAt: Date | null;
      authorizedPceClasses: string[];
    },
    riskClass: string | null,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const expiry = supplier.crExpiresAt?.toISOString().slice(0, 10);
    if (
      !supplier.active ||
      !supplier.hasCr ||
      !expiry ||
      expiry < today ||
      !riskClass ||
      !supplier.authorizedPceClasses.includes(riskClass)
    ) {
      throw new ConflictException({
        message: `Fornecedor não está habilitado para fornecer o PCE ${riskClass ?? '(sem classe)'}.`,
        supplier: supplier.legalName,
      });
    }
  }

  private assertCrData(
    hasCr: boolean,
    crNumber: string | undefined,
    crExpiresAt: string | undefined,
    classes: string[],
  ) {
    if (hasCr && (!crNumber?.trim() || !crExpiresAt)) {
      throw new BadRequestException(
        'CR informado exige número e data de validade.',
      );
    }
    if (!hasCr && (crNumber || crExpiresAt || classes.length > 0)) {
      throw new BadRequestException(
        'Número, validade e classes PCE só podem ser informados para fornecedor com CR.',
      );
    }
    if (classes.some((item) => item.length === 0)) {
      throw new BadRequestException(
        'As classes PCE autorizadas não podem estar vazias.',
      );
    }
  }

  private async lockMagazine(
    tx: Prisma.TransactionClient,
    magazineId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "paioes" WHERE "id" = ${magazineId}::uuid FOR UPDATE
    `;
    if (!rows.length) {
      throw new NotFoundException('Paiol não encontrado.');
    }
  }

  private assertMagazineCanReceive(
    magazine: { active: boolean; fireLicenseExpiresAt: Date } | undefined,
  ) {
    if (!magazine) {
      throw new NotFoundException('Paiol não encontrado.');
    }
    if (!magazine.active) {
      throw new ConflictException(
        'Paiol inativo não pode receber estoque.',
      );
    }
    if (
      magazine.fireLicenseExpiresAt.toISOString().slice(0, 10) <
      new Date().toISOString().slice(0, 10)
    ) {
      throw new ConflictException(
        'Paiol com licença dos Bombeiros vencida não pode receber estoque.',
      );
    }
  }

  private async assertCapacity(
    tx: Prisma.TransactionClient,
    magazineId: string,
    increase: Prisma.Decimal,
  ) {
    const magazine = await tx.magazine.findUnique({
      where: { id: magazineId },
    });
    if (!magazine) {
      throw new NotFoundException('Paiol não encontrado.');
    }
    const [row] = await tx.$queryRaw<Array<{ neqKg: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(l."quantidade" * p."massa_neq_gramas" / 1000), 0) AS "neqKg"
      FROM "produto_lotes" l
      JOIN "produtos" p ON p."id" = l."produto_id"
      WHERE l."paiol_id" = ${magazineId}::uuid
    `;
    const projected = (row?.neqKg ?? new Prisma.Decimal(0)).plus(increase);
    if (projected.gt(magazine.maxNeqCapacityKg)) {
      throw new ConflictException({
        message: 'Recebimento bloqueado: capacidade NEQ do paiol excedida.',
        magazineId,
        capacityKg: magazine.maxNeqCapacityKg.toString(),
        currentNeqKg: (row?.neqKg ?? new Prisma.Decimal(0)).toString(),
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
