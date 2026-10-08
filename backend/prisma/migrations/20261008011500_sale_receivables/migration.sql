ALTER TABLE "lancamentos_financeiros"
ADD COLUMN "venda_id" UUID;

CREATE UNIQUE INDEX "lancamentos_financeiros_venda_id_key"
ON "lancamentos_financeiros"("venda_id");

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_venda_id_fkey"
FOREIGN KEY ("venda_id") REFERENCES "vendas"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
