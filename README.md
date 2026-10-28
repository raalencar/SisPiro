# SisPiro ERP

[![CI](https://github.com/raalencar/SisPiro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raalencar/SisPiro/actions/workflows/ci.yml)

Monorepositório da plataforma **SisPiro ERP**, com API NestJS em `backend/` e interface web Next.js em `frontend/`. Sistema de gestão integrada (ERP) especializado em empresas que operam com **Produtos Controlados pelo Exército (PCE)** — fogos de artifício, espetáculos pirotécnicos, paióis de armazenamento, transporte rodoviário regulamentado e faturamento fiscal.

---

## 🏛️ Arquitetura e Módulos Implementados

1. **Compliance & Regulatório PCE (`/modules/compliance`):**
   - Emissão de Guia de Tráfego Militar no padrão sequencial anual do Exército Brasileiro (`GT-YYYY/NNNN`).
   - Controle estrito de habilitação MOPP para condutores, cálculo em tempo real de Massa Líquida Total de Explosivo (NEQ em kg) e **Espelho Oficial Militar de Impressão** formatado perante o DFPC/SFPC/COLOG.
   - Gestão de clientes com validação de Certificado de Registro (CR) e classes PCE autorizadas.
   - Responsáveis técnicos Blasters com controle de validade de carteira perante a data de realização dos espetáculos.
2. **Estoque Especializado & WMS (`/modules/inventory`):**
   - Paióis com travas de segurança volumétrica e capacidade máxima em NEQ (kg) validadas em transação relacional com lock pessimista (`SELECT FOR UPDATE`).
   - Rastreabilidade obrigatória de lotes PCE (fabricação, validade, fabricante e quarentena/bloqueio físico).
   - Catálogo de fornecedores (`/modules/supplier-catalog`): itens e fotos importados do fornecedor (Amazon Fireworks, 167 itens), consulta para Compras/Estoque e cadastro de produto a partir do item com vínculo único e auditado.
   - Desmembramento atômico de lotes (`split`) e Mapa Mensal de Movimentação e Estocagem de PCE para o Exército Brasileiro (R-105).
3. **Operações de Shows & Ordens de Serviço (`/modules/operations`):**
   - Ciclo de vida completo: Orçamento ➔ Aprovação com Blaster & ART ➔ Montagem ➔ Queima / Encerramento seguro.
   - Edição de orçamentos de OS (`PUT /operations/orders/:id`) antes da aprovação com recálculo de reservas.
   - Encerramento com quantidades efetivamente disparadas, devolução automática de sobras ao estoque e geração de Contas a Receber.
4. **Comercial & Faturamento Fiscal (`/modules/sales`, `/modules/billing`):**
   - Gestão de tabelas de preço e campanhas promocionais (desconto percentual ou preço fixo) com motor de precedência estrita (menor preço efetivo).
   - Orçamentos comerciais com reserva de estoque por 7 dias e envio assíncrono por e-mail via fila BullMQ.
   - Ponto de Venda (PDV) de balcão com checkout rápido e devoluções com reentrada de lotes.
   - Faturamento Fiscal com arquitetura Adapter/Strategy agnóstica (`FiscalSandboxAdapter` e `FocusNfeAdapter`), cálculo oficial de chave SEFAZ de 44 dígitos com dígito verificador Módulo 11 e emissão de **NF-e (Modelo 55)**, **NFC-e (Modelo 65)** e **NFS-e (Serviços)**, além de cancelamento legal homologado.
5. **Core Financeiro & Cobrança PIX (`/modules/finance`):**
   - Gestão integral de Contas a Pagar e Contas a Receber com filtros, quitação, pagamentos parciais e demonstrativo de Fluxo de Caixa.
   - Relatório analítico de Aging Schedule com classificação em 5 buckets de maturidade.
   - Parcelamento financeiro nativo com divisão exata de centavos (resto alocado na 1ª parcela) e agrupamento visual.
   - Cobrança via **PIX Dinâmico** oficial EMVCo com CRC16-CCITT e webhook bancário com lock pessimista para liquidação automática e instantânea.
   - Conciliação bancária via extrato **OFX** (SGML/XML) com motor inteligente de correspondência e liquidação em lote com auditoria.
6. **Segurança Avançada & Autenticação:**
   - Autenticação JWT com refresh rotativo e tokens confinados em cookies `HttpOnly` no BFF do Next.js.
   - Autenticação Multifator (MFA TOTP RFC 6238) com pareamento Base32 e 8 códigos de emergência.
   - Recuperação de senha com tokens de uso único (15 min) despachados via BullMQ.
   - Rate limiting de login distribuído e atômico em Redis (`ioredis`) com fallback gracioso em memória.
   - Auditoria append-only imutável em todas as operações de negócio com identificação do operador autenticado.
7. **Padrão de UX/UI & Design System:**
   - Tipografia contemporânea com fonte `Inter` (`next/font/google`) e escala legível sem micro-textos (piso de 12px para badges e 14px-15px para conteúdo).
   - Sistema global de notificações `ToastProvider` flutuante e acessível (`role="status"`), com auto-dismiss de 4s e erradicação completa de `alert()` nativo do navegador.
   - Componente universal de `Skeleton` com shimmer pulsante para carregamento assíncrono.
   - Cockpit de Topbar com identidade do operador e ganho de 40px de área útil vertical em todas as telas.
   - Central de Operações renovada com 4 KPI Cards vivos, atalhos de 1 clique e radar regulatório militar.
8. **Engenharia de Implantação, SRE & Disaster Recovery:**
   - Orquestração completa de produção com `docker-compose.prod.yml` (PostgreSQL 16, Redis 7, Backend NestJS, Frontend Next.js Standalone e Nginx).
   - Scripts operacionais automatizados em `scripts/`: deploy (`deploy.sh`), backup consistente com SHA-256 (`backup.sh`), restore com confirmação segura (`restore.sh`) e diagnóstico de saúde (`healthcheck.sh`).
   - Runbook detalhado em [`docs/RUNBOOK-IMPLANTACAO-PRODUCAO.md`](./docs/RUNBOOK-IMPLANTACAO-PRODUCAO.md).
9. **Arquitetura Modular Limpa & Erradicação de Monólitos:**
   - **Zero arquivos acima de 400 linhas em todo o monorepo:** teto estrito de ~150–350 linhas por arquivo tanto no backend quanto no frontend.
   - Padrão **Facade** no backend delegando para sub-serviços especializados de responsabilidade única (`commercial/services/`, `inventory/services/`, `auth/services/`, helpers modulares).
   - Clientes de API desacoplados em `src/lib/api/` e workspaces componentizados em subpastas dedicadas em `src/components/{modulo}/`.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 22 ou superior
- Docker & Docker Compose
- npm

### 1. Backend

```bash
cd backend
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:generate
npm run db:deploy
npm run start:dev
```
A API responde em `http://localhost:3000` e a documentação OpenAPI/Swagger em `http://localhost:3000/api/v1/docs`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```
A interface web responde em `http://localhost:3001`. Entre com as credenciais administrativas da Casa de Fogos São João (`admin@casadefogossaojoao.com` ou `demo.admin@local.test` / senha configurada em `DEV_SEED_ADMIN_PASSWORD`).

---

## 🧪 Verificação e Quality Gates

### Backend
```bash
cd backend
npm run lint       # Oxlint estrito (0 erros, 0 avisos)
npm test           # Testes unitários com Vitest (48 testes passando)
npm run test:e2e   # Testes ponta a ponta (46 testes passando em 8 suítes)
npm run build      # Build NestJS de produção
```

### Frontend
```bash
cd frontend
npm run lint       # ESLint (0 erros, 0 avisos)
npm run typecheck  # TypeScript estrito (0 erros)
npm test           # Vitest + Testing Library (81 testes passando em 20 suítes)
npm run build      # Build Next.js 16 de produção (20 rotas SSG/SSR)
```

---

## 📚 Documentação Adicional

- [Status Consolidado de Implementação](./docs/STATUS-IMPLEMENTACAO.md)
- [Oportunidades de Melhoria (backlog para definição)](./docs/OPORTUNIDADES.md)
- [Jornada Operacional Ponta a Ponta (Golden Path)](./docs/JORNADA-OPERACIONAL-E2E.md)
- [Runbook de Implantação e Operação de Produção (SRE)](./docs/RUNBOOK-IMPLANTACAO-PRODUCAO.md)
- [Resumo Detalhado de Funcionalidades](./docs/RESUMO-FUNCIONALIDADES.md)
- [Documentação do Backend](./backend/README.md)
- [Documentação do Frontend](./frontend/README.md)
