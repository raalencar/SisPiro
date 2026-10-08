-- CreateEnum
CREATE TYPE "ProductLotStatus" AS ENUM ('DISPONIVEL', 'QUARENTENA', 'BLOQUEADO');

-- AlterTable
ALTER TABLE "produto_lotes"
ADD COLUMN "status" "ProductLotStatus" NOT NULL DEFAULT 'DISPONIVEL',
ADD COLUMN "motivo_status" VARCHAR(255);

-- CreateIndex
CREATE INDEX "produto_lotes_status_idx" ON "produto_lotes"("status");

