-- CreateEnum
CREATE TYPE "FiscalDocumentType" AS ENUM ('NFE', 'NFCE', 'NFSE');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PROCESSANDO', 'AUTORIZADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TrafficGuideStatus" AS ENUM ('EMITIDA', 'EM_TRANSITO', 'CONCLUIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "lancamentos_financeiros" ADD COLUMN     "pix_expira_em" TIMESTAMPTZ(3),
ADD COLUMN     "pix_qrcode" TEXT,
ADD COLUMN     "pix_txid" VARCHAR(50);

-- AlterTable
ALTER TABLE "pagamentos_financeiros" ADD COLUMN     "banco_fitid" VARCHAR(100),
ADD COLUMN     "conciliado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conciliado_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "conciliacoes_bancarias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "banco_nome" VARCHAR(100),
    "conta_numero" VARCHAR(50),
    "data_extrato" DATE NOT NULL,
    "total_creditos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_debitos" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantidade_transacoes" INTEGER NOT NULL DEFAULT 0,
    "quantidade_conciliadas" INTEGER NOT NULL DEFAULT 0,
    "importado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conciliacoes_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_fiscais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "FiscalDocumentType" NOT NULL,
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PROCESSANDO',
    "numero" INTEGER NOT NULL,
    "serie" INTEGER NOT NULL DEFAULT 1,
    "chave_acesso" VARCHAR(50),
    "protocolo_autorizacao" VARCHAR(50),
    "valor_total" DECIMAL(12,2) NOT NULL,
    "url_xml" TEXT,
    "url_danfe" TEXT,
    "mensagem_erro" TEXT,
    "emitido_em" TIMESTAMPTZ(3),
    "cancelado_em" TIMESTAMPTZ(3),
    "motivo_cancelamento" TEXT,
    "venda_id" UUID,
    "ordem_servico_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documentos_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guias_trafego" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_gt" VARCHAR(50) NOT NULL,
    "documento_fiscal_id" UUID,
    "ordem_servico_id" UUID,
    "paiol_origem_id" UUID,
    "status" "TrafficGuideStatus" NOT NULL DEFAULT 'EMITIDA',
    "valida_de" TIMESTAMPTZ(3) NOT NULL,
    "valida_ate" TIMESTAMPTZ(3) NOT NULL,
    "cidade_origem" VARCHAR(100) NOT NULL,
    "uf_origem" VARCHAR(2) NOT NULL,
    "cidade_destino" VARCHAR(100) NOT NULL,
    "uf_destino" VARCHAR(2) NOT NULL,
    "itinerario" VARCHAR(500) NOT NULL,
    "veiculo_placa" VARCHAR(10) NOT NULL,
    "veiculo_uf" VARCHAR(2) NOT NULL,
    "veiculo_modelo" VARCHAR(100),
    "motorista_nome" VARCHAR(150) NOT NULL,
    "motorista_cpf" VARCHAR(14) NOT NULL,
    "motorista_cnh" VARCHAR(20) NOT NULL,
    "possui_mopp" BOOLEAN NOT NULL DEFAULT true,
    "blaster_id" UUID,
    "total_neq_kg" DECIMAL(10,4) NOT NULL,
    "observacoes" VARCHAR(500),
    "emitida_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "guias_trafego_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guia_trafego_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guia_trafego_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "produto_lote_id" UUID NOT NULL,
    "quantidade" DECIMAL(10,2) NOT NULL,
    "neq_gramas" DECIMAL(10,4) NOT NULL,
    "numero_onu" VARCHAR(20) NOT NULL DEFAULT 'UN 0336',
    "classe_risco" VARCHAR(20) NOT NULL DEFAULT '1.4G',

    CONSTRAINT "guia_trafego_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conciliacoes_bancarias_importado_em_idx" ON "conciliacoes_bancarias"("importado_em");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscais_chave_acesso_key" ON "documentos_fiscais"("chave_acesso");

-- CreateIndex
CREATE INDEX "documentos_fiscais_tipo_status_created_at_idx" ON "documentos_fiscais"("tipo", "status", "created_at");

-- CreateIndex
CREATE INDEX "documentos_fiscais_venda_id_idx" ON "documentos_fiscais"("venda_id");

-- CreateIndex
CREATE INDEX "documentos_fiscais_ordem_servico_id_idx" ON "documentos_fiscais"("ordem_servico_id");

-- CreateIndex
CREATE UNIQUE INDEX "guias_trafego_numero_gt_key" ON "guias_trafego"("numero_gt");

-- CreateIndex
CREATE INDEX "guias_trafego_status_valida_ate_idx" ON "guias_trafego"("status", "valida_ate");

-- CreateIndex
CREATE INDEX "guias_trafego_documento_fiscal_id_idx" ON "guias_trafego"("documento_fiscal_id");

-- CreateIndex
CREATE INDEX "guias_trafego_ordem_servico_id_idx" ON "guias_trafego"("ordem_servico_id");

-- CreateIndex
CREATE INDEX "guia_trafego_itens_guia_trafego_id_idx" ON "guia_trafego_itens"("guia_trafego_id");

-- CreateIndex
CREATE INDEX "guia_trafego_itens_produto_lote_id_idx" ON "guia_trafego_itens"("produto_lote_id");

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_financeiros_pix_txid_key" ON "lancamentos_financeiros"("pix_txid");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_pix_txid_idx" ON "lancamentos_financeiros"("pix_txid");

-- CreateIndex
CREATE INDEX "pagamentos_financeiros_banco_fitid_idx" ON "pagamentos_financeiros"("banco_fitid");

-- AddForeignKey
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "vendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscais" ADD CONSTRAINT "documentos_fiscais_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_trafego" ADD CONSTRAINT "guias_trafego_documento_fiscal_id_fkey" FOREIGN KEY ("documento_fiscal_id") REFERENCES "documentos_fiscais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_trafego" ADD CONSTRAINT "guias_trafego_ordem_servico_id_fkey" FOREIGN KEY ("ordem_servico_id") REFERENCES "ordens_servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_trafego" ADD CONSTRAINT "guias_trafego_paiol_origem_id_fkey" FOREIGN KEY ("paiol_origem_id") REFERENCES "paioes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_trafego" ADD CONSTRAINT "guias_trafego_blaster_id_fkey" FOREIGN KEY ("blaster_id") REFERENCES "blasters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_trafego_itens" ADD CONSTRAINT "guia_trafego_itens_guia_trafego_id_fkey" FOREIGN KEY ("guia_trafego_id") REFERENCES "guias_trafego"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_trafego_itens" ADD CONSTRAINT "guia_trafego_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guia_trafego_itens" ADD CONSTRAINT "guia_trafego_itens_produto_lote_id_fkey" FOREIGN KEY ("produto_lote_id") REFERENCES "produto_lotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

