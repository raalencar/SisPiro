# AGENTS.md — Backend (NestJS / Prisma / PostgreSQL)

Regras específicas para trabalhar em `backend/`. Leia também o `AGENTS.md`
na raiz do repositório — contém o contexto de domínio e o checklist de
auditoria que valem para o projeto inteiro.

## Escopo

Somente `backend/`. Não editar `frontend/` nem `docs/` (exceto
`backend/README.md`, que deve ser mantido verdadeiro junto com a
implementação). Decisões de arquitetura cross-module ou que mudam limites
entre bounded contexts (ver `AGENTS.md` raiz) não são deste escopo — se uma
tarefa exigir isso, parar e perguntar antes de implementar.

## Stack

- Node.js 22+, NestJS, TypeScript, PostgreSQL 16, Prisma, Redis + BullMQ.
- Estrutura em `backend/src/modules/{auth,inventory,operations,commercial,
  procurement,finance,compliance,fiscal}`, cada um com `*.controller.ts`,
  `*.service.ts`, `*.dto.ts`.
- Schema em `backend/prisma/schema.prisma`; migrações de desenvolvimento via
  `npm run db:migrate -- --name nome_da_migracao`; aplicação em ambientes via
  `npm run db:deploy`.
- Testes com Vitest: `npm test` (unit) e `npm run test:e2e` (e2e), ambos com
  `--no-file-parallelism` — os testes compartilham banco, não paralelizar.
- Lint: `npm run lint` (oxlint, type-aware). Build: `npm run build` (gera
  Prisma client + compila Nest).
- Auditoria via helper `createAuditLog` (`backend/src/common/audit-log.ts`),
  chamado dentro da mesma transação da operação de negócio.
- Autenticação JWT com perfis por módulo: `ESTOQUE`, `COMERCIAL`,
  `OPERACOES`, `COMPRAS`, `FINANCEIRO`, `ADMIN`. Toda rota de negócio nova
  precisa declarar o guard de perfil correto.

## Regras de domínio obrigatórias

Estas regras vêm de `backend/README.md` e não são opcionais em código novo:

- **Lote mandatório:** nenhuma entrada/saída de item PCE sem número de lote,
  data de fabricação, validade e fabricante/importador.
- **Trava de NEQ:** antes de gravar qualquer aumento de estoque físico em um
  paiol, validar `NEQ_total <= capacidade_paiol` dentro da transação, com
  bloqueio de linha do paiol. Se exceder, bloquear a operação.
- **Sem saldo negativo:** saídas nunca podem deixar saldo negativo.
- **Lotes vencidos:** bloqueados para saída, transferência e desmembramento
  (`split`). Devoluções só reentram em lote não vencido.
- **Paiol inválido para recebimento:** paiol inativo ou com licença de
  Bombeiros vencida não recebe estoque.
- **Reservas:** o saldo "disponível" exclui reservas ativas de OS e de
  orçamentos comerciais vigentes. Saídas/transferências/ajustes negativos
  independentes não podem consumir saldo reservado.
- **PCE em vendas/OS:** cliente precisa estar ativo, com CR dentro da
  validade e autorizado para todas as classes envolvidas.
- **Concorrência:** operações sobre o mesmo lote/paiol devem ser
  serializadas via transação + lock de linha (`SELECT ... FOR UPDATE` ou
  equivalente Prisma), nunca por lock em memória da aplicação.
- **Auditoria:** toda gravação de negócio relevante grava audit log na
  mesma transação, com o usuário autenticado como ator.
- **Dinheiro e NEQ são `Decimal`**, nunca `number`/`float`.

## Fora de escopo (não implementar sem aprovação explícita)

Emissão de NF-e, NFC-e e NFS-e, Guia de Tráfego Militar, cobrança PIX e
conciliação bancária via extrato OFX **já estão implementados** (Frentes
1-3, ver `docs/STATUS-IMPLEMENTACAO.md`) — não são fora de escopo.
Evoluções nesses fluxos seguem o workflow normal, sem aprovação especial
além do contrato de arquitetura.

Continuam fora de escopo sem aprovação explícita: emissão de MDF-e e
importação de extrato bancário em formato CNAB (só OFX está implementado) —
lacunas documentadas em `docs/STATUS-IMPLEMENTACAO.md` (Fase 3). Se uma
tarefa parecer exigir uma delas, parar e perguntar antes de avançar.

MFA, recuperação de senha, rate limiting de login e parcelamento de
lançamentos financeiros **já estão implementados** (Fases 1 e 2, ver
`backend/README.md`) — não são fora de escopo.

Também não implementar edição/exclusão de produtos, paióis, lotes e
movimentos de estoque — a API deliberadamente não oferece essas operações
hoje (ver "Limites funcionais explícitos" em `docs/STATUS-IMPLEMENTACAO.md`).

## Workflow esperado

1. Ler o contrato/instrução recebida identificando módulo, rota, DTO e
   regra de negócio exata.
2. Verificar `backend/README.md` para confirmar que a mudança é compatível
   com o que já está documentado como comportamento atual.
3. Implementar: schema (se necessário) → migração → DTO → service →
   controller → testes e2e cobrindo a regra nova (positivo e negativo).
4. Rodar `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`
   localmente antes de considerar pronto.
5. Atualizar `backend/README.md` (e sinalizar se
   `docs/STATUS-IMPLEMENTACAO.md` também precisa mudar).
6. Entregar para revisão (checklist de auditoria no `AGENTS.md` raiz).

## Regras de estilo

- Identificadores de código em inglês; textos de domínio/erros voltados ao
  usuário em português, consistente com o restante do backend.
- Sem comentários explicando o óbvio; comentar apenas invariantes não
  óbvias (ex.: por que um lock específico é necessário).
- Não adicionar dependências novas sem necessidade clara ligada à tarefa.
