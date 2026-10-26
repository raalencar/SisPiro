# SisPiro ERP

[![CI](https://github.com/raalencar/SisPiro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raalencar/SisPiro/actions/workflows/ci.yml)

Monorepositório da plataforma SisPiro ERP, com API NestJS em `backend/` e
interface web Next.js em `frontend/`.

## Estado atual e roadmap

A API oferece autenticação com MFA e recuperação de senha, rate limiting de
login distribuído em Redis, perfis de acesso, estoque/WMS, cadastros
operacionais e fluxos de compras, vendas, ordens de serviço e financeiro
(incluindo parcelamento nativo de lançamentos). A interface integra
autenticação (incluindo desafio MFA e recuperação de senha), estoque/WMS
(produtos, lotes, quarentena/bloqueio, split entre paióis, Mapa SFPC),
clientes, blasters, compras/fornecedores, comercial (tabelas de preço,
promoções, orçamentos, PDV, devoluções), ordens de serviço (orçamento até
aprovação, montagem e encerramento, incluindo edição de orçamento) e
financeiro (contas a pagar/receber, fluxo de caixa, Aging Schedule,
parcelamento). Os controles de apresentação por perfil ocultam/desabilitam
módulos sem permissão na navegação.

Ainda falta validação visual completa em ambiente de staging. RBAC por ação
dentro de uma tela foi avaliado e fechado (não há hoje tela real compartilhada
por mais de um perfil com permissões diferentes por ação); reavaliar apenas se
isso passar a existir. Emissão fiscal, Guias de
Tráfego, integração bancária/conciliação e permissões de banco/backup de
produção são lacunas conhecidas e, no caso fiscal/GT/bancário, bloqueadas até
aprovação explícita. O documento
[Status da implementação](./docs/STATUS-IMPLEMENTACAO.md) lista o que foi
entregue e as próximas etapas por backend e frontend.

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

Para visualizar os dados locais do seed, entre com `demo.admin@local.test` e
com a senha configurada em `DEV_SEED_ADMIN_PASSWORD` no backend. O frontend
mantém access e refresh tokens em cookies `HttpOnly`; não os persista em
`localStorage` ou `sessionStorage`.

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

## Containers de produção

Backend e frontend têm `Dockerfile` próprios. O backend inicia a API (migrações
são aplicadas separadamente com `npm run db:deploy` no processo de implantação);
o frontend precisa de `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_API_PREFIX` informadas
como `--build-arg` no `docker build`, pois são embutidas no bundle em tempo de
build. Veja [`backend/README.md`](./backend/README.md#container-de-produção) e
[`frontend/README.md`](./frontend/README.md#container-de-produção) para os
comandos completos.

## Verificação do frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```
