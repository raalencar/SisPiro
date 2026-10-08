CREATE TABLE "promocoes_produto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "vigente_de" DATE NOT NULL,
    "vigente_ate" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promocoes_produto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "itens_promocao_produto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promocao_id" UUID NOT NULL,
    "produto_id" UUID NOT NULL,
    "preco_promocional" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "itens_promocao_produto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promocoes_produto_ativa_vigente_de_vigente_ate_idx"
ON "promocoes_produto"("ativa", "vigente_de", "vigente_ate");

CREATE UNIQUE INDEX "itens_promocao_produto_promocao_id_produto_id_key"
ON "itens_promocao_produto"("promocao_id", "produto_id");

CREATE INDEX "itens_promocao_produto_produto_id_promocao_id_idx"
ON "itens_promocao_produto"("produto_id", "promocao_id");

ALTER TABLE "itens_promocao_produto"
ADD CONSTRAINT "itens_promocao_produto_promocao_id_fkey"
FOREIGN KEY ("promocao_id") REFERENCES "promocoes_produto"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itens_promocao_produto"
ADD CONSTRAINT "itens_promocao_produto_produto_id_fkey"
FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
