-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "descricao" TEXT;

-- CreateTable
CREATE TABLE "fornecedor_catalogo_itens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fornecedor_id" UUID NOT NULL,
    "id_externo" VARCHAR(50) NOT NULL,
    "codigo_fornecedor" VARCHAR(30),
    "nome" VARCHAR(200) NOT NULL,
    "descricao" TEXT,
    "efeito" TEXT,
    "embalagem_unitaria" VARCHAR(60),
    "embalagem_master" VARCHAR(60),
    "tempo_aproximado" VARCHAR(60),
    "observacoes" TEXT,
    "atributos_extras" JSONB NOT NULL DEFAULT '{}',
    "categorias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url_origem" VARCHAR(300),
    "caminhos_imagens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "produto_id" UUID,
    "importado_em" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fornecedor_catalogo_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fornecedor_catalogo_itens_fornecedor_id_codigo_fornecedor_idx" ON "fornecedor_catalogo_itens"("fornecedor_id", "codigo_fornecedor");

-- CreateIndex
CREATE INDEX "fornecedor_catalogo_itens_produto_id_idx" ON "fornecedor_catalogo_itens"("produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "fornecedor_catalogo_itens_fornecedor_id_id_externo_key" ON "fornecedor_catalogo_itens"("fornecedor_id", "id_externo");

-- AddForeignKey
ALTER TABLE "fornecedor_catalogo_itens" ADD CONSTRAINT "fornecedor_catalogo_itens_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fornecedor_catalogo_itens" ADD CONSTRAINT "fornecedor_catalogo_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

