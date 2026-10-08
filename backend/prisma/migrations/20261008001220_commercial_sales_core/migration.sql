-- CreateTable
CREATE TABLE "tabelas_preco" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "vigente_de" DATE,
    "vigente_ate" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tabelas_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_tabela_preco" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tabela_preco_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "preco_unitario" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_tabela_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_venda" SERIAL NOT NULL,
    "cliente_id" UUID,
    "tabela_preco_id" UUID NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_venda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venda_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "preco_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tabelas_preco_ativo_vigente_de_vigente_ate_idx" ON "tabelas_preco"("ativo", "vigente_de", "vigente_ate");

-- CreateIndex
CREATE UNIQUE INDEX "itens_tabela_preco_tabela_preco_id_produto_id_key" ON "itens_tabela_preco"("tabela_preco_id", "produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendas_codigo_venda_key" ON "vendas"("codigo_venda");

-- CreateIndex
CREATE INDEX "vendas_created_at_idx" ON "vendas"("created_at");

-- CreateIndex
CREATE INDEX "itens_venda_produto_lote_id_idx" ON "itens_venda"("produto_lote_id");

-- AddForeignKey
ALTER TABLE "itens_tabela_preco" ADD CONSTRAINT "itens_tabela_preco_tabela_preco_id_fkey" FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_tabela_preco" ADD CONSTRAINT "itens_tabela_preco_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_tabela_preco_id_fkey" FOREIGN KEY ("tabela_preco_id") REFERENCES "tabelas_preco"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_venda" ADD CONSTRAINT "itens_venda_produto_lote_id_fkey" FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
