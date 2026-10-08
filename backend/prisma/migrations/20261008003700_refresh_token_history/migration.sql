CREATE TABLE "refresh_tokens_usados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessao_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "usado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_usados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refresh_tokens_usados_sessao_id_usado_em_idx"
ON "refresh_tokens_usados"("sessao_id", "usado_em");

CREATE UNIQUE INDEX "refresh_tokens_usados_sessao_id_token_hash_key"
ON "refresh_tokens_usados"("sessao_id", "token_hash");

ALTER TABLE "refresh_tokens_usados"
ADD CONSTRAINT "refresh_tokens_usados_sessao_id_fkey"
FOREIGN KEY ("sessao_id") REFERENCES "sessoes_autenticacao"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
