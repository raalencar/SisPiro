CREATE TYPE "SalesQuoteStatus" AS ENUM (
    'EMITIDO',
    'CONVERTIDO',
    'CANCELADO',
    'EXPIRADO'
);

ALTER TABLE "vendas"
ADD COLUMN "orcamento_id" UUID;

CREATE TABLE "orcamentos_venda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_orcamento" SERIAL NOT NULL,
    "cliente_id" UUID,
    "tabela_preco_id" UUID NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "SalesQuoteStatus" NOT NULL DEFAULT 'EMITIDO',
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "convertido_em" TIMESTAMPTZ(3),
    "cancelado_em" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcamentos_venda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itens_orcamento_venda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orcamento_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "preco_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_orcamento_venda_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orcamentos_venda_codigo_orcamento_key"
ON "orcamentos_venda"("codigo_orcamento");

CREATE INDEX "orcamentos_venda_status_expira_em_created_at_idx"
ON "orcamentos_venda"("status", "expira_em", "created_at");

CREATE INDEX "orcamentos_venda_cliente_id_created_at_idx"
ON "orcamentos_venda"("cliente_id", "created_at");

CREATE INDEX "itens_orcamento_venda_produto_lote_id_orcamento_id_idx"
ON "itens_orcamento_venda"("produto_lote_id", "orcamento_id");

CREATE UNIQUE INDEX "vendas_orcamento_id_key" ON "vendas"("orcamento_id");

ALTER TABLE "vendas"
ADD CONSTRAINT "vendas_orcamento_id_fkey"
FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos_venda"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamentos_venda"
ADD CONSTRAINT "orcamentos_venda_cliente_id_fkey"
FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamentos_venda"
ADD CONSTRAINT "orcamentos_venda_tabela_preco_id_fkey"
FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "itens_orcamento_venda"
ADD CONSTRAINT "itens_orcamento_venda_orcamento_id_fkey"
FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos_venda"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itens_orcamento_venda"
ADD CONSTRAINT "itens_orcamento_venda_produto_id_fkey"
FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "itens_orcamento_venda"
ADD CONSTRAINT "itens_orcamento_venda_produto_lote_id_fkey"
FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
