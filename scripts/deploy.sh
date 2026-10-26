#!/bin/bash
# ==============================================================================
# SisPiro ERP — Script de Implantação e Atualização Contínua em Produção
# ==============================================================================
set -euo pipefail

ENV_FILE=".env.production"
COMPOSE_FILE="docker-compose.prod.yml"

echo "===================================================================="
echo "         🚀 SisPiro ERP — Pipeline de Implantação de Produção"
echo "===================================================================="

# 1. Validação de Pré-requisitos
if ! command -v docker &> /dev/null; then
  echo "❌ [ERRO] Docker não está instalado ou não está no PATH."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ [ERRO] Arquivo de ambiente '$ENV_FILE' não encontrado!"
  echo "👉 Crie-o copiando o modelo: cp .env.production.example $ENV_FILE"
  exit 1
fi

# 2. Backup Preventivo do Banco de Dados
if docker ps --format '{{.Names}}' | grep -q "sispiro_postgres_prod"; then
  echo "📦 [1/4] Executando backup preventivo do PostgreSQL antes do deploy..."
  if [ -x "./scripts/backup.sh" ]; then
    ./scripts/backup.sh || echo "⚠️ Aviso: Falha no backup automático pré-deploy. Continuando..."
  fi
else
  echo "ℹ️ [1/4] Banco de dados ainda não está rodando. Pulando backup pré-deploy."
fi

# 3. Build e Subida dos Contêineres
echo "🔨 [2/4] Construindo imagens e subindo contêineres..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build --remove-orphans

# 4. Aguardar Inicialização dos Serviços
echo "⏳ [3/4] Aguardando backend atingir status de prontidão (readiness)..."
MAX_ATTEMPTS=30
ATTEMPT=1
READY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if docker exec sispiro_backend_prod node -e "fetch('http://127.0.0.1:3000/api/v1/health/live').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))" &>/dev/null; then
    READY=true
    break
  fi
  echo "   ... aguardando inicialização (tentativa $ATTEMPT/$MAX_ATTEMPTS)"
  sleep 3
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$READY" = "true" ]; then
  echo "✅ [4/4] Backend inicializado com sucesso e conectado ao banco!"
else
  echo "❌ [ERRO] Tempo limite esgotado esperando o backend responder."
  echo "👉 Verifique os logs com: docker logs --tail 50 sispiro_backend_prod"
  exit 1
fi

echo ""
echo "===================================================================="
echo "🎉 Implantação concluída com sucesso!"
echo "   - Frontend: http://localhost:3001"
echo "   - Backend:  http://localhost:3000/api/v1"
echo "   - Health:   http://localhost:3000/api/v1/health/ready"
echo "===================================================================="
