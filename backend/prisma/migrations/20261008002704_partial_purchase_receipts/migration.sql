-- AlterEnum
ALTER TYPE "PurchaseStatus" ADD VALUE 'PARCIAL';

-- DropIndex
DROP INDEX "recebimentos_compra_item_compra_id_key";

-- CreateIndex
CREATE INDEX "recebimentos_compra_item_compra_id_idx" ON "recebimentos_compra"("item_compra_id");
