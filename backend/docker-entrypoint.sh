#!/bin/sh
set -e

echo "==> [SisPiro Backend] Inicializando container..."

# Executa migrações do Prisma a menos que explicitamente desabilitado
if [ "$RUN_MIGRATIONS" != "false" ]; then
  echo "==> [SisPiro Backend] Executando 'prisma migrate deploy'..."
  npx prisma migrate deploy || {
    echo "==> [ERRO] Falha ao executar migrações do banco de dados!"
    exit 1
  }
  echo "==> [SisPiro Backend] Migrações concluídas com sucesso."
fi

# Executa seed inicial opcional se configurado
if [ "$RUN_SEED" = "true" ]; then
  echo "==> [SisPiro Backend] Executando seed de inicialização..."
  node prisma/seed.mjs || echo "==> [Aviso] Seed ignorado ou falhou."
fi

echo "==> [SisPiro Backend] Iniciando aplicação NestJS..."
exec "$@"
