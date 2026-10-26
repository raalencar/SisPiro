# AGENTS.md — SisPiro ERP

Instruções para qualquer agente de IA (Antigravity, Claude Code ou outro)
trabalhando neste monorepo. Este arquivo cobre o projeto como um todo —
arquitetura, invariantes de domínio e o checklist de auditoria antes de
qualquer entrega. Regras específicas de cada área vivem em
`backend/AGENTS.md` e `frontend/AGENTS.md`: leia o arquivo da pasta em que
for trabalhar **além** deste.

## Visão geral

Monorepo: API NestJS + Prisma + PostgreSQL em `backend/`, interface Next.js
+ React em `frontend/`. Sistema de gestão (ERP) para empresas que operam
com **Produtos Controlados pelo Exército (PCE)** — fogos de artifício, shows
pirotécnicos, transporte especializado.

## Contexto do domínio (não negociável)

- **NEQ (Carga Líquida Explosiva):** todo paiol tem capacidade máxima em
  NEQ/kg. Qualquer operação que aumente o estoque físico de um paiol
  (recebimento, entrada, ajuste positivo, transferência, devolução) deve
  validar a capacidade NEQ **dentro da mesma transação**, com bloqueio de
  linha, antes de gravar.
- **Rastreabilidade de lote obrigatória:** nenhum item PCE entra ou sai do
  estoque sem lote, data de fabricação, validade e fabricante/importador.
- **Licenças e habilitações têm validade:** Blasters (técnicos) e CR de
  clientes expiram; a lógica de negócio precisa reavaliar a validade na data
  relevante (data do evento, data da operação), não apenas no cadastro.
  Nenhuma dessas avaliações consulta sistemas oficiais (Exército,
  CREA/CFT) — isso é uma limitação conhecida e deliberada, não um bug.
- **Auditoria append-only:** toda gravação de negócio relevante cria um
  registro de auditoria na mesma transação, identificando o usuário
  autenticado. Registros históricos antigos podem ter ator nulo — isso é
  esperado, não corrigir retroativamente.
- **Já implementados** (não são lacunas, não reimplementar do zero):
  MFA, recuperação de senha, rate limiting de login, parcelamento de
  lançamentos financeiros (Fases 1-2); emissão de NF-e, NFC-e e NFS-e,
  Guia de Tráfego Militar, cobrança PIX dinâmica e conciliação bancária via
  extrato OFX (Frentes 1-3). Ver `docs/STATUS-IMPLEMENTACAO.md` para o
  detalhe de cada um. Evoluções nesses fluxos seguem o workflow normal, sem
  aprovação especial.
- **Fora de escopo até aprovação explícita do usuário:** emissão de MDF-e,
  importação de extrato bancário em formato CNAB, e edição/exclusão de
  produtos, paióis, lotes ou movimentos de estoque (a API deliberadamente
  não oferece essas operações hoje). Se uma tarefa parecer exigir uma
  dessas, parar e perguntar antes de avançar — não é um convite para
  iniciativa própria.

## Bounded contexts (DDD)

1. **Compliance & Regulatório (PCE)** — validação de CR, alvarás, Guia de
   Tráfego. Módulo `backend/src/modules/compliance`.
2. **Estoque Especializado & WMS** — paióis, lotes, NEQ. Módulo
   `backend/src/modules/inventory`.
3. **Operações de Shows & Serviços (OS)** — orçamento → aprovação → montagem
   → encerramento. Módulo `backend/src/modules/operations`.
4. **Comercial & Faturamento** — vendas, orçamentos comerciais, devoluções,
   preços/promoções, emissão fiscal. Módulos `backend/src/modules/commercial`,
   `backend/src/modules/procurement` (compras/fornecedores) e
   `backend/src/modules/fiscal`.
5. **Core Financeiro** — contas a pagar/receber, fluxo de caixa, DRE, PIX e
   conciliação bancária. Módulo `backend/src/modules/finance`.

Ao decidir onde uma nova regra deve viver, respeitar esses limites. Lógica
de NEQ/capacidade pertence a Estoque, não a Operações; lógica de
elegibilidade PCE de cliente pertence a Comercial/Clientes, não a Operações
— ainda que OS precise consumi-la via leitura reduzida (ver
`operational-options` / `operational-lots`).

## Papéis

### Arquitetura e coordenação

Antes de qualquer mudança cross-module ou de schema: desenhar o contrato
(DTOs, rotas, migração) e validar contra as regras de domínio acima antes
de implementar. Manter `README.md` raiz, `backend/README.md`,
`frontend/README.md` e `docs/STATUS-IMPLEMENTACAO.md` **verdadeiros** em
relação ao que está realmente implementado — nunca aspiracional, nunca
desatualizado; isso faz parte de terminar a tarefa, não é opcional. Recusar
scope creep: se uma mudança pedida abrir uma lacuna ainda bloqueada (MDF-e,
CNAB) sem aprovação explícita, interromper e perguntar.

### Implementação

- Mudanças em `backend/` → ler `backend/AGENTS.md` primeiro.
- Mudanças em `frontend/` → ler `frontend/AGENTS.md` primeiro.

### Auditoria — checklist antes de considerar qualquer entrega pronta

Revisão independente de quem implementou, para evitar viés de confirmação.
Não corrige o problema encontrado — reporta (arquivo, linha, cenário
concreto de falha, regra violada), a menos que explicitamente pedido para
também aplicar o fix. Lista vazia é um resultado válido; não inventar
achados para parecer produtivo.

**Qualidade geral:** `npm run lint`, `npm test`, `npm run test:e2e` e
`npm run build` no backend; `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build` no frontend — conforme o que foi alterado. Testes novos
cobrem a regra de negócio nova, incluindo caso de rejeição, não só o
caminho feliz. Sem abstrações especulativas; sem comentários explicando o
óbvio.

**Invariantes de domínio:** trava de NEQ validada em transação com lock de
linha; lote com fabricação/validade/fabricante em movimentações PCE; sem
saldo negativo; lotes vencidos bloqueados; reservas de OS/orçamento
respeitadas; elegibilidade PCE checada; auditoria gravada na mesma
transação com ator autenticado; `Decimal` para dinheiro/NEQ, nunca
`number`/`float`; guard de perfil correto (`ESTOQUE`, `COMERCIAL`,
`OPERACOES`, `COMPRAS`, `FINANCEIRO`, `ADMIN`) em toda rota nova.

**Segurança:** nenhum segredo/token em texto plano ou commitado; frontend
não grava tokens em `localStorage`/`sessionStorage`; endpoints
operacionais reduzidos (`operational-options`, `operational-lots`)
continuam sem CPF/CNPJ/CR; sem SQL cru concatenado; sem desabilitar
validação de DTO.

**Escopo:** nenhuma feature de MDF-e, importação CNAB, ou
edição/exclusão de produtos/paióis/lotes/movimentos foi introduzida sem
aprovação explícita registrada na conversa. NF-e/NFC-e/NFS-e, Guia de
Tráfego, PIX, conciliação OFX, MFA, recuperação de senha, rate limiting e
parcelamento já estão implementados — evoluir essas áreas não é scope
creep.

**Documentação:** `backend/README.md`, `frontend/README.md`,
`docs/STATUS-IMPLEMENTACAO.md` e `README.md` raiz refletem exatamente o
que foi implementado.

## Regras de engenharia gerais

- Monólito modular — não introduzir microsserviços ou filas adicionais sem
  justificativa de domínio clara.
- `Decimal` para quantidades e NEQ, nunca `float`.
- Transações PostgreSQL com bloqueio de linha para qualquer operação
  concorrente sobre o mesmo lote/paiol — nunca mutex em memória da
  aplicação.
- Sem abstrações prematuras: três linhas parecidas são melhores que uma
  abstração especulativa para um caso hipotético futuro.
- Nenhuma operação destrutiva (reset de migração, drop de tabela, force
  push) sem confirmação explícita do usuário.
