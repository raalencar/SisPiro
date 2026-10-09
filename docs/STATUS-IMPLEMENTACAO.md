# Status da implementação SisPiro ERP

Atualizado em 8 de outubro de 2026. Este documento resume as entregas existentes
no backend e no frontend e registra trabalho ainda necessário. O estado dos
endpoints de negócio deve ser confirmado também contra a versão efetivamente
implantada da API.

## Entregue no backend

- API NestJS/TypeScript com PostgreSQL, Prisma, Redis/BullMQ e documentação
  OpenAPI.
- Autenticação JWT com login, bootstrap inicial, refresh rotativo, logout,
  alteração de senha, usuários e perfis por módulo.
- Autenticação avançada e segurança (Fase 1): rate limiting de login e bootstrap com proteção contra força bruta e resposta neutra HTTP 429 (limitação conhecida: contadores em memória do processo, não em Redis — ver `backend/README.md`); recuperação de senha com tokens opacos de uso único (15 min), despacho assíncrono via fila BullMQ e revogação atômica de todas as sessões ativas; autenticação multifator (MFA TOTP RFC 6238) com pareamento Base32, URL `otpauth://`, 8 códigos de backup de uso único e segredo TOTP criptografado em repouso (AES-256-GCM); revisão de CORS, segredos e testes de concorrência adversarial com travas pessimistas (`FOR UPDATE`) implementados em código; privilégios mínimos no PostgreSQL, retenção de auditoria e backups documentados como runbook de implantação (ainda não provisionados neste repositório — ver `backend/README.md`).
- Evolução Comercial e Financeira (Fase 2):
  - Orçamentos comerciais: edição de orçamentos vigentes (`PUT /sales/quotes/:id`) antes da conversão, com lock pessimista (`FOR UPDATE`) e recálculo transacional de reservas; envio assíncrono de orçamentos por e-mail (`POST /sales/quotes/:id/send`) despachando jobs via fila BullMQ (`background`) com registro de auditoria `sales-quote.sent`.
  - Promoções comerciais: suporte a desconto fixo (`PRECO_FIXO`) e desconto percentual (`PERCENTUAL`) com migração reversível no PostgreSQL (`PromotionDiscountType`); motor de precedência estrita garantindo a aplicação do menor preço efetivo para o cliente (sempre protegendo contra promoções mais caras que a tabela).
  - Devoluções legadas: suporte a devolução parcial e total de vendas legadas sem lançamento financeiro anterior (`financialEntry === null`), garantindo reentrada física idempotente no lote sem quebra de integridade.
  - Relatórios analíticos: relatório de conversão de orçamentos (`GET /commercial/reports/quotes-conversion`) com volume emitido, convertido, expirado, taxa de conversão (%) e ticket médio; relatório de Aging Schedule (`GET /financial/reports/aging`) com classificação de títulos a pagar e receber em 5 buckets de maturidade (`current`, `overdue1to30`, `overdue31to60`, `overdue61to90`, `overdueOver90`).
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
- Controles de apresentação por perfil: itens de navegação sem permissão ficam
  visualmente desabilitados e o acesso direto por URL a um módulo sem o
  perfil exigido mostra uma tela de "Acesso restrito" (`lib/modules.ts`,
  `app-shell.tsx`). Granularidade por módulo, não por ação dentro da tela; a
  autorização final continua no backend.
- Quality Gates 100% aprovados: `npm run lint` (0 avisos), `npm run typecheck` (0 erros), `npm test` (21 testes passando) e `npm run build` (18 rotas otimizadas).
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

## Trabalho pendente no frontend

- **Tela de recuperação de senha:** o backend expõe
  `POST /auth/password-reset/request` e `/confirm` (Fase 1 do backend), mas
  não há rota BFF nem componente correspondente no frontend ainda.
- **RBAC por ação:** o controle de perfil implementado é por módulo/tela, não
  por botão ou operação individual dentro de uma tela compartilhada por mais
  de um perfil.
- **Cobertura de teste de componente:** não há React Testing Library (ou
  equivalente) instalada; os testes atuais cobrem só lógica pura (clientes
  HTTP, proxy BFF, mapeamento de módulos). Nenhuma tela é renderizada em
  teste automatizado — essa lacuna foi o que permitiu o bug crítico acima
  passar sem detecção.
- Validar as jornadas completas (incluindo os módulos novos desta entrega)
  com usuários/perfis não administradores, erros de autorização, sessão
  expirada e refresh em navegadores suportados.
- Fazer smoke test visual autenticado das jornadas de OS, estoque
  (quarentena/split/paióis) e dos módulos novos (clientes, blasters, compras,
  comercial, financeiro) contra o seed local — ainda não realizado nesta
  entrega.
- Validar responsividade e acessibilidade das telas integradas.
- Implementar telas de faturamento e regulatório somente após endpoints e
  regras oficiais estarem disponíveis e aprovados (Fase 3 do backend).

## Trabalho pendente no backend

### Domínio e integrações (Fase 3 — Requer aprovação explícita antes de iniciar)

- Definir e implementar emissão fiscal e integrações oficiais para NF-e,
  NFS-e, MDF-e e Guias de Tráfego, com validação regulatória militar e fazendária.
- Definir integração bancária, importação de extratos (OFX/CNAB), conciliação e tratamento
  de divergências financeiras.
- Fases 0 (diagnóstico de ambiente), 1 (segurança e produção) e 2 (evolução comercial e financeira)
  estão concluídas, testadas e auditadas no backend. A auditoria encontrou e
  corrigiu nesta entrega: segredo TOTP persistido em texto plano (agora
  criptografado), campo "ticket médio" documentado mas ausente no relatório
  de conversão de orçamentos (agora implementado), e o parâmetro documentado
  do relatório de Aging estava errado (`asOf` em vez de `referenceDate`,
  corrigido na documentação). Limitações conhecidas e aceitas por ora:
  rate limiter em memória do processo (não sobrevive restart/múltiplas
  instâncias) e permissões de banco/backup documentadas como runbook de
  implantação, não como infraestrutura já provisionada — ver
  `backend/README.md`.

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

- Backend: `npm run lint` (oxlint, 0 erros), `npm test` (68 testes), `npm run test:e2e` (45 testes) e `npm run build` passaram.
- Frontend: `npm run lint` (0 avisos), `npm run typecheck` (0 erros), `npm test` (21 testes) e `npm run build` (18 rotas) passaram.
- Auditoria independente (dois agentes, backend e frontend) revisou a entrega completa desta sessão antes do commit; achados e correções estão descritos nas seções acima e em `Plano_Backend.md`/`Plano_Front.md`.

Para requisitos de execução, endpoints e regras detalhadas, consulte
[`backend/README.md`](../backend/README.md) e
[`frontend/README.md`](../frontend/README.md).
