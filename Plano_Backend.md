# Plano de Implementação — Backend (SisPiro ERP)

Sequência de trabalho para o backend (NestJS/Prisma/PostgreSQL), derivada das
lacunas já registradas em [`docs/STATUS-IMPLEMENTACAO.md`](docs/STATUS-IMPLEMENTACAO.md)
e na tabela de lacunas de [`backend/README.md`](backend/README.md). Execute as
fases na ordem abaixo — cada uma depende da anterior estar fechada (testes e
documentação atualizados) antes de iniciar a próxima.

Para cada fase: use o agente `back` para implementar e o agente `auditor` para
revisar antes de considerar a fase concluída (ver `agentes/back.md` e
`agentes/auditor.md`). Decisões de contrato/arquitetura que atravessem módulos
passam pelo agente `engenheiro`.

---

## Fase 0 — Diagnóstico da divergência local conhecida

**Por quê primeiro:** é um bloqueio de ambiente, não de produto; sem resolver,
qualquer verificação manual contra a instância local fica pouco confiável.

- [ ] Confirmar se o backend local está executando o build atual
      (`npm run build && npm run start:dev`, ou reiniciar o processo `start:dev`).
- [ ] Validar `GET /inventory/reports/stock-summary` no OpenAPI servido
      (`/api/v1/docs`) e com uma chamada autenticada real.
- [ ] Se a rota continuar ausente/404, investigar se há um módulo não
      registrado no `AppModule` ou um problema de build incremental; não é
      esperado que falte no código-fonte (o controller já a declara).
- [ ] Atualizar a seção "Compatibilidade da instância local" em
      `docs/STATUS-IMPLEMENTACAO.md` com o resultado (resolvido ou causa raiz
      identificada).

**Critério de aceite:** rota responde 200 com payload esperado numa instância
local rodando o build atual, ou causa raiz documentada se o problema persistir.

---

## Fase 1 — Segurança e preparação para produção

**Por quê antes do resto:** `docs/STATUS-IMPLEMENTACAO.md` e `backend/README.md`
marcam isso como pré-requisito explícito para expor a API à internet. Fazer
depois de ampliar superfície de API (fases 2/3) só aumenta o que precisa ser
revisto.

### 1.1 Rate limiting de login
- [ ] Definir limite (tentativas por IP/usuário/janela de tempo) e política de
      bloqueio temporário.
- [ ] Implementar guard/middleware em `POST /auth/login` (e `POST /auth/bootstrap`
      se aplicável).
- [ ] Testes e2e: excedente de tentativas retorna 429 (ou equivalente) sem
      revelar se o e-mail existe.

### 1.2 Recuperação de senha
- [ ] Desenhar o fluxo (token de uso único com expiração curta, envio por
      e-mail — definir provedor/fila via BullMQ).
- [ ] Novo endpoint público `POST /auth/password-reset/request` e
      `POST /auth/password-reset/confirm` (ou nomenclatura equivalente),
      seguindo o padrão de não revelar se o e-mail existe.
- [ ] Revogar todas as sessões ativas ao confirmar a troca, igual ao
      comportamento já existente em `PATCH /auth/me/password`.
- [ ] Testes e2e cobrindo token expirado, token reutilizado e fluxo completo.

### 1.3 MFA
- [ ] Decidir mecanismo (TOTP é o mais simples de operar sem dependência
      externa de SMS/e-mail).
- [ ] Endpoints de enrolamento, verificação e desativação, exigindo senha atual
      para desativar.
- [ ] Integrar ao fluxo de login (segundo fator após senha válida).
- [ ] Testes e2e: login com MFA ativo exige o segundo fator; códigos de backup
      (se existirem) funcionam uma única vez.

### 1.4 Revisão de segurança e concorrência
- [ ] Revisar CORS (origens permitidas em produção vs. desenvolvimento).
- [ ] Revisar gestão de segredos (`AUTH_JWT_SECRET`, `DATABASE_URL`, etc. fora
      do repositório, rotação documentada).
- [ ] Revisar permissões do usuário de banco (privilégios mínimos necessários,
      sem superuser).
- [ ] Testes de concorrência adicionais nos pontos já identificados como
      sensíveis: checkout de venda do mesmo lote, aprovação de OS concorrente,
      split/ajuste de lote concorrente (os testes atuais cobrem o caminho
      principal; ampliar para cenários de corrida adversarial).
- [ ] Definir e documentar política/retenção de auditoria (por quanto tempo os
      logs ficam, se há expurgo).
- [ ] Backups e monitoramento do ambiente de implantação (fora do código, mas
      documentar a decisão em `backend/README.md`).

**Critério de aceite da Fase 1:** `docs/STATUS-IMPLEMENTACAO.md` deixa de listar
"Segurança e preparação para produção" como pendente; `backend/README.md`
documenta os novos endpoints/fluxos; `npm run lint`, `npm test`,
`npm run test:e2e` e `npm run build` passam.

---

## Fase 2 — Evolução de domínio (comercial e financeiro)

Menor risco que a Fase 3 porque não depende de aprovação regulatória externa —
pode ser priorizada por valor de negócio.

### 2.1 Edição e envio de orçamento comercial
- [ ] Espelhar o padrão já implementado em OS (`PUT /operations/orders/:id`
      — ver `service-orders.service.ts`) para orçamentos comerciais
      (`sales.quotes`): permitir editar itens/preços enquanto o orçamento não
      foi convertido nem expirou.
- [ ] Definir se existe envio (e-mail/PDF) do orçamento ao cliente — se sim,
      especificar o contrato antes de implementar (fila BullMQ para geração
      assíncrona).
- [ ] Testes e2e cobrindo edição antes/depois da conversão e da expiração.

### 2.2 Evolução de promoções
- [ ] Especificar descontos percentuais (hoje só preço fixo) e regras de
      precedência quando combinados com tabela de preço.
- [ ] Especificar segmentação (por cliente, classe de cliente ou volume) se
      for aprovada.
- [ ] Testes e2e para as regras novas, incluindo sobreposição e precedência.

### 2.3 Financeiro: estornos e devoluções legadas
- [ ] Integrar estornos fiscais ao fluxo financeiro (depende da Fase 3 ter ao
      menos o desenho de NF-e definido, para saber o que estornar).
- [ ] Revisar devoluções de vendas legadas sem vínculo financeiro (dados
      históricos pré-feature de crédito/reembolso) e decidir se precisam de
      migração de dados ou apenas documentação da limitação.

### 2.4 Relatórios adicionais
- [ ] Levantar com o usuário quais relatórios operacionais/regulatórios e
      projeções financeiras são realmente necessários antes de implementar
      (evitar relatório especulativo sem consumidor definido).

**Critério de aceite da Fase 2:** cada item entregue atualiza
`backend/README.md` (tabela de lacunas) e `docs/STATUS-IMPLEMENTACAO.md`;
testes e2e cobrem caminho positivo e de rejeição; `npm run lint`, `npm test`,
`npm run test:e2e`, `npm run build` passam.

---

## Fase 3 — Compliance avançado e fiscal (requer aprovação explícita antes de iniciar)

**Não iniciar nenhum item desta fase sem decisão explícita do usuário** — são
integrações com sistemas oficiais, de alto custo de retrabalho se o contrato
mudar depois de implementado.

### 3.1 Emissão fiscal (NF-e, NFS-e, MDF-e)
- [ ] Definir provedor/SDK de emissão (ex.: SEFAZ direto vs. serviço
      terceirizado) — decisão de produto, não técnica.
- [ ] Especificar o contrato (quando emitir: no checkout? na conclusão da OS?)
      antes de tocar código.
- [ ] Modelar fila assíncrona (BullMQ) para emissão e reintento, com estados
      de falha visíveis.
- [ ] Testes e2e com o provedor mockado; nunca emitir contra o ambiente de
      homologação/produção fiscal real em teste automatizado.

### 3.2 Guias de Tráfego (GT)
- [ ] Especificar os dados exigidos pela regulamentação para o documento.
- [ ] Decidir se GT é gerado a partir da OS (no início do transporte) ou de
      forma independente.

### 3.3 Integração bancária e conciliação
- [ ] Definir formato de importação de extrato (OFX, CNAB, API do banco).
- [ ] Especificar o algoritmo de conciliação e tratamento de divergências
      (conciliação automática por valor+data vs. revisão manual).

**Critério de aceite da Fase 3:** cada subitem só começa depois de um contrato
escrito e aprovado (pode ser um documento de decisão separado, revisado pelo
agente `engenheiro`); mesma régua de testes e documentação das fases
anteriores.

---

## Notas de acompanhamento

- Lacuna de baixo risco já identificada em auditoria anterior e não corrigida
  por estar fora do escopo aprovado naquele momento: `ENTRADA` de estoque
  bloqueia lote `BLOQUEADO` mas permite `QUARENTENA` (assimetria com
  `AJUSTE`/`SAIDA`/`TRANSFERENCIA`, que bloqueiam ambos). Avaliar alinhamento
  ao tocar o módulo de estoque novamente.
- Qualquer fase que adicione rota de negócio nova precisa do guard de perfil
  correto (`ESTOQUE`, `COMERCIAL`, `OPERACOES`, `COMPRAS`, `FINANCEIRO`,
  `ADMIN`) e de registro de auditoria na mesma transação — ver
  `agentes/back.md` para a lista completa de invariantes não negociáveis.
