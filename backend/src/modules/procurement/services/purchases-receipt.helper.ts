import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductType,
  PurchaseStatus,
  StockMovementType,
} from '@prisma/client';
import { createAuditLog } from '../../../common/audit-log.js';
import { ReceivePurchaseDto } from '../procurement.dto.js';
import {
  assertMagazineCanReceive,
  assertMagazineCapacity,
  assertSupplierPceEligible,
  dateOnly,
  lockMagazine,
} from './procurement.common.js';

export async function receivePurchaseInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  dto: ReceivePurchaseDto,
) {
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
  const itemsById = new Map(
    purchase.items.map((item) => [item.id, item]),
  );
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
        message:
          'A quantidade recebida excede o saldo ainda não recebido.',
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
      assertSupplierPceEligible(
        purchase.supplier,
        item.product.riskClass,
      );
    }
  }

  const magazineIds = [
    ...new Set(dto.items.map((item) => item.magazineId)),
  ].sort();
  for (const magazineId of magazineIds) {
    await lockMagazine(tx, magazineId);
  }
  const magazines = await tx.magazine.findMany({
    where: { id: { in: magazineIds } },
  });
  const magazineById = new Map(
    magazines.map((magazine) => [magazine.id, magazine]),
  );
  const neqByMagazine = new Map<string, Prisma.Decimal>();
  for (const receipt of dto.items) {
    const item = itemsById.get(receipt.purchaseItemId)!;
    const magazine = magazineById.get(receipt.magazineId);
    assertMagazineCanReceive(magazine);
    const neqKg = new Prisma.Decimal(receipt.quantity)
      .mul(item.product.neqGrams)
      .div(1000);
    neqByMagazine.set(
      receipt.magazineId,
      (
        neqByMagazine.get(receipt.magazineId) ?? new Prisma.Decimal(0)
      ).plus(neqKg),
    );
  }
  for (const [magazineId, increase] of neqByMagazine) {
    await assertMagazineCapacity(tx, magazineId, increase);
  }

  const receiptBatch = await tx.purchaseReceiptBatch.create({
    data: {
      purchaseId: purchase.id,
      invoiceReference: dto.invoiceReference,
      dueDate: dateOnly(dto.dueDate),
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
      dueDate: dateOnly(dto.dueDate),
      reference: dto.invoiceReference,
    },
  });
  await createAuditLog(tx, {
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
        manufacturedAt: dateOnly(receipt.manufacturedAt),
        expiresAt: dateOnly(receipt.expiresAt),
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
        manufacturedAt: dateOnly(receipt.manufacturedAt),
        expiresAt: dateOnly(receipt.expiresAt),
        manufacturerOrImporter: receipt.manufacturerOrImporter.trim(),
        quantity,
      },
    });
    await createAuditLog(tx, {
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
  await createAuditLog(tx, {
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
  return {
    ...finalized,
    receiptBatch,
    financialEntry: payable,
    receivedLots,
  };
}
