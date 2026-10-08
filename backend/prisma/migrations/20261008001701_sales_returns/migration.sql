-- CreateTable
CREATE TABLE "devolucoes_venda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_devolucao" SERIAL NOT NULL,
    "venda_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devolucoes_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_devolucao_venda" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "devolucao_id" UUID NOT NULL,
    "item_venda_id" UUID NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "preco_unitario" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_devolucao_venda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devolucoes_venda_codigo_devolucao_key" ON "devolucoes_venda"("codigo_devolucao");

-- CreateIndex
CREATE INDEX "devolucoes_venda_venda_id_created_at_idx" ON "devolucoes_venda"("venda_id", "created_at");

-- CreateIndex
CREATE INDEX "itens_devolucao_venda_item_venda_id_idx" ON "itens_devolucao_venda"("item_venda_id");

-- AddForeignKey
ALTER TABLE "devolucoes_venda" ADD CONSTRAINT "devolucoes_venda_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_devolucao_venda" ADD CONSTRAINT "itens_devolucao_venda_devolucao_id_fkey" FOREIGN KEY ("devolucao_id") REFERENCES "devolucoes_venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_devolucao_venda" ADD CONSTRAINT "itens_devolucao_venda_item_venda_id_fkey" FOREIGN KEY ("item_venda_id") REFERENCES "itens_venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_devolucao_venda" ADD CONSTRAINT "itens_devolucao_venda_produto_lote_id_fkey" FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
