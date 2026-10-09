# Frontend SisPiro ERP

Interface web em Next.js 16 e React 19, em português do Brasil. A integração
usa a API NestJS do diretório `../backend` através de um Backend-for-Frontend (BFF)
completamente seguro baseado em cookies `HttpOnly` e proteção `Same-Origin`.

## Requisitos e execução local

- Node.js 20.9 ou superior e npm
- API e serviços locais configurados conforme [`../backend/README.md`](../backend/README.md)

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost:3001`. Por padrão, o frontend chama a API em
`http://localhost:3000` com prefixo `/api/v1`. Para configurar outra origem,
altere `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_API_PREFIX` em `.env.local`. Essas
variáveis são públicas: não coloque credenciais ou tokens nelas.

## Dados de demonstração

Para visualizar o seed, aplique o seed local conforme a documentação
do backend. Entre com `demo.admin@local.test` e com a senha configurada em
`DEV_SEED_ADMIN_PASSWORD`. Se o MFA estiver ativado, utilize o aplicativo autenticador
(Google Authenticator, Authy, etc.) ou o código de backup correspondente.

## Módulos e Integrações Disponíveis (V1.0)

1. **Autenticação, MFA & Recuperação de Senha:**
   - Login, consulta de sessão ativa (`/api/auth/session`), renovação automática transparente e logout via rotas same-origin do Next.js.
   - Desafio de segundo fator MFA (TOTP de 6 dígitos ou código de recuperação de emergência).
   - Fluxo completo de recuperação de senha ("Esqueci minha senha" e redefinição com token de uso único de 15 minutos via rotas same-origin `/api/auth/password-reset/request` e `/api/auth/password-reset/confirm`), integrado ao painel de acesso com validação de força de senha.
   - Sessão protegida em cookies `HttpOnly`, `SameSite=Lax`, com zero tokens JWT em `localStorage` ou `sessionStorage`.

2. **Estoque e WMS:**
   - Posição consolidada de estoque e cálculo em tempo real de NEQ (Número Equivalente de TNT).
   - Catálogo de produtos, lotes, paióis e histórico de movimentações auditadas.
   - Operações de estoque: recebimento de lote, entrada, saída, ajuste, quarentena, bloqueio, e desmembramento entre paióis (`/inventory/lots/:id/split`).
   - Relatório regulamentar do Mapa Mensal SFPC (R-105) para fiscalização do Exército Brasileiro.

3. **Cadastros Regulamentares (Clientes e Blasters):**
   - **Clientes (`/modules/customers`):** Gestão cadastral completa, validação de CPF/CNPJ, controle de validade do Certificado de Registro (CR), seleção de classes PCE autorizadas (`1.1`, `1.2`, `1.3`, `1.4`) e verificador visual de aptidão para compra de materiais controlados.
   - **Blasters & Equipes (`/modules/teams`):** Registro de responsáveis técnicos, controle de carteira profissional e teste de aptidão operacional para eventos pirotécnicos.

4. **Compras e Fornecedores (`/modules/purchases`):**
   - Cadastro e verificação de fornecedores homologados com CR.
   - Emissão e acompanhamento de pedidos de compra (`PENDENTE`, `PARCIAL`, `RECEBIDO`, `CANCELADO`).
   - Recebimento físico de lotes com validação atômica de capacidade NEQ do paiol e lançamento financeiro automático de Contas a Pagar.

5. **Comercial, PDV e Orçamentos (`/modules/sales`):**
   - Gestão de Tabelas de Preço por canal e Campanhas Promocionais (desconto percentual ou preço fixo promocional com controle de vigência).
   - Orçamentos comerciais com reserva atômica de estoque por 7 dias, **edição completa (`PUT /sales/quotes/:id`)**, disparo assíncrono por e-mail via fila BullMQ e conversão direta em venda.
   - Ponto de Venda (PDV): Checkout imediato de balcão (produtos não PCE) e vendas a prazo com regras financeiras.
   - Devoluções de mercadorias parciais/totais com reentrada imediata no lote de estoque e reconciliação financeira.
   - Relatórios analíticos de vendas brutas/líquidas e taxa de conversão de orçamentos com ticket médio.

6. **Operações e Ordens de Serviço (`/modules/operations`):**
   - Gestão do ciclo de vida de espetáculos: Orçamento -> Aprovação (reserva atômica com validação de cliente e blaster habilitado) -> Montagem -> Conclusão / Cancelamento seguro.
   - **Edição de orçamento de OS (`PUT /operations/orders/:id`)** antes da aprovação.
   - Registro de quantidades disparadas e lançamento automático no Contas a Receber no encerramento.

7. **Financeiro, Fluxo de Caixa e Aging Schedule (`/modules/finance`):**
   - Gestão integral de Contas a Pagar e Contas a Receber com filtros por direção, status e vencimento.
   - Destaque visual de títulos vencidos (`overdue`) e histórico de amortizações.
   - Modal de quitação / pagamentos parciais com seleção de método (PIX, Dinheiro, Boleto, Cartão, Transferência).
   - Demonstrativo de Fluxo de Caixa Realizado diário com totais de entradas, saídas e saldo operacional líquido.
   - Relatório analítico de Aging Schedule (cronograma de vencimento e risco de inadimplência em 5 faixas: A Vencer, 1-30d, 31-60d, 61-90d, >90d).

8. **Controles de apresentação por perfil:**
   - Itens de navegação para módulos fora do perfil do usuário (`ESTOQUE`, `COMERCIAL`, `OPERACOES`, `COMPRAS`, `FINANCEIRO`; `ADMIN` sempre tem acesso) aparecem visualmente desabilitados, e o acesso direto por URL mostra uma tela de "Acesso restrito" (`src/lib/modules.ts`, `src/components/app-shell.tsx`).
   - Granularidade por módulo/tela, não por botão ou operação individual. A autorização final de toda regra de negócio continua exclusivamente no backend.

## Rotas da Interface

- `/` — Visão geral e atalhos rápidos do sistema.
- `/modules/inventory` — Estoque, paióis, lotes, quarentena e Mapa SFPC.
- `/modules/products` — Catálogo unificado de produtos e insumos pirotécnicos.
- `/modules/customers` — Clientes e conformidade de CR / classes autorizadas.
- `/modules/teams` — Blasters habilitados e equipes de espetáculo.
- `/modules/purchases` — Compras, fornecedores e recebimento físico.
- `/modules/sales` — Comercial, tabelas de preço, promoções, orçamentos e PDV.
- `/modules/operations` — Ordens de serviço e eventos pirotécnicos.
- `/modules/finance` — Financeiro, contas a pagar/receber, fluxo de caixa e Aging schedule.

## Verificação e Quality Gates

```bash
npm run lint       # ESLint estrito (zero warnings)
npm run typecheck  # Checagem estrita de tipos com tsc
npm test           # Testes unitários e de componentes com Vitest e Testing Library (jsdom)
npm run build      # Build de produção otimizado Next.js
```

## Limitações conhecidas

- Os controles de apresentação por perfil atuam no nível de módulo/tela, não
  de ação individual dentro de uma tela compartilhada por perfis diferentes.
- Smoke test visual autenticado das jornadas completas (OS, estoque,
  cadastros novos) contra o seed local ainda não foi realizado nesta
  entrega.

## Diretrizes de Segurança

As requisições de negócio passam obrigatoriamente pelo BFF do Next.js sob cookies
`HttpOnly` e cabeçalhos `Same-Origin`. Nenhuma credencial sensível ou token de acesso
é exposta ao JavaScript do navegador. Em produção, opere sob conexão criptografada (HTTPS)
com certificados TLS válidos e cookies com flag `Secure`.
