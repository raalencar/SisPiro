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

---

## Fase 1 — Fechar lacuna já mapeada: edição de orçamento de OS

**Por quê primeiro:** é a menor lacuna aberta — a API (`PUT
/operations/orders/:id`) e o client HTTP (`operationsApi.updateOrder` em
`frontend/src/lib/api.ts`) já existem; falta só a tela. Fechar isso evita
manter código morto no client.

- [ ] Adicionar tela/modal de edição de cabeçalho e itens da OS em
      `operations-workspace.tsx`, disponível apenas enquanto a OS estiver em
      `ORCAMENTO` (mesma regra que o backend já aplica).
- [ ] Reaproveitar os componentes de seleção de cliente/blaster/lote já
      existentes no fluxo de criação de OS.
- [ ] Repassar mensagens de validação do backend sem reescrevê-las.
- [ ] Teste Vitest cobrindo a edição e o caso em que a API rejeita (OS fora de
      `ORCAMENTO`).
- [ ] Atualizar `frontend/README.md` e `docs/STATUS-IMPLEMENTACAO.md` (remover
      a observação de que a tela não existe).

**Critério de aceite:** `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build` passam; jornada testada manualmente no navegador.

---

## Fase 2 — Integrar módulos ainda não conectados à interface

Ordem sugerida pela dependência natural dos dados (clientes/fornecedores são
referenciados pelos módulos seguintes):

### 2.1 Clientes
- [ ] Listagem com busca/paginação (`GET /customers`), cadastro e edição
      (`POST`/`PATCH /customers/:id`), incluindo CR e classes PCE autorizadas.
- [ ] Avaliação de elegibilidade PCE (`POST /customers/:id/pce-eligibility`)
      como ação de tela, não só validação server-side silenciosa.
- [ ] Exibir CPF/CNPJ e CR normalmente aqui (esta tela usa o endpoint completo,
      diferente das opções operacionais reduzidas já usadas em OS).

### 2.2 Blasters
- [ ] Listagem, cadastro e edição (`/blasters`, `/blasters/:id`).
- [ ] Avaliação de habilitação para uma data de evento
      (`POST /blasters/:id/eligibility`) como ação de tela.

### 2.3 Fornecedores e compras
- [ ] Cadastro/edição de fornecedores com CR e classes PCE (`/suppliers`).
- [ ] Criação de pedido de compra (`/purchases`), consulta de itens e
      recebimentos (`/purchases/:id`).
- [ ] Tela de recebimento parcial/integral (`POST /purchases/:id/receive`)
      com os campos obrigatórios por lote (número, fabricação, validade,
      fabricante/importador, paiol, quantidade, vencimento, referência
      fiscal da etapa).
- [ ] Cancelamento de pedido pendente (`POST /purchases/:id/cancel`).

### 2.4 Comercial (preços, vendas, orçamentos, devoluções)
- [ ] Tabelas de preço (`/pricing/lists`) e promoções (`/pricing/promotions`),
      incluindo ativação/desativação.
- [ ] Checkout de venda/PDV (`POST /sales`) com seleção de lote, cliente
      opcional (apenas para itens não PCE) e condição de pagamento
      (`IMEDIATO`/`PRAZO`).
- [ ] Orçamentos comerciais: emissão, consulta, cancelamento e conversão em
      venda (`/sales/quotes/**`).
- [ ] Devoluções (`/sales/:id/returns`), parciais ou totais.
- [ ] Relatório de vendas por período (`/sales/reports/summary`).

### 2.5 Financeiro
- [ ] Lançamentos a pagar/receber (`/finance/entries`), pagamento parcial ou
      quitação (`/finance/entries/:id/payments`) e cancelamento.
- [ ] Fluxo de caixa (`/finance/cash-flow`) e painel financeiro
      (`/finance/dashboard`).
- [ ] Detalhamento de pagamentos por categoria/método
      (`/finance/reports/payment-breakdown`).

**Critério de aceite de cada submódulo:** estados explícitos de
carregamento/erro; mensagens de validação da API repassadas sem reescrita;
CPF/CNPJ/CR nunca expostos fora das telas de cadastro completo (continuam
ocultos nas seleções operacionais reduzidas); teste Vitest por tela cobrindo
caminho feliz e um erro; `frontend/README.md` e
`docs/STATUS-IMPLEMENTACAO.md` atualizados a cada entrega.

---

## Fase 3 — Controles de apresentação por perfil

**Depende de:** Fase 2 estar pelo menos parcialmente entregue (não há o que
esconder/desabilitar antes de a tela existir).

- [ ] Mapear, por perfil (`ESTOQUE`, `COMERCIAL`, `OPERACOES`, `COMPRAS`,
      `FINANCEIRO`, `ADMIN`), quais módulos/ações devem aparecer habilitados,
      desabilitados ou ocultos na navegação.
- [ ] Implementar a ocultação/desabilitação na UI com base no perfil da sessão
      atual (`GET /auth/me`), lembrando que isso é só apresentação — a
      autorização final continua no backend.
- [ ] Testar com usuários de perfil único e perfil múltiplo.

---

## Fase 4 — Telas para os novos fluxos de segurança (depende do Backend Fase 1)

**Bloqueado até:** `Plano_Backend.md` Fase 1 (rate limiting, recuperação de
senha, MFA) estar implementada no backend.

- [ ] Tela de "esqueci minha senha" (solicitação + confirmação com token).
- [ ] Enrolamento e verificação de MFA no fluxo de login.
- [ ] Mensagem apropriada quando o rate limiting de login for acionado, sem
      revelar se o e-mail existe.

---

## Fase 5 — Validação de jornadas completas

- [ ] Validar as jornadas integradas (Fases 1–2) com usuários/perfis não
      administradores, incluindo erros de autorização retornados pelo backend.
- [ ] Validar sessão expirada e renovação (refresh) nos navegadores
      suportados.
- [ ] Smoke test visual autenticado da jornada completa de OS contra o seed
      local (pendência já registrada em `docs/STATUS-IMPLEMENTACAO.md`).
- [ ] Smoke test visual das jornadas novas de estoque (quarentena/bloqueio de
      lote, split entre paióis, ativação/inativação de paiol, Mapa SFPC).

---

## Fase 6 — Responsividade e acessibilidade

- [ ] Validar responsividade das telas integradas (Fases 1–2) em resoluções
      menores (tablet/mobile, se aplicável ao uso real do produto).
- [ ] Validar acessibilidade básica (contraste, navegação por teclado, labels
      de formulário) nas telas novas e nas já existentes de estoque/operações.

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
