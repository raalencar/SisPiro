# ERP Pirotécnico

Monorepositório com a API NestJS em `backend/` e a fundação frontend em `frontend/`.

## Frontend

Requer Node.js 20.9 ou superior e npm.

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost:3001`. Para apontar a API para outro endereço, configure
`NEXT_PUBLIC_API_URL` com a origem do backend e `NEXT_PUBLIC_API_PREFIX` com o
prefixo configurado nele. Os padrões locais são `http://localhost:3000` e
`/api/v1`, respectivamente. Essas variáveis são públicas e não devem conter
segredos.

## Backend

Requer Node.js 22 ou superior e Docker com Docker Compose.

```bash
cd backend
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:generate
npm run db:deploy
npm run start:dev
```

A documentação OpenAPI é servida em `http://localhost:3000/api/v1/docs`.
Consulte também [a documentação do backend](./backend/README.md) para requisitos,
comandos e configuração de persistência.

## Estado da integração

O backend já expõe APIs de negócio para estoque/WMS, clientes, blasters, ordens
de serviço, compras/fornecedores, tabelas de preço, orçamentos comerciais,
vendas/PDV, devoluções e contas a pagar/receber, além de autenticação JWT e
perfis de acesso por módulo. Orçamentos comerciais reservam estoque por sete
dias e podem ser convertidos em venda preservando os preços cotados.
Cada recebimento de compra cria atomicamente uma conta a pagar com valor
proporcional, fornecedor, vencimento e referência fiscal. Ao concluir uma OS,
o backend gera uma conta a receber pelo valor contratado, com vencimento
informado no fechamento. O frontend integra somente os endpoints de liveness e
readiness:
`GET /api/v1/health/live` e
`GET /api/v1/health/ready` (considerando o prefixo padrão); as telas de negócio
ainda não consomem as APIs e mostram estados vazios. Permanecem pendentes
emissão fiscal, Guias de Tráfego, integração bancária e itens de segurança
adicionais; o [roadmap e as demais lacunas conhecidas](./backend/README.md#lacunas-conhecidas-e-próximos-módulos)
estão documentados no README do backend.

## Verificação do frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```
