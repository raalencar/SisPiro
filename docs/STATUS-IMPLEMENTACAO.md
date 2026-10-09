# Status da implementação SisPiro ERP

Atualizado em 9 de outubro de 2026. Este documento resume as entregas existentes
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
  - Relatórios analíticos: relatório de conversão de orçamentos (`GET /commercial/reports/quotes-conversion`) com volume emitido, convertido, expirado, taxa de conversão (%) e ticket médio; relatório de Aging Schedule (`GET /financial/reports/aging`) com classificação de títulos a pagar e receber em 5 buckets de maturidade (`current`, `overdue1to30`, `overdue31to60`, `overdue61to90`, `overdueOver90`).
  - Parcelamento financeiro nativo (`POST /financial/entries`): lançamentos parcelados com número de parcelas, intervalo em dias ou datas customizadas, rateio exato de centavos (resto alocado na 1ª parcela), agrupamento (`installmentGroup`) e auditoria individual por parcela.
- Auditoria transacional para operações de negócio e autenticação, incluindo
  identidade do operador autenticado em novos registros.
- Seed DEMO local idempotente, com dados fictícios para os módulos e guardas
  contra execução fora de ambiente de desenvolvimento/loopback.
- Estoque/WMS: produtos PCE, lotes rastreáveis com controle de quarentena/bloqueio físico
  (`DISPONIVEL`, `QUARENTENA`, `BLOQUEADO`), desmembramento rastreável (`split`), paióis com
  capacidade NEQ e ativação/inativação com trava de saldo zero, recebimentos e movimentos de
  estoque auditados, reservas e resumo de posição/validade.
- Relatório Regulatório Militar: Mapa Mensal de Movimentação e Estocagem de PCE para o Exército
  Brasileiro (SFPC / R-105) consolidando saldos anteriores, entradas, saídas, saldos finais e massa NEQ
  por classe de risco.
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
- Quality Gates 100% aprovados: `npm run lint` (0 avisos), `npm run typecheck` (0 erros), `npm test` (46 testes passando, incluindo testes de componente com React Testing Library/jsdom) e `npm run build` (20 rotas otimizadas).
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

- **RBAC por ação:** avaliado nesta entrega (ver `Plano_Front.md` Fase 3) —
  hoje não há nenhuma tela real compartilhada por mais de um perfil com
  permissões diferentes por ação, então não é uma lacuna ativa. Reavaliar se
  isso mudar.
- Validar sessão expirada e renovação (refresh) nos navegadores suportados —
  não coberto nesta rodada.
- Validar acessibilidade (contraste, navegação por teclado, labels de
  formulário) — não coberto nesta rodada; responsividade teve apenas um
  smoke test pontual (estoque, viewport mobile), não é cobertura exaustiva.
- Implementar telas de faturamento e regulatório somente após endpoints e
  regras oficiais estarem disponíveis e aprovados (Fase 3 do backend).

## Trabalho pendente no backend

### Domínio e integrações (Fase 3 — Requer aprovação explícita antes de iniciar)

- Definir e implementar emissão fiscal e integrações oficiais para NF-e,
  NFS-e, MDF-e e Guias de Tráfego, com validação regulatória militar e fazendária.
- Definir integração bancária, importação de extratos (OFX/CNAB), conciliação e tratamento
  de divergências financeiras.
- Fases 0 (diagnóstico de ambiente), 1 (segurança e produção) e 2 (evolução comercial e financeira)
  estão concluídas, testadas e auditadas no backend. Nesta rodada de refinamentos técnicos:
  - O rate limiter de login foi migrado para operações atômicas em Redis (`ioredis`) com expiração em milissegundos e fallback gracioso em memória caso o Redis esteja indisponível.
  - Implementado suporte nativo a parcelamento financeiro (`FinancialEntry`), com divisão exata de centavos (resto alocado na 1ª parcela), vencimentos escalonados, agrupamento (`installmentGroup`), auditoria individual por parcela e suporte visual no frontend.
  - Permissões de banco e rotinas de backup documentadas como runbook de implantação em `backend/README.md`.

### Compatibilidade da instância local

Diagnóstico concluído (Fase 0): O controlador declara `GET /inventory/reports/stock-summary` e `GET /inventory/reports/sfpc-monthly-map` em `InventoryController`, devidamente registrados no `AppModule`, compilados no build NestJS (`npm run build`) e cobertos com sucesso na suíte de testes ponta a ponta (`backend/test/inventory.e2e-spec.ts`). A causa raiz da divergência anterior (404) foi a execução de um processo local `node` defasado, iniciado antes da compilação e deploy das novas rotas de relatórios. Reiniciar a instância com o artefato atualizado (`npm run build && npm run start:dev`) disponibiliza os endpoints com código 200 no OpenAPI (`/api/v1/docs`) e nas chamadas autenticadas.

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

## Verificação executada nesta entrega

- Backend: `npm run lint` (oxlint, 0 erros), `npm test` (72 testes), `npm run test:e2e` (46 testes) e `npm run build` passaram.
- Frontend: `npm run lint` (0 avisos), `npm run typecheck` (0 erros), `npm test` (46 testes) e `npm run build` (20 rotas SSG/SSR) passaram.
- Auditoria e refinamentos técnicos (Rate Limiter Redis e Parcelamento Financeiro) concluídos e validados em testes unitários e ponta a ponta em ambas as camadas. A auditoria desta rodada encontrou e corrigiu, antes da validação final: reconexão permanente abandonada do cliente Redis do rate limiter após instabilidade transitória (`retryStrategy` corrigido para nunca desistir) e uma janela de corrida real entre checar e contabilizar tentativas de login (corrigida com checagem + incremento atômicos em uma única operação); a assimetria `ENTRADA`/`QUARENTENA` no estoque (lacuna de baixo risco conhecida desde a auditoria da Fase 1); e um bug de exibição "R$ NaN" na tela Financeiro, encontrado em smoke test manual com usuários reais contra o backend local — ver seção acima.

Para requisitos de execução, endpoints e regras detalhadas, consulte
[`backend/README.md`](../backend/README.md) e
[`frontend/README.md`](../frontend/README.md).
