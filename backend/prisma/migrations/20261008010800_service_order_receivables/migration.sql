ALTER TABLE "ordens_servico"
ADD COLUMN "valor_contratado" DECIMAL(12, 2);

ALTER TABLE "lancamentos_financeiros"
ADD COLUMN "ordem_servico_id" UUID;

CREATE UNIQUE INDEX "lancamentos_financeiros_ordem_servico_id_key"
ON "lancamentos_financeiros"("ordem_servico_id");

ALTER TABLE "lancamentos_financeiros"
ADD CONSTRAINT "lancamentos_financeiros_ordem_servico_id_fkey"
FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
