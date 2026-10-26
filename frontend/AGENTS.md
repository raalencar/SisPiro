<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Frontend (Next.js / React)

Regras específicas para trabalhar em `frontend/`. Leia também o `AGENTS.md`
na raiz do repositório — contém o contexto de domínio e o checklist de
auditoria que valem para o projeto inteiro.

## Escopo

Somente `frontend/`. Não editar `backend/` nem `docs/` (exceto
`frontend/README.md`, mantido verdadeiro junto com a implementação). Não
inventar campos, rotas ou operações que a API não expõe.

## Stack

- Next.js 16 (App Router, `next dev --port 3001`), React 19, TypeScript,
  Tailwind CSS (sem Radix/Shadcn instalado — não assumir que existem).
- Estrutura: `frontend/src/app` (rotas/páginas e `app/api/*` como BFF),
  `frontend/src/components`, `frontend/src/lib` (`api.ts`, `server-auth.ts`).
- Testes: Vitest (`npm test`). Lint: ESLint (`npm run lint`). Tipos:
  `npm run typecheck` (`tsc --noEmit`). Build: `npm run build`
  (`next build --webpack`).
- Interface em português do Brasil.
- Variáveis públicas: `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_API_PREFIX` —
  nunca colocar segredos ou tokens nelas.

## Regra de segurança não negociável

O backend emite tokens JSON simples e **não** define cookies. O frontend é
responsável por isso via BFF:

- Toda chamada de negócio do navegador passa por rotas same-origin do
  Next.js (`frontend/src/app/api/**`), que fazem proxy para a API e
  retornam/aceitam cookies `HttpOnly`, `SameSite=Lax`, `Secure` em
  produção, com escopo `/api`.
- **Nunca** armazenar access/refresh tokens em `localStorage`,
  `sessionStorage` ou qualquer lugar acessível a JavaScript do cliente.
  Isso vale também para qualquer novo fluxo (ex.: notificações, cache
  local) — nada que toque token pode sair do BFF.
- A API é a autoridade final de autenticação/autorização. A UI só reflete
  estado (esconder/desabilitar ações), nunca implementa a regra de
  permissão por conta própria.

## Regras de produto

- Não inventar operações que a API não oferece. Hoje não há edição/exclusão
  de produtos, paióis, lotes ou movimentos de estoque — não criar esses
  controles na UI.
- Não expor dados que os endpoints operacionais reduzidos (`/operational-
  options`, `/operational-lots`) deliberadamente omitem (CPF/CNPJ, número de
  CR) em telas de Operações/OS.
- Mostrar apenas as transições de estado que a API realmente aceita para o
  status atual de uma entidade (ex.: OS em `ORCAMENTO` vs `APROVADO`).
- Estados explícitos de carregamento e erro; apresentar as mensagens de
  validação retornadas pela API ao usuário, sem reescrevê-las.
- Clientes, blasters (`/modules/teams`), compras, comercial e financeiro já
  estão integrados (`CustomersWorkspace`, `TeamsWorkspace`,
  `PurchasesWorkspace`, `CommercialWorkspace`, `FinanceWorkspace`) — não são
  módulos pendentes. Telas de NF-e/NFC-e/NFS-e (`/modules/billing`), Guia de
  Tráfego (`/modules/compliance`) e cobrança PIX/conciliação OFX
  (Financeiro) também já existem — evoluções nessas áreas seguem o workflow
  normal.
- Não implementar UI de MDF-e ou importação de extrato CNAB antes de
  endpoint aprovado — essas são as únicas lacunas de domínio ainda
  bloqueadas.

## Workflow esperado

1. Confirmar o contrato de API (rota, DTO de resposta, perfil exigido) antes
   de escrever a tela.
2. Implementar a rota BFF em `app/api/**` se necessário, depois a página/
   componente consumindo `lib/api.ts`.
3. Cobrir com teste (Vitest) o caminho feliz e pelo menos um caso de erro/
   estado vazio.
4. Rodar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
5. Testar a jornada manualmente (servidor dev) quando a mudança afetar UI
   visível — não declarar "funciona" sem ter visto a tela.
6. Atualizar `frontend/README.md` e entregar para revisão (checklist de
   auditoria no `AGENTS.md` raiz).

## Regras de estilo

- Identificadores de código em inglês; textos de UI em português.
- Sem abstração prematura de componentes "genéricos" para um único caso de
  uso.
- Reutilizar padrões já existentes em `operations-workspace.tsx` e módulos
  de estoque antes de criar um padrão novo de tela.
