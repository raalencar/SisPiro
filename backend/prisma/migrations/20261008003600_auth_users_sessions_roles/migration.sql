CREATE TYPE "UserRole" AS ENUM (
    'ADMIN',
    'ESTOQUE',
    'COMERCIAL',
    'OPERACOES',
    'COMPRAS',
    'FINANCEIRO'
);

CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "roles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessoes_autenticacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "ultimo_uso_em" TIMESTAMPTZ(3),
    "revogado_em" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_autenticacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE INDEX "usuarios_ativo_created_at_idx" ON "usuarios"("ativo", "created_at");
CREATE INDEX "sessoes_autenticacao_usuario_id_expira_em_idx"
ON "sessoes_autenticacao"("usuario_id", "expira_em");

ALTER TABLE "sessoes_autenticacao"
ADD CONSTRAINT "sessoes_autenticacao_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
ADD CONSTRAINT "audit_logs_ator_id_fkey"
FOREIGN KEY ("ator_id") REFERENCES "usuarios"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
