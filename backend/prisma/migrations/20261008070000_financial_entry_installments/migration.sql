-- AlterTable
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "numero_parcela" INTEGER;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "total_parcelas" INTEGER;
ALTER TABLE "lancamentos_financeiros" ADD COLUMN "grupo_parcelamento" VARCHAR(50);

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_grupo_parcelamento_idx" ON "lancamentos_financeiros"("grupo_parcelamento");

