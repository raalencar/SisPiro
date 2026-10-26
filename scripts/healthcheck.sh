#!/bin/bash
# ==============================================================================
# SisPiro ERP — Diagnóstico de Saúde e Infraestrutura (SRE Healthcheck)
# ==============================================================================
set -u

echo "===================================================================="
echo "         🩺 SisPiro ERP — Diagnóstico de Infraestrutura"
echo "===================================================================="
echo "Data/Hora: $(date)"
echo ""

echo "--- [1] Status dos Contêineres Docker ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "sispiro|backend" || echo "Nenhum container encontrado."

echo ""
echo "--- [2] Healthcheck da Aplicação (NestJS API) ---"
if command -v curl &>/dev/null; then
  echo -n "• Liveness (/api/v1/health/live): "
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/v1/health/live 2>/dev/null || echo "Falha de conexão"

  echo -n "• Readiness (/api/v1/health/ready): "
  curl -s http://127.0.0.1:3000/api/v1/health/ready 2>/dev/null || echo "Falha de conexão"
  echo ""
fi

echo ""
echo "--- [3] Conectividade com Frontend Next.js ---"
if command -v curl &>/dev/null; then
  echo -n "• Frontend (HTTP 3001): "
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/ 2>/dev/null || echo "Falha de conexão"
fi

echo ""
echo "--- [4] Recursos do Host ---"
echo "• Uso de Memória:"
if command -v free &>/dev/null; then
  free -h
elif command -v vm_stat &>/dev/null; then
  vm_stat | head -n 5
fi

echo "• Espaço em Disco:"
df -h .

echo "===================================================================="
