-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDENTE', 'RECEBIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "razao_social" VARCHAR(150) NOT NULL,
    "cnpj_cpf" VARCHAR(20) NOT NULL,
    "possui_cr" BOOLEAN NOT NULL DEFAULT false,
    "numero_cr" VARCHAR(50),
    "validade_cr" DATE,
    "classes_pce_autorizadas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_compra" SERIAL NOT NULL,
    "fornecedor_id" UUID NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDENTE',
    "reference" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recebido_em" TIMESTAMPTZ(3),

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_compra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "compra_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "quantidade_pedida" DECIMAL(10,2) NOT NULL,
    "custo_unitario" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recebimentos_compra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_compra_id" UUID NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "paiol_id" UUID NOT NULL,
    "numero_lote" VARCHAR(50) NOT NULL,
    "data_fabricacao" DATE NOT NULL,
    "data_validade" DATE NOT NULL,
    "fabricante_importador" VARCHAR(150) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "recebimentos_compra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_cnpj_cpf_key" ON "fornecedores"("cnpj_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "compras_codigo_compra_key" ON "compras"("codigo_compra");

-- CreateIndex
CREATE INDEX "compras_status_created_at_idx" ON "compras"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "recebimentos_compra_item_compra_id_key" ON "recebimentos_compra"("item_compra_id");

-- CreateIndex
CREATE UNIQUE INDEX "recebimentos_compra_produto_lote_id_key" ON "recebimentos_compra"("produto_lote_id");

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_compra" ADD CONSTRAINT "itens_compra_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_compra" ADD CONSTRAINT "itens_compra_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos_compra" ADD CONSTRAINT "recebimentos_compra_item_compra_id_fkey" FOREIGN KEY ("item_compra_id") REFERENCES "itens_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos_compra" ADD CONSTRAINT "recebimentos_compra_produto_lote_id_fkey" FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recebimentos_compra" ADD CONSTRAINT "recebimentos_compra_paiol_id_fkey" FOREIGN KEY ("paiol_id") REFERENCES "paioes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
