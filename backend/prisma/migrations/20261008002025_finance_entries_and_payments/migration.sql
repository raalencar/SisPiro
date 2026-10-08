-- CreateEnum
CREATE TYPE "FinancialDirection" AS ENUM ('RECEBER', 'PAGAR');

-- CreateEnum
CREATE TYPE "FinancialEntryStatus" AS ENUM ('ABERTO', 'PARCIAL', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FinancialPaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'TRANSFERENCIA', 'CARTAO', 'BOLETO', 'OUTRO');

-- CreateTable
CREATE TABLE "lancamentos_financeiros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo_lancamento" SERIAL NOT NULL,
    "direction" "FinancialDirection" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "parte_relacionada" VARCHAR(150) NOT NULL,
    "cliente_id" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "data_vencimento" DATE NOT NULL,
    "status" "FinancialEntryStatus" NOT NULL DEFAULT 'ABERTO',
    "reference" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos_financeiros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lancamento_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "FinancialPaymentMethod" NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" VARCHAR(100),
    "notes" VARCHAR(500),

    CONSTRAINT "pagamentos_financeiros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lancamentos_financeiros_codigo_lancamento_key" ON "lancamentos_financeiros"("codigo_lancamento");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_direction_status_data_vencimento_idx" ON "lancamentos_financeiros"("direction", "status", "data_vencimento");

-- CreateIndex
CREATE INDEX "lancamentos_financeiros_cliente_id_data_vencimento_idx" ON "lancamentos_financeiros"("cliente_id", "data_vencimento");

-- CreateIndex
CREATE INDEX "pagamentos_financeiros_lancamento_id_ocorrido_em_idx" ON "pagamentos_financeiros"("lancamento_id", "ocorrido_em");

-- CreateIndex
CREATE INDEX "pagamentos_financeiros_ocorrido_em_idx" ON "pagamentos_financeiros"("ocorrido_em");

-- AddForeignKey
ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos_financeiros" ADD CONSTRAINT "pagamentos_financeiros_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamentos_financeiros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
