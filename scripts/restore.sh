#!/bin/bash
# ==============================================================================
# SisPiro ERP — Rotina de Restauração de Banco de Dados (Disaster Recovery)
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Uso: $0 <caminho_para_backup.sql.gz>"
  echo "Exemplo: $0 ./backups/postgres/sispiro_backup_20261026_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="sispiro_postgres_prod"
DB_NAME="${POSTGRES_DB:-erp_pirotecnico}"
DB_USER="${POSTGRES_USER:-sispiro_app}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ [ERRO] Arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "===================================================================="
echo "⚠️  ATENÇÃO: OPERAÇÃO CRÍTICA DE RESTAURAÇÃO DE BANCO DE DADOS"
echo "===================================================================="
echo "Arquivo: $BACKUP_FILE"
echo "Destino: Banco '$DB_NAME' no container '$CONTAINER_NAME'"
echo "Esta operação substituirá tabelas e dados existentes!"
echo ""
read -rp "Digite 'CONFIRMAR-RESTAURACAO' para prosseguir: " CONFIRM

if [ "$CONFIRM" != "CONFIRMAR-RESTAURACAO" ]; then
  echo "❌ Operação cancelada pelo usuário."
  exit 1
fi

# Detecta se é container prod ou dev
TARGET_CONTAINER=""
if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
  TARGET_CONTAINER="$CONTAINER_NAME"
elif docker ps --format '{{.Names}}' | grep -q "backend-postgres-1"; then
  TARGET_CONTAINER="backend-postgres-1"
  DB_USER="${POSTGRES_USER:-erp}"
  DB_NAME="${POSTGRES_DB:-erp_pirotecnico}"
else
  echo "❌ [ERRO] Nenhum container PostgreSQL em execução encontrado."
  exit 1
fi

echo "==> Descompactando e restaurando base de dados..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$TARGET_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

echo "✅ Restauração finalizada com sucesso!"
