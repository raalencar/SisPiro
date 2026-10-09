# Plano de Implementação — Frontend (SisPiro ERP)

Sequência de trabalho para o frontend (Next.js/React), derivada das lacunas já
registradas em [`docs/STATUS-IMPLEMENTACAO.md`](docs/STATUS-IMPLEMENTACAO.md) e
em [`frontend/README.md`](frontend/README.md). Execute as fases na ordem
abaixo. As fases 2.x podem ser reordenadas entre si por prioridade de negócio,
mas todas dependem das APIs correspondentes já existirem no backend (todas já
existem hoje, exceto onde indicado).

Para cada fase: use o agente `front` para implementar e o agente `auditor`
para revisar antes de considerar a fase concluída (ver `agentes/front.md` e
`agentes/auditor.md`). Decisões de contrato que exijam mudança no backend
passam pelo agente `engenheiro`.

**Sprint atual:** Fases 1–5 (exceto sessão/refresh) e a RBAC-por-ação já estão
fechadas ou avaliadas. O escopo combinado para este sprint é só QA/polimento,
sem funcionalidade nova: sessão expirada/refresh (fim da Fase 5),
responsividade completa e acessibilidade básica (Fase 6). Fiscal/bancário
(Fase 7) segue bloqueado aguardando decisão explícita sobre o escopo de
negócio — não faz parte deste sprint.

---

## Fase 1 — Fechar lacuna já mapeada: edição de orçamento de OS

**Por quê primeiro:** é a menor lacuna aberta — a API (`PUT
/operations/orders/:id`) e o client HTTP (`operationsApi.updateOrder` em
`frontend/src/lib/api.ts`) já existem; falta só a tela. Fechar isso evita
manter código morto no client.

- [x] Adicionar tela/modal de edição de cabeçalho e itens da OS em
      `operations-workspace.tsx`, disponível apenas enquanto a OS estiver em
      `ORCAMENTO` (mesma regra que o backend já aplica).
- [x] Reaproveitar os componentes de seleção de cliente/blaster/lote já
      existentes no fluxo de criação de OS.
- [x] Repassar mensagens de validação do backend sem reescrevê-las.
- [x] Atualizar `frontend/README.md` e `docs/STATUS-IMPLEMENTACAO.md` (remover
      a observação de que a tela não existe).

**Correção crítica aplicada nesta entrega:** o proxy BFF (`server-auth.ts`,
`proxyAuthenticatedRequest`) só lia o corpo da requisição em `POST`; `PUT` e
`PATCH` chegavam ao backend sem payload, quebrando silenciosamente esta edição
e todas as outras edições da Fase 2. Corrigido para ler o corpo em qualquer
método exceto `GET`/`DELETE`, com teste de regressão em
`src/lib/server-auth.test.ts` cobrindo `PUT`, `PATCH` e `GET`.

**Concluído:** teste Vitest de componente cobrindo a jornada de edição de OS
fim a fim (`src/components/operations-workspace.test.tsx`).

**Critério de aceite:** `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build` passam (confirmado). Jornada testada manualmente no navegador
ainda pendente — ver Fase 5.

---

## Fase 2 — Integrar módulos ainda não conectados à interface

Ordem sugerida pela dependência natural dos dados (clientes/fornecedores são
referenciados pelos módulos seguintes):

### 2.1 Clientes
- [x] Listagem com busca/paginação (`GET /customers`), cadastro e edição
      (`POST`/`PATCH /customers/:id`), incluindo CR e classes PCE autorizadas
      (`customers-workspace.tsx`, `/modules/customers`).
- [x] Avaliação de elegibilidade PCE (`POST /customers/:id/pce-eligibility`)
      como ação de tela.
- [x] Exibe CPF/CNPJ e CR normalmente aqui (endpoint completo); as opções
      operacionais reduzidas usadas em OS continuam sem esses campos
      (verificado: `operations-workspace.tsx` só recebe `legalName`,
      `hasCr`, `crExpiresAt`).

### 2.2 Blasters
- [x] Listagem, cadastro e edição (`teams-workspace.tsx`, `/modules/teams`).
- [x] Avaliação de habilitação para uma data de evento
      (`POST /blasters/:id/eligibility`) como ação de tela.

### 2.3 Fornecedores e compras
- [x] Cadastro/edição de fornecedores com CR e classes PCE (`/suppliers`).
- [x] Criação de pedido de compra (`/purchases`), consulta de itens e
      recebimentos (`/purchases/:id`).
- [x] Tela de recebimento parcial/integral (`POST /purchases/:id/receive`)
      com os campos obrigatórios por lote (`purchases-workspace.tsx`).
- [x] Cancelamento de pedido pendente (`POST /purchases/:id/cancel`).

### 2.4 Comercial (preços, vendas, orçamentos, devoluções)
- [x] Tabelas de preço (`/pricing/lists`) e promoções (`/pricing/promotions`,
      incluindo o tipo `PERCENTUAL` entregue no `Plano_Backend.md` Fase 2.2),
      com ativação/desativação (`commercial-workspace.tsx`).
- [x] Checkout de venda/PDV (`POST /sales`) com seleção de lote, cliente
      opcional (apenas para itens não PCE) e condição de pagamento
      (`IMEDIATO`/`PRAZO`).
- [x] Orçamentos comerciais: emissão, consulta, edição (`PUT`), envio por
      e-mail, cancelamento e conversão em venda (`/sales/quotes/**`,
      `/commercial/sales/quotes/**`).
- [x] Devoluções (`/sales/:id/returns`), parciais ou totais.
- [x] Relatório de vendas por período e relatório de conversão de orçamentos
      (`/sales/reports/summary`, `/commercial/reports/quotes-conversion`).

### 2.5 Financeiro
- [x] Lançamentos a pagar/receber (`/finance/entries`), pagamento parcial ou
      quitação (`/finance/entries/:id/payments`) e cancelamento
      (`finance-workspace.tsx`).
- [x] Fluxo de caixa (`/finance/cash-flow`) e painel financeiro
      (`/finance/dashboard`).
- [x] Detalhamento de pagamentos por categoria/método e Aging Schedule com os
      5 buckets de vencimento (`/finance/reports/payment-breakdown`,
      `/financial/reports/aging`).

**Correção aplicada:** todas as edições acima (`PATCH`/`PUT`) estavam
quebradas pelo mesmo bug crítico do proxy BFF corrigido na Fase 1 — ver nota
lá. Antes da correção, salvar uma edição de cliente, blaster, fornecedor ou
orçamento comercial chegava ao backend sem corpo.

**Critério de aceite de cada submódulo:** estados explícitos de
carregamento/erro; mensagens de validação da API repassadas sem reescrita;
CPF/CNPJ/CR nunca expostos fora das telas de cadastro completo — confirmado;
`frontend/README.md` e `docs/STATUS-IMPLEMENTACAO.md` atualizados.
**Pendente:** teste Vitest de componente por tela cobrindo caminho feliz e
erro (hoje só há testes de lógica pura em `src/lib/*.test.ts` — nenhum teste
renderiza os componentes novos; ver Notas de acompanhamento).

---

## Fase 3 — Controles de apresentação por perfil

**Depende de:** Fase 2 estar pelo menos parcialmente entregue (não há o que
esconder/desabilitar antes de a tela existir).

- [x] Mapeado por perfil (`ESTOQUE`, `COMERCIAL`, `OPERACOES`, `COMPRAS`,
      `FINANCEIRO`, `ADMIN`) em `lib/modules.ts` (`requiredRoles` por módulo,
      `hasModuleAccess()`); `ADMIN` sempre tem acesso.
- [x] Implementado em dois pontos de `app-shell.tsx`: item de navegação
      desabilitado (visual, com tooltip indicando o perfil exigido) para
      módulos sem permissão, e um gate de conteúdo (`ModuleAccessGate`) que
      mostra "Acesso restrito" se o usuário acessar a URL do módulo direto.
      Autorização final continua no backend.
- [x] Testado manualmente contra backend real: criados 5 usuários locais de
      teste, um por perfil (`ESTOQUE`/`COMERCIAL`/`OPERACOES`/`COMPRAS`/`FINANCEIRO`),
      logados individualmente no navegador. Confirmado para cada um: nav mostra
      apenas o(s) módulo(s) do seu perfil habilitado(s), os demais aparecem
      desabilitados; acesso direto por URL a um módulo fora do perfil mostra
      "Acesso restrito"; o módulo liberado carrega dados reais da API. Usuários
      de teste desativados (`active: false`) ao final — não ficaram permanentes
      no seed. Perfil múltiplo (`ADMIN`) já estava coberto pela conta demo.
- [x] **Granularidade (avaliado, não aplicável hoje):** investigado se existe
  algum caso real de tela compartilhada por mais de um perfil com permissões
  diferentes por ação, auditando todos os `@Roles()` do backend
  (`grep -rn "@Roles(" src/modules/*/*.controller.ts`). Resultado: cada
  controller tem um único perfil dominante por módulo e mapeia 1:1 para um
  único módulo do frontend (`ESTOQUE`→estoque, `COMERCIAL`→clientes/comercial,
  `OPERACOES`→operações/blasters, `COMPRAS`→compras, `FINANCEIRO`→financeiro).
  As únicas duas rotas com `@Roles()` de override (`GET /customers/operational-options`
  e `GET /inventory/operational-lots`, ambas `OPERACOES`) são endpoints de
  lookup consumidos exclusivamente pela tela de Operações através do seu
  próprio namespace de BFF (`/api/operations/references/*`), nunca pelas
  telas de Clientes/Estoque — ou seja, já estão isoladas corretamente, sem
  expor nada a um usuário `COMERCIAL`/`ESTOQUE` que não devesse ver. Implementar
  RBAC por botão/ação agora seria infraestrutura sem caso de uso real no
  produto atual; reavaliar apenas se um papel futuro passar a compartilhar
  uma tela existente com permissões diferentes por operação.

---

## Fase 4 — Telas para os novos fluxos de segurança (depende do Backend Fase 1)

**Bloqueado até:** `Plano_Backend.md` Fase 1 (rate limiting, recuperação de
senha, MFA) estar implementada no backend — já está.

- [x] Tela de "esqueci minha senha" (solicitação + confirmação com token).
      Implementada com rotas BFF same-origin (`POST /api/auth/password-reset/request`
      e `/confirm`), métodos em `lib/auth.ts` (`authApi.requestPasswordReset`,
      `confirmPasswordReset`) e integrada ao painel de acesso (`login-panel.tsx`),
      com suporte a links diretos via query params (`?token=` ou `?reset_token=`) e
      validação de tamanho mínimo de 12 caracteres para a nova senha.
- [x] Enrolamento e verificação de MFA no fluxo de login (`login-panel.tsx`
      trata `mfaRequired: true`, aceita código TOTP de 6 dígitos ou código de
      backup de 8 caracteres, finaliza via `POST /api/auth/login/mfa`; nunca
      grava o código ou o token em `localStorage`/`sessionStorage`).
- [x] Mensagem apropriada quando o rate limiting de login for acionado
      (HTTP 429 tratado como erro genérico pelo cliente, sem revelar se o
      e-mail existe — mesma mensagem neutra do backend).

---

## Fase 5 — Validação de jornadas completas

- [x] Validadas as jornadas integradas com usuários não administradores reais
      (um por perfil, ver Fase 3) contra o backend local rodando: recuperação
      de senha ponta a ponta (solicitação → token real retirado da fila BullMQ
      em Redis → confirmação → login com a nova senha), edição de orçamento de
      OS via `PUT` (alteração persistida e refletida na listagem), e navegação
      por módulo restrito/liberado por perfil.
- [ ] **Sessão expirada e renovação (refresh) — próximo sprint.** Não há hoje
      uma matriz de navegadores suportados definida; para este trabalho,
      escopo mínimo: Chrome, Firefox e Safari, versões estáveis mais
      recentes, desktop (o produto é majoritariamente usado em escritório/
      operação, não em campo). Tarefas:
      - [ ] Mapear o comportamento atual de renovação em `lib/auth.ts` e nas
            rotas BFF (`/api/auth/session`, refresh automático) — confirmar
            se é transparente (silencioso) ou se o usuário percebe
            interrupção.
      - [ ] Testar expiração real: deixar o access token expirar em uso
            (ou revogar a sessão via admin) e confirmar que o usuário é
            redirecionado ao login com mensagem clara, sem tela quebrada ou
            erro silencioso.
      - [ ] Repetir o teste de expiração nos 3 navegadores do escopo,
            prestando atenção a comportamento de cookie `HttpOnly`/
            `SameSite=Lax` (é a base de toda a autenticação do BFF).
      - [ ] Registrar o resultado em `docs/STATUS-IMPLEMENTACAO.md`.
- [x] Smoke test visual autenticado da jornada completa de OS contra o seed
      local: listagem, detalhe, edição de orçamento (`PUT`) com persistência
      confirmada.
- [x] Smoke test visual da jornada de estoque: posição de estoque, lotes,
      mudança de status para quarentena e tentativa de `ENTRADA` bloqueada
      corretamente (ver correção da assimetria ENTRADA/QUARENTENA em
      `Plano_Backend.md`).
- [x] **Achado corrigido nesta rodada:** a tela Financeiro renderizava
      "Amortizado" e "Saldo Devedor" como "R$ NaN" para todo lançamento, e o
      modal de pagamento abria com valor/limite inválidos e título em branco.
      Causa: `finance-workspace.tsx` lia `entry.paidAmount`/`entry.remainingAmount`/
      `entry.counterpart`, campos que a API nunca retorna (os reais são
      `paid`/`outstanding`/`counterparty`). Corrigido em todos os pontos de
      leitura; campos mortos removidos do tipo `FinancialEntry` em `lib/api.ts`;
      regressão coberta por `finance-workspace.test.tsx` (falha
      deliberadamente confirmada com o bug reintroduzido, antes de reverter).
      Só foi encontrado porque a tela chegou a ser aberta de verdade no
      navegador — reforça o valor de smoke test visual além de testes
      unitários/e2e de API.

---

## Fase 6 — Responsividade e acessibilidade

- [x] Smoke test de responsividade em viewport mobile (390×844, iPhone-sized)
      nas telas de Estoque (resumo e lista de lotes): sidebar colapsa para
      menu hamburguer, grid reflui para coluna única, sem overflow horizontal.
      Não é cobertura exaustiva de todas as telas/breakpoints.
- [ ] **Responsividade completa — próximo sprint.** Testar nas 9 telas
      integradas (login, estoque, produtos, clientes, blasters, compras,
      comercial, operações, financeiro) em 3 breakpoints: mobile (390px),
      tablet (768px) e desktop (1280px+). Critério de aceite por tela: sem
      overflow horizontal, tabelas legíveis ou com alternativa (cards/scroll
      controlado), modais utilizáveis sem corte de conteúdo. Registrar
      matriz de resultado (tela × breakpoint) em
      `docs/STATUS-IMPLEMENTACAO.md`; corrigir o que for trivial (CSS/layout)
      na própria rodada e abrir item separado para qualquer redesenho maior.
- [ ] **Acessibilidade básica — próximo sprint.**
      - [ ] Contraste mínimo (WCAG AA) nos elementos principais: login, nav,
            tabelas, badges de status.
      - [ ] Navegação por teclado: completar login, navegar módulos pela
            sidebar, abrir/fechar modais (ex.: edição de OS, pagamento) e
            submeter formulários usando só Tab/Enter/Esc.
      - [ ] Labels de formulário: todo `<input>` tem `<label>` associado
            (não só placeholder) — relevante para leitor de tela.
      - [ ] Registrar achados em `docs/STATUS-IMPLEMENTACAO.md`; corrigir o
            que for trivial (contraste/labels) nesta rodada e abrir item
            separado para qualquer reestruturação maior de navegação por
            teclado.

---

## Fase 7 — Telas fiscais e regulatórias (bloqueada)

**Não iniciar sem que o `Plano_Backend.md` Fase 3 esteja implementada e
aprovada.** Construir UI antes do contrato de NF-e/NFS-e/MDF-e/GT estar
definido é retrabalho garantido.

---

## Notas de acompanhamento

- Nenhuma tela desta sequência deve inventar operações que a API não
  oferece (ex.: edição/exclusão de produtos, paióis, lotes ou movimentos) —
  ver `agentes/front.md` para a lista completa de regras de produto.
- Toda nova rota BFF (`frontend/src/app/api/**`) mantém o padrão de cookies
  `HttpOnly`/`SameSite=Lax`/`Secure` em produção; tokens nunca saem do BFF.
- **Infraestrutura de testes de componentes entregue:** adicionados
  `@testing-library/react` e `jsdom` integrados ao Vitest, com cobertura inicial
  cobrindo autenticação/recuperação (`src/components/login-panel.test.tsx`) e a
  jornada de edição de OS em `src/components/operations-workspace.test.tsx`.
- Este arquivo consolida e substitui `Plano_Frontend.md` (criado em paralelo
  durante a implementação da Fase 2 com fases numeradas de forma diferente;
  removido para não manter duas fontes de verdade).
