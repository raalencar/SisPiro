-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('MERCADORIA', 'SERVICO', 'INSUMO');

-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('ORCAMENTO', 'APROVADO', 'EM_MONTAGEM', 'EXECUTADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'AJUSTE');

-- CreateTable
CREATE TABLE "produtos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_sku" VARCHAR(50) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "tipo" "ProductType" NOT NULL,
    "eh_pce" BOOLEAN NOT NULL DEFAULT false,
    "classe_risco" VARCHAR(20),
    "massa_neq_gramas" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "unidade_medida" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paioes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(100) NOT NULL,
    "capacidade_max_neq_kg" DECIMAL(10,2) NOT NULL,
    "licenca_bombeiros_validade" DATE NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "paioes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_lotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "produto_id" UUID NOT NULL,
    "paiol_id" UUID NOT NULL,
    "numero_lote" VARCHAR(50) NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "data_fabricacao" DATE NOT NULL,
    "data_validade" DATE NOT NULL,
    "fabricante_importador" VARCHAR(150) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "razao_social" VARCHAR(150) NOT NULL,
    "cnpj_cpf" VARCHAR(20) NOT NULL,
    "possui_cr" BOOLEAN NOT NULL DEFAULT false,
    "numero_cr" VARCHAR(50),
    "validade_cr" DATE,
    "classes_pce_autorizadas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blasters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(150) NOT NULL,
    "cpf" VARCHAR(14) NOT NULL,
    "numero_carteira_blaster" VARCHAR(50) NOT NULL,
    "validade_carteira" DATE NOT NULL,
    "categoria" VARCHAR(30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "blasters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordens_servico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_os" SERIAL NOT NULL,
    "cliente_id" UUID NOT NULL,
    "blaster_responsavel_id" UUID,
    "data_evento" TIMESTAMPTZ(3) NOT NULL,
    "local_evento" TEXT NOT NULL,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'ORCAMENTO',
    "art_numero" VARCHAR(50),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordens_servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordem_servico_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ordem_servico_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "quantidade_planejada" DECIMAL(10,2) NOT NULL,
    "quantidade_efetivamente_disparada" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordem_servico_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "StockMovementType" NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "paiol_origem_id" UUID,
    "paiol_destino_id" UUID,
    "reference" VARCHAR(100),
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ator_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "tipo_agregado" VARCHAR(100) NOT NULL,
    "agregado_id" VARCHAR(100) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produtos_codigo_sku_key" ON "produtos"("codigo_sku");

-- CreateIndex
CREATE INDEX "produto_lotes_paiol_id_produto_id_idx" ON "produto_lotes"("paiol_id", "produto_id");

-- CreateIndex
CREATE INDEX "produto_lotes_data_validade_idx" ON "produto_lotes"("data_validade");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cnpj_cpf_key" ON "clientes"("cnpj_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "blasters_cpf_key" ON "blasters"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_servico_codigo_os_key" ON "ordens_servico"("codigo_os");

-- CreateIndex
CREATE INDEX "movimentacoes_estoque_produto_lote_id_ocorrido_em_idx" ON "movimentacoes_estoque"("produto_lote_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "audit_logs_tipo_agregado_agregado_id_ocorrido_em_idx" ON "audit_logs"("tipo_agregado", "agregado_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "audit_logs_ator_id_ocorrido_em_idx" ON "audit_logs"("ator_id", "ocorrido_em");

-- AddForeignKey
ALTER TABLE "produto_lotes" ADD CONSTRAINT "produto_lotes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_lotes" ADD CONSTRAINT "produto_lotes_paiol_id_fkey" FOREIGN KEY ("paiol_id") REFERENCES "paioes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_servico" ADD CONSTRAINT "ordens_servico_blaster_responsavel_id_fkey" FOREIGN KEY ("blaster_responsavel_id") REFERENCES "blasters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico_itens" ADD CONSTRAINT "ordem_servico_itens_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico_itens" ADD CONSTRAINT "ordem_servico_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_servico_itens" ADD CONSTRAINT "ordem_servico_itens_produto_lote_id_fkey" FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_produto_lote_id_fkey" FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_paiol_origem_id_fkey" FOREIGN KEY ("paiol_origem_id") REFERENCES "paioes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_paiol_destino_id_fkey" FOREIGN KEY ("paiol_destino_id") REFERENCES "paioes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
