ALTER TABLE "lancamentos_financeiros"
ADD COLUMN "fornecedor_id" UUID,
ADD COLUMN "recebimento_compra_id" UUID;

ALTER TABLE "recebimentos_compra"
ADD COLUMN "recebimento_id" UUID;

CREATE TABLE "recebimentos_compra_lotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "compra_id" UUID NOT NULL,
    "referencia_fiscal" VARCHAR(100) NOT NULL,
    "data_vencimento" DATE NOT NULL,
    "recebido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recebimentos_compra_lotes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recebimentos_compra_lotes_compra_id_recebido_em_idx"
ON "recebimentos_compra_lotes"("compra_id", "recebido_em");

CREATE UNIQUE INDEX "lancamentos_financeiros_recebimento_compra_id_key"
ON "lancamentos_financeiros"("recebimento_compra_id");

ALTER TABLE "recebimentos_compra_lotes"
ADD CONSTRAINT "recebimentos_compra_lotes_compra_id_fkey"
FOREIGN KEY ("compra_id") REFERENCES "compras"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recebimentos_compra"
ADD CONSTRAINT "recebimentos_compra_recebimento_id_fkey"
FOREIGN KEY ("recebimento_id") REFERENCES "recebimentos_compra_lotes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_fornecedor_id_fkey"
FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_recebimento_compra_id_fkey"
FOREIGN KEY ("recebimento_compra_id") REFERENCES "recebimentos_compra_lotes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
