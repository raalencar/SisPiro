-- AlterTable usuarios
ALTER TABLE "usuarios"
ADD COLUMN "mfa_habilitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfa_secret" VARCHAR(128),
ADD COLUMN "mfa_codigos_backup" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable tokens_recuperacao_senha
CREATE TABLE "tokens_recuperacao_senha" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "usado_em" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tokens_recuperacao_senha_usuario_id_expira_em_idx" ON "tokens_recuperacao_senha"("usuario_id", "expira_em");

-- CreateIndex
CREATE INDEX "tokens_recuperacao_senha_token_hash_idx" ON "tokens_recuperacao_senha"("token_hash");

-- AddForeignKey
ALTER TABLE "tokens_recuperacao_senha"
ADD CONSTRAINT "tokens_recuperacao_senha_usuario_id_fkey"
FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

