# Resumo de Funcionalidades — SisPiro ERP

Atualizado em 9 de outubro de 2026. Visão consolidada, por área de negócio, do
que está implementado (backend + frontend) e do que falta, para apoiar o
planejamento do próximo sprint. Para detalhes técnicos, endpoints e regras,
consulte [`backend/README.md`](../backend/README.md),
[`frontend/README.md`](../frontend/README.md) e
[`STATUS-IMPLEMENTACAO.md`](./STATUS-IMPLEMENTACAO.md). Para o histórico de
fases já concluídas, veja [`Plano_Backend.md`](../Plano_Backend.md) e
[`Plano_Front.md`](../Plano_Front.md).

---

## ✅ Implementado e integrado (API + tela)

### Acesso e segurança
- Login JWT com refresh rotativo, logout, alteração de senha.
- Rate limiting de login/bootstrap distribuído em Redis, checagem e
  incremento atômicos (sem janela de corrida), fallback gracioso em memória
  com reconexão indefinida se o Redis cair.
- Recuperação de senha ("esqueci minha senha"): token opaco de uso único
  (15 min), despacho assíncrono via fila, revogação de todas as sessões ao
  confirmar. Tela completa no frontend, com suporte a link direto por token.
- MFA (TOTP RFC 6238 + 8 códigos de backup de uso único), segredo
  criptografado em repouso (AES-256-GCM). Enrolamento, verificação e
  desativação.
- Usuários e perfis por módulo (`ESTOQUE`, `COMERCIAL`, `OPERACOES`,
  `COMPRAS`, `FINANCEIRO`, `ADMIN`).
- RBAC de navegação no frontend: módulos fora do perfil aparecem
  desabilitados e bloqueados mesmo por URL direta. Validado manualmente com
  um usuário real por perfil.
- Auditoria transacional em toda operação de negócio e autenticação, com
  identidade do operador.

### Estoque e WMS
- Produtos PCE, lotes rastreáveis com quarentena/bloqueio físico
  (`DISPONIVEL`, `QUARENTENA`, `BLOQUEADO`) — todas as movimentações
  (`ENTRADA`, `SAIDA`, `AJUSTE`, `TRANSFERENCIA`) exigem lote disponível,
  sem exceções.
- Desmembramento de lote entre paióis (split) rastreável.
- Paióis com capacidade NEQ, ativação/inativação com trava de saldo zero.
- Mapa Mensal SFPC/R-105 (Exército Brasileiro) interativo.
- Tela integrada: posição de estoque, lotes, paióis, movimentações, mapa SFPC.

### Cadastros
- Clientes: CPF/CNPJ, validade de CR, classes PCE autorizadas.
- Blasters/equipes: carteira profissional, validade, teste de aptidão.
- Fornecedores: cadastro com CR.

### Compras
- Pedidos de compra, recebimento físico com validação de capacidade NEQ do
  paiol, geração automática de conta a pagar.

### Comercial e vendas
- Tabelas de preço e promoções (desconto fixo ou percentual), com motor de
  precedência garantindo sempre o menor preço efetivo.
- Orçamentos: emissão, consulta, cancelamento, **edição completa** com lock
  pessimista, envio assíncrono por e-mail, conversão em venda.
- PDV: checkout de balcão e vendas faturadas.
- Devoluções, incluindo vendas legadas sem lançamento financeiro prévio
  (idempotente).
- Relatório de conversão de orçamentos (volume, taxa de conversão, ticket
  médio).

### Operações e Ordens de Serviço
- Ciclo completo: orçamento → aprovação (com blaster/ART) → montagem →
  conclusão/cancelamento.
- Edição de orçamento de OS antes da aprovação, com persistência validada
  manualmente contra o backend real.
- Encerramento com quantidades disparadas e geração automática de conta a
  receber.

### Financeiro
- Contas a pagar/receber com filtros por direção, status e vencimento.
- Parcelamento nativo (número de parcelas, intervalo em dias ou datas
  customizadas, rateio exato de centavos, agrupamento visual).
- Baixas/pagamentos parciais com múltiplos métodos.
- Fluxo de Caixa Realizado diário.
- Aging Schedule (5 faixas de vencimento) com exposição líquida.

### Qualidade e infraestrutura de teste
- Backend: 72 testes unitários + 46 e2e, lint e build limpos.
- Frontend: 46 testes (incluindo componentes com React Testing Library +
  jsdom, infraestrutura que não existia até esta rodada), lint, typecheck e
  build limpos (20 rotas).

---

## ⏳ Pendente — desbloqueado, não feito ainda

Nenhum destes bloqueia o uso do que já está entregue; são lacunas de
validação/refinamento, não de funcionalidade ausente.

| Item | Observação | No sprint atual? |
| --- | --- | --- |
| RBAC por ação (não só por módulo) | Avaliado nesta rodada: não há hoje nenhuma tela real compartilhada por mais de um perfil com permissões diferentes por ação. Não é lacuna ativa — reavaliar se isso mudar. | Não — fechado por avaliação |
| Validação de sessão expirada/refresh em múltiplos navegadores | Escopo: Chrome/Firefox/Safari desktop, versões estáveis mais recentes. Ver `Plano_Front.md` Fase 5. | **Sim** |
| Acessibilidade (contraste, navegação por teclado, labels de formulário) | Ver `Plano_Front.md` Fase 6. | **Sim** |
| Responsividade completa | Só houve smoke test pontual (estoque, viewport mobile); próximo sprint cobre as 9 telas integradas em 3 breakpoints. Ver `Plano_Front.md` Fase 6. | **Sim** |
| Permissões de banco de dados e rotina de backup | Documentadas como runbook de implantação em `backend/README.md`, mas não provisionadas neste repositório — é decisão de infraestrutura de produção, não de código. | Não |

---

## 🔒 Bloqueado — requer decisão explícita antes de iniciar

Nada deste escopo foi iniciado, por decisão deliberada registrada desde o
início do projeto (`agentes/back.md`, `agentes/front.md`, `Plano_Backend.md`
Fase 3, `Plano_Front.md` Fase 7). Envolve integrações com sistemas oficiais
de alto custo de retrabalho se o contrato mudar depois de implementado:

- Emissão fiscal: NF-e, NFS-e, MDF-e.
- Guias de Tráfego (regulamentação do Exército).
- Integração bancária: importação de extratos (OFX/CNAB), conciliação,
  tratamento de divergências.
- Telas correspondentes no frontend (dependem do contrato de API acima
  estar definido — construir a UI antes é retrabalho garantido).

---

## Achados corrigidos nas últimas rodadas (para contexto do sprint)

Registrados aqui porque influenciam o que ainda merece atenção de QA:

- Bug crítico de proxy BFF que zerava o corpo de toda requisição `PUT`/
  `PATCH` (corrigido; motivou a adoção de testes de componente).
- Segredo TOTP em texto plano (corrigido: AES-256-GCM).
- Reconexão permanentemente abandonada do cliente Redis do rate limiter após
  instabilidade transitória (corrigido: `retryStrategy` nunca desiste).
- Janela de corrida real entre checar e contabilizar tentativas de login
  (corrigido: checagem + incremento atômicos em uma única operação).
- Assimetria `ENTRADA`/`QUARENTENA` no estoque (corrigido).
- Tela Financeiro exibindo "R$ NaN" em Amortizado/Saldo Devedor, e modal de
  pagamento com valor/limite inválidos (corrigido; encontrado só porque a
  tela foi aberta de verdade no navegador — nenhum teste automatizado
  cobria essa renderização antes).

Padrão a observar: os bugs mais graves encontrados até aqui foram todos de
**integração real** (campo com nome errado, corpo de requisição descartado,
processo rodando código desatualizado) — nenhum teste unitário ou e2e de API
os pegou sozinho. Vale considerar manter smoke test manual no navegador como
parte do critério de aceite de fases futuras, não só suíte automatizada.
