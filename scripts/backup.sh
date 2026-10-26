#!/bin/bash
# ==============================================================================
# SisPiro ERP — Rotina de Backup Consistente do PostgreSQL (Disaster Recovery)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
CONTAINER_NAME="sispiro_postgres_prod"
DB_NAME="${POSTGRES_DB:-erp_pirotecnico}"
DB_USER="${POSTGRES_USER:-sispiro_app}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/sispiro_backup_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "$BACKUP_DIR"

echo "==> [Backup] Iniciando dump do banco '${DB_NAME}' às $(date)..."

# Executa pg_dump dentro do container com compactação gzip
if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
  docker exec -i "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists | gzip > "$BACKUP_FILE"
else
  # Fallback caso esteja rodando compose local de dev
  CONTAINER_DEV="backend-postgres-1"
  if docker ps --format '{{.Names}}' | grep -q "$CONTAINER_DEV"; then
    docker exec -i "$CONTAINER_DEV" pg_dump -U "${POSTGRES_USER:-erp}" -d "${POSTGRES_DB:-erp_pirotecnico}" --no-owner --clean --if-exists | gzip > "$BACKUP_FILE"
  else
    echo "❌ [ERRO] Nenhum container PostgreSQL em execução encontrado."
    exit 1
  fi
fi

# Valida integridade do arquivo gerado
if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ [ERRO] O arquivo de backup foi gerado vazio!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Gera hash SHA256 para auditoria de integridade
if command -v shasum &>/dev/null; then
  shasum -a 256 "$BACKUP_FILE" > "$CHECKSUM_FILE"
elif command -v sha256sum &>/dev/null; then
  sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
fi

FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "✅ [Backup] Backup concluído com sucesso: ${BACKUP_FILE} (${FILE_SIZE})"

# Política de Retenção: Remove backups com mais de X dias
echo "==> [Retenção] Limpando backups com mais de ${RETENTION_DAYS} dias..."
find "$BACKUP_DIR" -type f -name "sispiro_backup_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;
echo "✅ [Retenção] Limpeza finalizada."
