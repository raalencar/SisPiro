# SisPiro ERP

Monorepositório da plataforma SisPiro ERP, com API NestJS em `backend/` e
interface web Next.js em `frontend/`.

## Estado atual e roadmap

A API oferece autenticação com MFA e recuperação de senha, perfis de acesso,
estoque/WMS, cadastros operacionais e fluxos de compras, vendas, ordens de
serviço e financeiro. A interface integra autenticação (incluindo desafio
MFA), estoque/WMS (produtos, lotes, quarentena/bloqueio, split entre paióis,
Mapa SFPC), clientes, blasters, compras/fornecedores, comercial (tabelas de
preço, promoções, orçamentos, PDV, devoluções), ordens de serviço (orçamento
até aprovação, montagem e encerramento, incluindo edição de orçamento) e
financeiro (contas a pagar/receber, fluxo de caixa, Aging Schedule). Os
controles de apresentação por perfil ocultam/desabilitam módulos sem
permissão na navegação.

Ainda faltam: tela de recuperação de senha no frontend (API já disponível),
RBAC por ação dentro de uma tela (hoje é por módulo), e testes de componente
automatizados. Emissão fiscal, Guias de Tráfego, integração bancária/
conciliação e permissões de banco/backup de produção são lacunas conhecidas
e, no caso fiscal/GT/bancário, bloqueadas até aprovação explícita. O
documento [Status da implementação](./docs/STATUS-IMPLEMENTACAO.md) lista o que
foi entregue e as próximas etapas por backend e frontend.

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

## Verificação do frontend

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```
