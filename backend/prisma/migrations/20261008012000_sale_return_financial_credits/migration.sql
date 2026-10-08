ALTER TYPE "FinancialEntryStatus" ADD VALUE 'COMPENSADO';

ALTER TABLE "lancamentos_financeiros"
ADD COLUMN "credito_aplicado" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "devolucao_venda_id" UUID;

ALTER TABLE "devolucoes_venda"
ADD COLUMN "credito_aplicado" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "valor_a_reembolsar" DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "lancamentos_financeiros_devolucao_venda_id_key"
ON "lancamentos_financeiros"("devolucao_venda_id");

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_devolucao_venda_id_fkey"
FOREIGN KEY ("devolucao_venda_id") REFERENCES "devolucoes_venda"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
