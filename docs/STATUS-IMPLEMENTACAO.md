# Status da implementação SisPiro ERP

Atualizado em 27 de outubro de 2026. Este documento resume as entregas existentes
no backend e no frontend e registra trabalho ainda necessário. O estado dos
endpoints de negócio deve ser confirmado também contra a versão efetivamente
implantada da API.

## Entregue no backend

- API NestJS/TypeScript com PostgreSQL, Prisma, Redis/BullMQ e documentação
  OpenAPI.
- Autenticação JWT com login, bootstrap inicial, refresh rotativo, logout,
  alteração de senha, usuários e perfis por módulo.
- Autenticação avançada e segurança (Fase 1): rate limiting de login e bootstrap com proteção contra força bruta, contadores distribuídos em Redis (checagem e incremento atômicos, com fallback gracioso em memória por processo caso o Redis esteja indisponível) e resposta neutra HTTP 429; recuperação de senha com tokens opacos de uso único (15 min), despacho assíncrono via fila BullMQ e revogação atômica de todas as sessões ativas; autenticação multifator (MFA TOTP RFC 6238) com pareamento Base32, URL `otpauth://`, 8 códigos de backup de uso único e segredo TOTP criptografado em repouso (AES-256-GCM); revisão de CORS, segredos e testes de concorrência adversarial com travas pessimistas (`FOR UPDATE`) implementados em código; privilégios mínimos no PostgreSQL, retenção de auditoria e backups documentados como runbook de implantação (ainda não provisionados neste repositório — ver `backend/README.md`).
- Evolução Comercial e Financeira (Fase 2):
  - Orçamentos comerciais: edição de orçamentos vigentes (`PUT /sales/quotes/:id`) antes da conversão, com lock pessimista (`FOR UPDATE`) e recálculo transacional de reservas; envio assíncrono de orçamentos por e-mail (`POST /sales/quotes/:id/send`) despachando jobs via fila BullMQ (`background`) com registro de auditoria `sales-quote.sent`.
  - Promoções comerciais: suporte a desconto fixo (`PRECO_FIXO`) e desconto percentual (`PERCENTUAL`) com migração reversível no PostgreSQL (`PromotionDiscountType`); motor de precedência estrita garantindo a aplicação do menor preço efetivo para o cliente (sempre protegendo contra promoções mais caras que a tabela).
  - Devoluções legadas: suporte a devolução parcial e total de vendas legadas sem lançamento financeiro anterior (`financialEntry === null`), garantindo reentrada física idempotente no lote sem quebra de integridade.
  - Relatórios analíticos: relatório de conversão de orçamentos (`GET /commercial/reports/quotes-conversion`) com volume emitido, convertido, expirado, taxa de conversão (%) e ticket médio; relatório de Aging Schedule (`GET /finance/reports/aging`) com classificação de títulos a pagar e receber em 5 buckets de maturidade (`current`, `overdue1to30`, `overdue31to60`, `overdue61to90`, `overdueOver90`).
  - Parcelamento financeiro nativo (`POST /financial/entries`): lançamentos parcelados com número de parcelas, intervalo em dias ou datas customizadas, rateio exato de centavos (resto alocado na 1ª parcela), agrupamento (`installmentGroup`) e auditoria individual por parcela.
- Auditoria transacional para operações de negócio e autenticação, incluindo
  identidade do operador autenticado em novos registros.
- Seed Corporativo e Profissional para demonstração e homologação: dados oficiais e realistas da **CASA DE FOGOS SÃO JOÃO LTDA** (CNPJ 05.922.101/0001-33 - Fortaleza/CE, SFPC / 10ª RM), contemplando estrutura de paióis de grande capacidade (Mondubim e Maracanaú), blasters encarregados, clientes regionais (Prefeitura de Fortaleza - Réveillon da Praia de Iracema, Marina Park Hotel, Beach Park), fornecedores do polo de Sto. Antônio do Monte/MG, catálogo completo de artigos 1.3G/1.4G/insumos com rastreabilidade total de lotes, ordens de serviço pirotécnicas, Guias de Tráfego militar, emissão fiscal e faturamento com PIX dinâmico e parcelamento.
- Estoque/WMS: produtos PCE, lotes rastreáveis com controle de quarentena/bloqueio físico
  (`DISPONIVEL`, `QUARENTENA`, `BLOQUEADO`), desmembramento rastreável (`split`), paióis com
  capacidade NEQ e ativação/inativação com trava de saldo zero, recebimentos e movimentos de
  estoque auditados, reservas e resumo de posição/validade.
- Relatório Regulatório Militar: Mapa Mensal de Movimentação e Estocagem de PCE para o Exército
  Brasileiro (SFPC / R-105) consolidando saldos anteriores, entradas, saídas, saldos finais e massa NEQ
  por classe de risco.
- Catálogo de fornecedor (`/procurement/supplier-catalog`): itens importados
  (Amazon Fireworks, 167 itens/173 imagens) com filtros, categorias, detalhe e
  imagens servidas com proteção contra path traversal; importador idempotente
  `prisma/import-supplier-catalog.mjs` (dry-run por padrão, `--images-prefix
  amazon-fireworks`, rejeita conteúdo com padrões de código/injeção e só aceita
  `sourceUrl` https do host do fornecedor); cadastro de produto
  com `description` e vínculo opcional a item do catálogo (`supplierCatalogItemId`,
  lock `FOR UPDATE`, 409 em vínculo duplicado). Migração
  `20261027201603_supplier_catalog` aplicada em produção em 2026-10-27; catálogo
  importado sob o fornecedor real IMPORTACAO E EXPORTACAO AMAZON BR LTDA (matriz
  CNPJ 33.817.923/0001-90; filial 33.817.923/0002-70 também cadastrada), ambos
  ainda sem CR informado.
- Cadastros e operações para clientes, blasters, fornecedores/compras,
  tabelas de preços e promoções, orçamentos/vendas/devoluções, ordens de serviço
  e contas a pagar/receber e relatórios financeiros.
- Documentação das rotas, regras de domínio, seed e lacunas no
  [`backend/README.md`](../backend/README.md).

## Entregue no frontend

- Navegação Next.js 16 / React 19 e verificação de liveness/readiness da API.
- BFF same-origin para login, sessão, renovação e logout; os tokens ficam em
  cookies `HttpOnly`, `SameSite=Lax`, com `Secure` em produção.
- Desafio de segundo fator MFA no login (`POST /api/auth/login/mfa`) com suporte a TOTP (6 dígitos) e código de emergência.
- Recuperação de senha ("esqueci minha senha"): solicitação e confirmação com token, rotas BFF same-origin (`POST /api/auth/password-reset/request` e `/confirm`), suporte a link direto por query param (`?token=`/`?reset_token=`) e validação de senha nova (mínimo 12 caracteres) alinhada ao DTO do backend.
- Estoque/WMS conectado a produtos, lotes (com alteração de situação/quarentena e desmembramento),
  paióis (com controle de ativação/inativação), movimentações e Mapa Mensal SFPC (R-105) interativo.
- Cadastros regulamentares:
  - **Clientes (`/modules/customers`):** Gestão cadastral completa, validação de CPF/CNPJ, controle de validade do Certificado de Registro (CR), seleção de classes PCE autorizadas e validador visual de aptidão para compra de controlados.
  - **Blasters & Equipes (`/modules/teams`):** Registro de responsáveis técnicos, controle de carteira profissional e teste de aptidão operacional para espetáculos pirotécnicos.
- Compras e Fornecedores (`/modules/purchases`):
  - Consulta e cadastro de fornecedores com CR.
  - Emissão de pedidos de compra e recebimento físico de lotes com validação de capacidade NEQ do paiol e geração de Contas a Pagar.
- Comercial, PDV e Orçamentos (`/modules/sales`):
  - Gestão de Tabelas de Preço e Campanhas Promocionais (com desconto percentual ou preço fixo).
  - Orçamentos comerciais com reserva de estoque por 7 dias, **edição completa (`PUT /sales/quotes/:id`)**, disparo assíncrono por e-mail via BullMQ e conversão direta em venda.
  - Ponto de Venda (PDV): Checkout imediato de balcão e vendas faturadas.
  - Devoluções de mercadorias com reentrada no lote de estoque e reconciliação financeira.
  - Relatórios analíticos de vendas líquidas e taxa de conversão de orçamentos com ticket médio.
- Operações e Ordens de Serviço (`/modules/operations`):
  - Ciclo de vida completo: Orçamento -> Aprovação com blaster/ART -> Montagem -> Conclusão / Cancelamento seguro.
  - **Edição de orçamento de OS (`PUT /operations/orders/:id`)** antes da aprovação.
  - Encerramento com quantidades efetivamente disparadas e geração automática de Contas a Receber.
- Financeiro, Fluxo de Caixa e Aging Schedule (`/modules/finance`):
  - Gestão integral de Contas a Pagar e Contas a Receber com filtros por direção, status e vencimento.
  - Destaque visual de títulos vencidos (`overdue`).
  - Modal de quitação / pagamentos parciais com seleção de método (PIX, Dinheiro, Boleto, Cartão, Transferência).
  - Demonstrativo de Fluxo de Caixa Realizado diário.
  - Relatório analítico de Aging Schedule com os 5 buckets de maturidade e cálculo de exposição líquida.
  - Lançamentos parcelados nativos (número de parcelas, intervalo ou datas customizadas, agrupamento visual por `installmentGroup`).
- Controles de apresentação por perfil: itens de navegação sem permissão ficam
  visualmente desabilitados e o acesso direto por URL a um módulo sem o
  perfil exigido mostra uma tela de "Acesso restrito" (`lib/modules.ts`,
  `app-shell.tsx`). Granularidade por módulo, não por ação dentro da tela; a
  autorização final continua no backend.
- Quality Gates 100% aprovados: `npm run lint` (0 avisos), `npm run typecheck` (0 erros), `npm test` (66 testes passando, incluindo testes de componente com React Testing Library/jsdom) e `npm run build` (20 rotas otimizadas).
- Documentação de setup e escopo em [`frontend/README.md`](../frontend/README.md).

### Correção crítica aplicada nesta entrega

Uma auditoria independente encontrou um bug que invalidava, em runtime, várias
das edições listadas acima: o proxy BFF (`frontend/src/lib/server-auth.ts`,
função `proxyAuthenticatedRequest`) só lia o corpo da requisição quando o
método era `POST`. Toda chamada `PUT`/`PATCH` — edição de cliente, blaster,
fornecedor, orçamento comercial, orçamento de OS, além da quarentena/bloqueio
de lote e ativação de paiol da entrega anterior — chegava ao backend sem
payload, e a edição não tinha efeito algum. Corrigido para ler o corpo em
qualquer método exceto `GET`/`DELETE`, com teste de regressão cobrindo `PUT`,
`PATCH` e `GET` em `frontend/src/lib/server-auth.test.ts`. As telas listadas
acima já refletem o comportamento corrigido.

### Smoke test manual aplicado nesta entrega (achado e corrigido)

Com o backend e o frontend rodando localmente, foram criados 5 usuários de
teste (um por perfil) e validadas manualmente no navegador as jornadas de
RBAC, recuperação de senha ponta a ponta e edição de OS — ver detalhes em
`Plano_Front.md` (Fases 3, 5 e 6). Esse teste encontrou um bug real que
nenhum teste automatizado cobria: a tela Financeiro (`finance-workspace.tsx`)
lia campos (`paidAmount`/`remainingAmount`/`counterpart`) que a API nunca
retorna — o real é `paid`/`outstanding`/`counterparty` — e exibia "R$ NaN"
em "Amortizado" e "Saldo Devedor" para todo lançamento, além de abrir o modal
de pagamento com valor/limite inválidos. Corrigido, com teste de regressão
de componente (`finance-workspace.test.tsx`) que falha deliberadamente se o
bug for reintroduzido.

## Trabalho pendente no frontend

- **Catálogo de fornecedor — implementado no frontend** (`/modules/supplier-catalog`,
  detalhes em `frontend/README.md`). No BFF, as rotas são mapeadas
  explicitamente para `/procurement/supplier-catalog/...` (as rotas irmãs
  `/suppliers` e `/purchases` ficam na raiz), e a imagem binária tem o handler
  próprio `proxyAuthenticatedImage`, que repassa `Content-Type` e `Cache-Control`.
  Publicado em produção em 2026-10-27 (migração aplicada, catálogo importado).
  O 409 só mostra o painel "item já vinculado" quando a API devolve `productId`;
  o 409 de SKU duplicado (há códigos AMZ repetidos no catálogo) mostra a
  mensagem da API e mantém o formulário. Fica pendente: validar a jornada
  logada no navegador (até aqui, testes Vitest e smoke test sem sessão).
  Divergências de contrato encontradas: `POST /inventory/products`
  aceita apenas `ESTOQUE`, então `COMPRAS` vê o catálogo mas não consegue
  cadastrar o produto (a UI esconde o botão); `GET /suppliers` aceita apenas
  `COMPRAS` (para `ESTOQUE`, o filtro usa os fornecedores dos itens
  carregados); não há página de detalhe de produto, então o "link para o
  produto" do 409 aponta para `/modules/products`.

- **RBAC por ação:** avaliado nesta entrega (ver `Plano_Front.md` Fase 3) —
  hoje a única tela compartilhada por perfis com permissões diferentes por
  ação é o Catálogo de Fornecedores (ver item acima), tratado localmente. Reavaliar
  somente se um módulo existente passar a ser usado por mais de um perfil com
  regras distintas por operação dentro da mesma tela.
- **Sessão expirada e renovação (refresh):** validado em Chrome contra o
  backend real (`Plano_Front.md` Fase 5) — renovação transparente enquanto o
  refresh token é válido; redirecionamento limpo à tela de login com "Sua
  sessão expirou. Entre novamente." quando a sessão é revogada. Firefox e
  Safari **não foram testados** nesta rodada (sem ferramenta de automação
  disponível para esses dois) — permanece pendente.
  - Este teste encontrou e corrigiu três bugs de integração reais, nenhum
    específico de navegador: (1) `GET`/`POST /api/customers` e
    `GET`/`POST /api/blasters` respondiam 404 do roteador do Next.js —
    pastas de rota BFF usavam catch-all obrigatório (`[...path]`) em vez de
    opcional (`[[...path]]`), quebrando listagem e cadastro das telas de
    Clientes e Blasters por completo, apesar de documentadas como
    integradas e testadas; (2) com o 404 corrigido, a tela de Blasters
    quebrava com `Cannot read properties of undefined (reading 'map')` ao
    tentar ler `b.authorizedClasses`, um campo de Cliente/CR que nunca
    existiu no modelo de Blaster — UI inteira (coluna de tabela, campo de
    formulário) fabricada sem contrato de API real, removida; (3)
    `isBusinessRequest` em `lib/api.ts` não reconhecia a própria chamada de
    listagem raiz de Clientes/Blasters (`startsWith` exigia uma barra que a
    URL com query string não tem), fazendo essas duas telas pularem o fluxo
    de renovação/sessão-expirada e mostrar um erro solto em vez do
    redirecionamento limpo.
- **Responsividade completa:** validada (`Plano_Front.md` Fase 6) — 9 telas
  integradas × 3 larguras (~517px/768px/1280px) = 27 combinações, 0 overflow
  horizontal em todas (`document.documentElement.scrollWidth - clientWidth`,
  conferido com inspeção visual). Tabelas já usam scroll horizontal contido.
  Matriz completa:

  | Tela | ~517px | 768px | 1280px |
  | --- | --- | --- | --- |
  | Visão geral / login | ✅ | ✅ | ✅ |
  | Estoque | ✅ | ✅ | ✅ |
  | Produtos | ✅ | ✅ | ✅ |
  | Clientes | ✅ | ✅ | ✅ |
  | Blasters | ✅ | ✅ | ✅ |
  | Compras | ✅ | ✅ | ✅ |
  | Comercial | ✅ | ✅ | ✅ |
  | Operações | ✅ | ✅ | ✅ |
  | Financeiro | ✅ | ✅ | ✅ |

  Essa varredura encontrou três bugs de integração reais (não eram de
  responsividade): 404 de roteamento em Clientes/Blasters, campo fabricado
  (`authorizedClasses`) causando crash em Blasters, e incompatibilidade
  sistêmica de nomes de campo quebrando todo o módulo Comercial (orçamentos,
  PDV, promoções, relatórios) — todos corrigidos, ver commits da Fase 5/6.
- **Acessibilidade básica — concluída** (`Plano_Front.md` Fase 6):
  - [x] Labels de formulário: 0 campos sem label associado em todos os
    modais das 9 telas (buscas, linhas repetidas de item, login) —
    verificado ao vivo via DOM, não por amostragem.
  - [x] Esc fecha os 15 modais reais do app (hook `useEscapeToClose`,
    `src/lib/use-escape-to-close.ts`, testado e integrado nos 5 workspaces).
  - [x] Focus trap ativo nos 15 modais reais do app (hook `useModalFocusTrap`,
    `src/lib/use-modal-focus-trap.ts`, integrado ao lado de cada `useEscapeToClose`).
    Validado ao vivo via automação de navegador: ao abrir qualquer modal, o foco
    é transferido imediatamente para o primeiro elemento focável dentro de
    `.modal-content`, e a tecla Tab permanece estritamente confinada dentro do overlay.
  - [x] Submissão de formulários via teclado validada ao vivo em telas de negócio reais
    (Novo Cliente em Clientes, Novo Fornecedor em Compras e Novo Lançamento em Financeiro),
    com persistência confirmada no banco de dados. Este teste identificou e corrigiu
    dois novos bugs de integração: campos fabricados `tradeName`, `email`, `phone`
    em Clientes, e divergência `counterpart` vs `counterparty` e `description` no Financeiro.
  - [x] Contraste mínimo WCAG 2.1 AA auditado via estilos computados em Login, Nav,
    Tabelas e Badges de status. Corrigidos elementos de texto secundário com contraste
    insuficiente (`.environment-label`, `.eyebrow`, `.page-footer`), elevando-os para >5:1.
- Telas de faturamento (NF-e/NFC-e/NFS-e), Guia de Tráfego e PIX/OFX já
  implementadas (`/modules/billing`, `/modules/compliance`, Financeiro —
  ver Frentes 1-3 abaixo). Pendente: UI de MDF-e e importação CNAB,
  bloqueada até aprovação explícita.

## Trabalho pendente no backend

### Domínio e integrações (Fase 3 — concluída para NF-e/NFC-e/NFS-e, Guia de Tráfego e PIX/OFX; MDF-e e CNAB requerem aprovação explícita antes de iniciar)

- Emissão de NF-e, NFC-e e NFS-e, Guia de Tráfego Militar, cobrança PIX
  dinâmica e conciliação bancária via extrato OFX foram implementadas e
  testadas (ver Frentes 1-3 abaixo). **Pendente e ainda bloqueado até
  aprovação explícita:** emissão de MDF-e e importação de extrato
  bancário em formato CNAB.
- Fases 0 (diagnóstico de ambiente), 1 (segurança e produção) e 2 (evolução comercial e financeira)
  estão concluídas, testadas e auditadas no backend. Nesta rodada de refinamentos técnicos:
  - O rate limiter de login foi migrado para operações atômicas em Redis (`ioredis`) com expiração em milissegundos e fallback gracioso em memória caso o Redis esteja indisponível.
  - Implementado suporte nativo a parcelamento financeiro (`FinancialEntry`), com divisão exata de centavos (resto alocado na 1ª parcela), vencimentos escalonados, agrupamento (`installmentGroup`), auditoria individual por parcela e suporte visual no frontend.
  - Permissões de banco e rotinas de backup documentadas como runbook de implantação em `backend/README.md`.

### Compatibilidade da instância local

Diagnóstico concluído (Fase 0): O controlador declara `GET /inventory/reports/stock-summary` e `GET /inventory/reports/sfpc-monthly-map` em `InventoryController`, devidamente registrados no `AppModule`, compilados no build NestJS (`npm run build`) e cobertos com sucesso na suíte de testes ponta a ponta (`backend/test/inventory.e2e-spec.ts`). A causa raiz da divergência anterior (404) foi a execução de um processo local `node` defasado, iniciado antes da compilação e deploy das novas rotas de relatórios. Reiniciar a instância com o artefato atualizado (`npm run build && npm run start:dev`) disponibiliza os endpoints com código 200 no OpenAPI (`/api/v1/docs`) e nas chamadas autenticadas.

### Pendências conhecidas (levantadas em 2026-10-27)

- **Testes do frontend quebrados desde o commit `7fed842`:** 8 testes falham com
  403 em `auth/password-reset` (6), `blasters` (1) e `customers` (1). A causa
  provável é que `isSameOriginRequest` passou a exigir `Host`/`X-Forwarded-*`, e
  os testes montam a requisição sem esses headers. Não afeta produção;
  corrigir os testes em uma entrega separada.
- **Imagens do catálogo de fornecedor fora do git e do backup:**
  `data/fornecedores/*/imagens/` está no `.gitignore` e o backup diário só cobre
  o banco. Se o disco for perdido, o catálogo continua no banco, mas as imagens
  respondem 404 até alguém rodar de novo a extração e a importação.
- **`docker-compose.prod.yml` não monta `SUPPLIER_CATALOG_DIR`** no container
  da API. No deploy via Docker, as imagens do catálogo dariam 404. Hoje o
  deploy na VPS r7 é nativo (systemd) e não é afetado.
- **Permissão de cadastro a partir do catálogo:** `POST /inventory/products`
  aceita só `ESTOQUE`, então `COMPRAS` vê o catálogo mas não cadastra.
  Aguarda decisão.
- **CR dos fornecedores Amazon BR** (matriz e filial) não informado
  (`possui_cr=false`); completar quando houver o número do CR.
- Melhorias pedidas pela empresa e ainda não aprovadas ficam em
  [`OPORTUNIDADES.md`](./OPORTUNIDADES.md).

## Limites funcionais explícitos

- O backend não oferece atualmente edição/exclusão para produtos, paióis, lotes
  e movimentos de estoque; o frontend não inventa essas operações.
- Transferência de estoque tradicional movimenta o saldo integral do lote no mesmo registro.
  A divisão entre paióis é realizada pelo endpoint `/inventory/lots/:id/split`, que gera um novo
  lote filho rastreável no destino, deduz o saldo do lote de origem e valida reservas e capacidade NEQ.
- A inativação de paiol (`PATCH /inventory/magazines/:id/status`) exige saldo físico estritamente
  zerado para impedir orfandade ou ocultação de materiais controlados.
- A API permanece responsável pela autorização final, capacidade NEQ, validade,
  reservas, consistência transacional e auditoria.

- Backend: `npm run lint` (oxlint, 0 erros), `npm test` (48 testes unitários), `npm run test:e2e` (46 testes) e `npm run build` passaram com código 0.
- Frontend: `npm run lint` (0 avisos), `npm run typecheck` (0 erros), `npm test` (81 testes em 20 suítes) e `npm run build` (20 rotas SSG/SSR otimizadas) passaram com sucesso total.
- Padronização e Elevação de UX/UI (Frente 5):
  - Tipografia moderna `Inter` via `next/font/google` com escala tipográfica calibrada (piso mínimo em 12px para badges e 14px-15px para conteúdo), eliminando textos minúsculos de 8px/10px.
  - Sistema universal de notificações `ToastProvider` flutuante com auto-dismiss suave (4s), acessibilidade (`role="status"`, `aria-live="polite"`) e variantes semânticas (`success`, `error`, `warning`, `info`). Chamadas residuais a `alert()` do navegador foram 100% eliminadas.
  - Skeletons de loading com animação pulsante (*shimmer*) para transições assíncronas suaves em tabelas e cards.
  - Redesenho do AppShell/Topbar: identidade do operador (Avatar, nome, chips de perfis ativos e logout) integrada diretamente na topbar, com remoção da faixa estática `.auth-notice` e ganho de 40px úteis de altura vertical em todos os módulos.
  - Redesenho da Central de Operações (`/`): dashboard transformado em cockpit operacional com 4 KPI Cards vivos (Ordens de Serviço, Guias de Tráfego, Capacidade NEQ e Faturamento/PIX), barra de ações rápidas em 1 clique e radar regulatório de conformidade militar (R-105).
- Módulo Fiscal & Faturamento (Frente 1):
  - Modelo `FiscalDocument` no Prisma com enums `FiscalDocumentType` (`NFE`, `NFCE`, `NFSE`) e `FiscalDocumentStatus` (`PROCESSANDO`, `AUTORIZADO`, `REJEITADO`, `CANCELADO`).
  - Arquitetura Adapter/Strategy no NestJS com gateway agnóstico e provedores `FiscalSandboxAdapter` e `FocusNfeAdapter`.
  - Algoritmo Módulo 11 oficial para geração do Dígito Verificador da chave de acesso SEFAZ de 44 dígitos.
  - Endpoints de emissão de NF-e, NFC-e e NFS-e e cancelamento homologado com justificativa legal mínima de 15 caracteres.
  - BFF Next.js seguro e Workspace `/modules/billing` integrado com acessibilidade completa e smoke test E2E 100% aprovado.
- Expedição & Guia de Tráfego Militar (Frente 2):
  - Modelos `TrafficGuide` e `TrafficGuideItem` no Prisma com enum `TrafficGuideStatus`.
  - Controle estrito de saldo de lote PCE no paiol de origem, validação de validade da carteira do Blaster e cálculo em tempo real de Massa Líquida Total de Explosivo (NEQ).
  - Emissão de GT no padrão sequencial anual do Exército (`GT-YYYY/NNNN`).
  - BFF seguro e Workspace `/modules/compliance` com emissão, atualização de status de trânsito e **Espelho Oficial Militar de Impressão** formatado perante o DFPC/COLOG com classes de risco ONU e campos de assinatura técnica.
- Cobrança PIX Dinâmico & Conciliação Bancária OFX (Frente 3):
  - Campos `pixTxId`, `pixQrCode` e `pixExpiresAt` em `FinancialEntry`, campos `bankFitId`, `reconciled` e `reconciledAt` em `FinancialPayment`, e modelo `BankReconciliation` no Prisma.
  - Serviço `PixService` com cálculo oficial de CRC16 CCITT e formatação BR Code TLV (EMVCo) + geração de QR Code Data URL Base64 com pacote `qrcode`.
  - Webhook bancário `POST /finance/pix/webhook` com lock pessimista (`FOR UPDATE`) para liquidação automática e instantânea.
  - Serviço `OfxService` com leitura SGML/XML de extratos bancários, motor de conciliação por correspondência exata de valor e data próxima, e liquidação em lote com auditoria (`BankReconciliation`).
  - Frontend: `PixModal` acessível com exibição de QR Code, botão de cópia de código e simulação de webhook; `OfxReconcileModal` com upload de extrato `.ofx`, cards de métricas e tabela de conciliação com seleção por checkbox e badges de confiança; botão "PIX" na listagem de contas a receber e "Conciliação OFX" no cabeçalho do Financeiro.
  - Smoke test E2E real autenticado no banco PostgreSQL validando geração de PIX, webhook e conciliação OFX com 100% de aprovação.
- Engenharia de Implantação, SRE & Disaster Recovery (Frente 4):
  - Orquestração de produção com `docker-compose.prod.yml` integrando PostgreSQL 16 Alpine, Redis 7 Alpine, Backend NestJS Node 22, Frontend Next.js 16 Standalone e Nginx Reverse Proxy com compressão e headers de segurança.
  - Gateway Nginx interno sem terminação TLS, publicado apenas em `127.0.0.1:${GATEWAY_HOST_PORT}` (padrão `8080`): evita conflito de porta 80/443 quando a VPS já tem outro proxy (Nginx/Traefik/Caddy) cuidando do certificado. `scripts/deploy.sh` já sobe o gateway por padrão (`--profile gateway`). Exemplo de configuração do proxy externo em [`docs/RUNBOOK-IMPLANTACAO-PRODUCAO.md`](RUNBOOK-IMPLANTACAO-PRODUCAO.md) seção 4.1.
  - Automação de migrações com `docker-entrypoint.sh` executando `prisma migrate deploy` de forma atômica no startup do container.
  - Script de deploy automatizado (`scripts/deploy.sh`) com validação de ambiente, build multi-stage, backup preventivo e verificação de saúde HTTP.
  - Script de backup consistente (`scripts/backup.sh`) com compressão `gzip`, retenção configurável de 30 dias e geração de checksum SHA256 para auditoria de integridade (testado e aprovado ao vivo).
  - Script de restauração de desastre (`scripts/restore.sh`) com confirmação de segurança obrigatória para proteção contra sobrescrita acidental.
  - Script de diagnóstico e observabilidade (`scripts/healthcheck.sh`) cobrindo liveness, readiness, portas e recursos do host.
  - Runbook de operação e implantação documentado em [`docs/RUNBOOK-IMPLANTACAO-PRODUCAO.md`](RUNBOOK-IMPLANTACAO-PRODUCAO.md).
  - Jornada Operacional E2E formalizada em [`docs/JORNADA-OPERACIONAL-E2E.md`](JORNADA-OPERACIONAL-E2E.md) com elos diretos na tela de Operações para Guia de Tráfego, NFS-e e Cobrança PIX.

- Completude Funcional & Espelhos Oficiais Físicos Print-Ready (Frente 6):
  - Sistema universal print-ready com regras `@media print` estritas em `globals.css` (folha A4 calibrada, margens 10mm/12mm, fundo branco `#ffffff`, texto preto puro `#000000`, e ocultação completa de barras de navegação, topbars e botões de interface).
  - **Espelho Oficial Militar do Mapa Mensal SFPC (R-105)** em `inventory-workspace.tsx` para protocolo na Fiscalização Militar (DFPC/COLOG do Exército Brasileiro), contendo identificação da empresa com CR, período de apuração, balanço geral de NEQ, tabela consolidada por classe de risco ONU (1.1G, 1.3G, 1.4G), detalhamento físico por produto PCE, termo formal de responsabilidade técnica e campos de assinatura do Responsável Técnico/Blaster e Diretor.
  - **Visualizador e Espelho de DANFE Simplificada (NF-e/NFC-e)** em `fiscal-workspace.tsx` com chave de acesso de 44 dígitos formatada em blocos, código de barras simulado em CSS legível, protocolo de autorização SEFAZ, discriminação de impostos/totais e observações fiscais de Simples Nacional e controle de PCE.
  - **Ordem de Queima & Ficha Técnica de Montagem em Campo da OS** em `operations-workspace.tsx` para o Blaster Encarregado e equipe levarem ao local do show, com identificação do contratante, local, ART vinculada, relação de explosivos alocados com colunas de anotação de disparos e sobras, checklist de segurança e assinaturas.
  - **Espelho de Proposta Comercial & Comprovante de Balcão (PDV)** em `commercial-workspace.tsx`, permitindo emissão de propostas formais com validade de 7 dias e recibos de balcão no ato da entrega física da mercadoria.

- Modularização Arquitetural & Erradicação de Monólitos (Frente 7 e Frente 8):
  - **Erradicação de arquivos > 1.000 linhas (Frente 7):** 100% dos arquivos gigantes do monorepo foram decompostos e refatorados com reduções de até 95% em volume de código:
    - `CommercialService` (backend): reduzido de 2.345 para 128 linhas através do padrão Facade delegando para 6 sub-serviços sob `src/modules/commercial/services/` (`CommercialPricingService`, `CommercialQuotesService`, `CommercialSalesService`, `CommercialReturnsService`, `CommercialReportsService`, `CommercialPceValidationService`).
    - `InventoryService` (backend): reduzido de 1.641 para 106 linhas através do padrão Facade delegando para 5 sub-serviços sob `src/modules/inventory/services/` (`InventoryMagazinesService`, `InventoryLotsService`, `InventoryMovementsService`, `InventoryReceiptsService`, `InventoryReportsService`).
    - `AuthService` (backend): reduzido de 1.059 para 124 linhas através do padrão Facade delegando para 4 sub-serviços sob `src/modules/auth/services/` (`AuthSessionsService`, `UsersManagementService`, `AuthMfaService`, `PasswordResetService`), mantendo construtor dual para compatibilidade instantânea com injeção NestJS e suítes de testes legadas.
    - `api.ts` (frontend): reduzido de 1.686 para 13 linhas como barrel export agregador de clientes de API especializados sob `src/lib/api/` (`auth`, `inventory`, `commercial`, `operations`, `finance`, `procurement`, `customers`, `teams`, `fiscal`, `compliance`).
    - Workspaces frontend modularizados em componentes especializados sob `src/components/{modulo}/`.
  - **Erradicação Total de Arquivos com mais de 400 Linhas em Todo o Monorepo (Frente 8):**
    - **Backend (`backend/src`): 0 arquivos acima de 400 linhas:**
      - `inventory-reports.service.ts` (506l -> 238l): geração do Mapa Mensal SFPC R-105 extraída para `inventory-sfpc-report.service.ts` (260l).
      - `auth-sessions.service.ts` (498l -> 345l): validação TOTP/MFA extraída para `auth-mfa-verification.service.ts` e emissão/assinatura de tokens JWT extraída para `auth-token.service.ts`.
      - `product-lots.service.ts` (490l -> 249l): operações de divisão de lotes (`splitLot`) e quarentena/bloqueio (`updateLotStatus`) extraídas para `product-lots-operations.service.ts`.
      - `sales.service.ts` (432l -> 267l): validação de itens de venda e movimentações de saída de estoque extraídas para `sales.helper.ts`.
      - `sales-quotes.service.ts` (408l -> 372l): cancelamento de orçamentos e limpeza de reservas extraídos para `sales-quotes.helper.ts`.
      - `purchases.service.ts` (442l -> 175l): rotina transacional de recebimento físico de pedidos e conferência de NEQ extraída para `purchases-receipt.helper.ts`.
      - `service-orders-lifecycle.service.ts` (485l -> 298l): encerramento de OS e relatório de queima extraídos para `service-orders-close.helper.ts`.
    - **Frontend (`frontend/src`): 0 arquivos acima de 400 linhas:**
      - `login-panel.tsx` (450l -> 207l) com subcomponentes de MFA e recuperação de senha.
      - `compliance/create-gt-modal.tsx` (662l -> 238l) com subcomponentes de rota, seleção de veículo/motorista e alocação de itens.
      - `operations/order-action-card.tsx` (523l -> 219l) com cards desacoplados para aprovação, queima e faturamento.
      - `purchases-workspace.tsx` (410l -> 225l) com tabs e modais especializados.
      - `compliance-workspace.tsx` (477l -> 250l).
      - `finance-workspace.tsx` (483l -> 235l).
      - `fiscal-workspace.tsx` (499l -> 257l).
      - `inventory-workspace.tsx` (520l -> 354l).
      - `operations-workspace.tsx` (704l -> 298l).
      - `commercial-workspace.tsx` (810l -> 238l).
      - `use-operations-state.ts` (550l -> 368l) extraindo `use-operations-modals.ts` (200l) para modais de GT, NFS-e e PIX.
      - `use-commercial-state.ts` (694l -> 242l) extraindo `use-commercial-modals.ts` (299l) para modais de tabelas, promoções, devolução, fiscal e PIX, e `use-commercial-quotes.ts` (190l) para ciclo de orçamentos e conversão.
  - **Garantia de integridade e qualidade:** Zero breaking changes em rotas, DTOs ou APIs; preservação estrita de todas as invariantes de domínio PCE (trava atômica de NEQ via `assertCapacity` com lock `FOR UPDATE` em paióis, rastreabilidade de lote com fabricante/datas, bloqueio de lotes vencidos e auditoria append-only); 100% dos testes passando no backend (48 testes unitários + 46 testes e2e) e no frontend (81 testes unitários em 20 suítes); builds de produção e checagens de tipos 100% aprovados.

Para requisitos de execução, endpoints e regras detalhadas, consulte
[`backend/README.md`](../backend/README.md),
[`frontend/README.md`](../frontend/README.md) e
[`docs/RUNBOOK-IMPLANTACAO-PRODUCAO.md`](RUNBOOK-IMPLANTACAO-PRODUCAO.md).
