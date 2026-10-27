# Frontend SisPiro ERP

[![CI](https://github.com/raalencar/SisPiro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/raalencar/SisPiro/actions/workflows/ci.yml)

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

## Arquitetura de Componentes e Clientes de API

Para assegurar facilidade de manutenção e eliminar arquivos monolíticos (> 1.000 linhas), a base de código do frontend adota duas camadas bem delimitadas:

1. **Clientes de API Especializados (`src/lib/api/`):**
   - A biblioteca de comunicação com a API foi dividida em clientes desacoplados: `auth.api.ts`, `inventory.api.ts`, `commercial.api.ts`, `operations.api.ts`, `finance.api.ts`, `procurement.api.ts`, `customers.api.ts`, `teams.api.ts`, `fiscal.api.ts` e `compliance.api.ts`.
   - O arquivo `src/lib/api.ts` atua como barrel export unificado, preservando as importações em toda a aplicação sem impacto retroativo.

2. **Workspaces Componentizados (`src/components/{modulo}/`):**
   - Os workspaces principais (`commercial-workspace.tsx`, `operations-workspace.tsx`, `inventory-workspace.tsx`, `compliance-workspace.tsx`, `fiscal-workspace.tsx`, `finance-workspace.tsx`, `purchases-workspace.tsx`, `customers-workspace.tsx`) atuam primariamente como **orquestradores de estado e ciclo de vida**.
   - Cada modal, formulário complexo, tabela e aba especializada foi extraído para componentes dedicados com responsabilidade única sob suas respectivas pastas (`components/commercial/`, `components/operations/`, `components/inventory/`, `components/compliance/`, `components/fiscal/`, `components/finance/`, `components/purchases/`, `components/customers/`).

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
   - Lançamentos parcelados (número de parcelas, intervalo em dias ou datas customizadas), com identificação visual de cada parcela por grupo.
   - **Cobrança PIX Dinâmico**: Modal com QR Code de alta resolução em Base64 Data URL, código Copia e Cola EMVCo, chave PIX e botão de simulação de confirmação bancária imediata.
   - **Conciliação Bancária OFX**: Modal de importação de extratos bancários `.ofx` com cards de métricas (créditos, débitos, matches), tabela interativa de conferência com badges de confiança (`EXATO`, `APROXIMADO`, `JÁ CONCILIADO`) e liquidação atômica em lote.

8. **Módulo Fiscal (NF-e, NFC-e, NFS-e) e Faturamento (`/modules/billing`):**
   - Emissão de NF-e (Modelo 55 com chave SEFAZ de 44 dígitos) e NFC-e (Modelo 65) a partir de pedidos de venda fechados.
   - Emissão de NFS-e vinculada a Ordens de Serviço (eventos pirotécnicos) com identificação de Blaster técnico e ART.
   - Listagem com filtros de status e cancelamento homologado com justificativa legal obrigatória.

9. **Compliance Regulatório e Guias de Tráfego do Exército (`/modules/compliance`):**
   - Emissão e rastreio de Guias de Tráfego (R-105 / DFPC / SFPC) com numeração auditada `GT-YYYY/NNNN`.
   - Validação em tempo real de saldo físico de paiol e verificação da habilitação do Blaster e condutor com curso MOPP.
   - Cálculo automático da Massa Líquida de Explosivo Total (NEQ em kg) e visualização do **Espelho Oficial Militar DFPC/COLOG** formatado para fiscalização e impressão.

10. **Controles de apresentação por perfil:**
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
- `/modules/billing` — Faturamento, emissão de NF-e, NFC-e e NFS-e e cancelamento fiscal.
- `/modules/compliance` — Compliance militar, emissão e espelho oficial de Guias de Tráfego (GT).
- `/modules/operations` — Ordens de serviço e eventos pirotécnicos.
- `/modules/finance` — Financeiro, contas a pagar/receber, fluxo de caixa e Aging schedule.

## Verificação e Quality Gates

```bash
npm run lint       # ESLint estrito (zero warnings)
npm run typecheck  # Checagem estrita de tipos com tsc
npm test           # Testes unitários e de componentes com Vitest e Testing Library (81 testes passando)
npm run build      # Build de produção otimizado Next.js (20 rotas otimizadas)
```

## Padrão de Design System & UX/UI

- **Tipografia Moderna:** Fonte contemporânea `Inter` via `next/font/google` com fallback otimizado para o sistema operacional (`--font-inter`).
- **Escala de Texto Padronizada:** Piso tipográfico em 12px (para micro-tags e badges de status) e 14px-15px para dados tabulares e formulários, eliminando textos ilegíveis de 8px/10px.
- **Sistema de Notificações (Toasts):** `ToastProvider` flutuante no canto superior direito com auto-dismiss suave (4s), acessibilidade (`role="status"`, `aria-live="polite"`) e variantes semânticas (`success`, `error`, `warning`, `info`). Chamadas residuais a `alert()` do navegador foram 100% erradicadas.
- **Skeletons de Loading:** Componente `Skeleton` com animação pulsante (*shimmer*) para transições assíncronas suaves em tabelas e cards.
- **Cockpit do AppShell:** Topbar com avatar, nome do operador autenticado, chips de perfis ativos e botão integrado de logout; remoção da faixa estática `.auth-notice`, liberando 40px úteis de altura vertical em todos os módulos.
- **Central de Operações Pirotécnicas (`/`):** Dashboard renovado com 4 KPI Cards vivos (Ordens de Serviço, Guias de Tráfego, Ocupação de NEQ e Faturamento/PIX), atalhos operacionais de 1 clique e radar regulatório de conformidade R-105.
- **Sistema Print-Ready Universal & Espelhos Oficiais Físicos:**
  - Regras `@media print` estritas em `globals.css` para impressão em folha A4 limpa (sem topbars, sidebars, toast containers ou botões de interface).
  - **Espelho Oficial Militar SFPC (R-105):** Modal em `/modules/inventory` formatado para protocolo formal no Exército Brasileiro (DFPC/COLOG), com cabeçalho oficial, dados do CR, consolidação por classe de risco ONU (1.1G, 1.3G, 1.4G), NEQ total e termo de responsabilidade com assinaturas.
  - **Espelho DANFE Simplificada (NF-e/NFC-e):** Modal em `/modules/billing` com chave de acesso de 44 dígitos legível, código de barras simulado em CSS e protocolo SEFAZ.
  - **Ficha Técnica e Ordem de Queima Impressa da OS:** Modal em `/modules/operations` para a equipe técnica de campo (ART, relação de materiais controlados alocados, checklist de segurança e colunas de anotação de disparos e sobras).
  - **Proposta Comercial e Comprovante de Balcão (PDV):** Modais em `/modules/commercial` para orçamentos formais com validade de 7 dias e recibos físicos de entrega no balcão.

## Limitações conhecidas

- Os controles de apresentação por perfil atuam no nível de módulo/tela, não
  de ação individual dentro de uma tela compartilhada por perfis diferentes.
- Smoke tests visuais autenticados das jornadas completas (OS, estoque,
  cadastros, compras, comercial, financeiro) foram executados extensivamente
  contra o backend local, validando fluxo de sessão, responsividade mobile/tablet/desktop,
  focus trap em modais e contraste WCAG AA. Validação cross-browser (Firefox e
  Safari) permanece como teste manual pendente de automação.

## Container de produção

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.dominio-corporativo.com.br \
  --build-arg NEXT_PUBLIC_API_PREFIX=/api/v1 \
  -t erp-pirotecnico-frontend .
```

O Dockerfile usa a saída `standalone` do Next.js (build multi-stage, imagem final
mínima). `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_API_PREFIX` são embutidas no bundle
do cliente em tempo de build, não lidas em runtime pelo container — informe-as
sempre via `--build-arg` ao construir a imagem de produção; sem isso, prevalecem
os defaults de desenvolvimento (`http://localhost:3000`, `/api/v1`). O container
expõe a porta `3001` e serve `node server.js` como usuário não privilegiado
(`node`).

```bash
docker run -p 3001:3001 erp-pirotecnico-frontend
```

Em produção, sirva o container atrás de um proxy/CDN com HTTPS e certificados TLS
válidos (ver [Diretrizes de Segurança](#diretrizes-de-segurança) abaixo).

## Diretrizes de Segurança

As requisições de negócio passam obrigatoriamente pelo BFF do Next.js sob cookies
`HttpOnly` e cabeçalhos `Same-Origin`. Nenhuma credencial sensível ou token de acesso
é exposta ao JavaScript do navegador. Em produção, opere sob conexão criptografada (HTTPS)
com certificados TLS válidos e cookies com flag `Secure`.
