# Frontend SisPiro ERP

Interface web em Next.js 16 e React 19, em português do Brasil. A integração
usa a API NestJS do diretório `../backend`.

## Requisitos e execução local

- Node.js 20.9 ou superior e npm
- API e serviços locais configurados conforme [`../backend/README.md`](../backend/README.md)

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost:3001`. Por padrão, o frontend chama a API em
`http://localhost:3000` com prefixo `/api/v1`. Para configurar outra origem,
altere `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_API_PREFIX` em `.env.local`. Essas
variáveis são públicas: não coloque credenciais ou tokens nelas.

## Dados de demonstração

Para visualizar o seed, habilite e aplique o seed local conforme a documentação
do backend. Entre com `demo.admin@local.test` e com a senha configurada em
`DEV_SEED_ADMIN_PASSWORD`. Use esses dados somente no ambiente local de
desenvolvimento.

## Integrações disponíveis

- **Autenticação:** login, consulta de sessão e logout via rotas same-origin
  do Next.js. Os tokens de acesso e renovação ficam em cookies `HttpOnly`,
  `SameSite=Lax`, com escopo `/api`; o cliente não usa `localStorage` nem
  `sessionStorage` para tokens.
- **Estoque e WMS:** resumo de estoque (quando a rota estiver disponível na
  instância da API), catálogo de produtos, lotes, paióis e histórico de
  movimentações.
- **Operações de estoque:** cadastro de produtos e paióis, recebimento de lote,
  entrada, saída, ajuste e transferência, sempre delegando ao backend as
  validações de licença, validade, reservas e capacidade NEQ.
- **Ordens de serviço:** lista e relatório por período, criação de orçamento,
  consulta detalhada, aprovação com blaster/ART, início da montagem,
  cancelamento seguro (inclusive em montagem com liberação de reservas) e encerramento com quantidades
  efetivamente disparadas. Aprovação, cancelamento e fechamento delegam reservas, consumo e
  lançamento a receber às transações do backend.
- **Autorização:** a API é a autoridade para autenticação e perfis. A tela
  apresenta somente as transições compatíveis com a situação atual da OS e
  informa erros de acesso retornados pelo backend; a API continua validando
  perfil e regras de negócio.

A API ainda não possui endpoints de edição ou exclusão de produtos, paióis,
lotes e movimentos; a interface não oferece esses controles. Lotes e
movimentações preservam a trilha de auditoria.

## Rotas da interface

- `/` — visão geral e estado dos módulos.
- `/modules/inventory` — posição de estoque e abas de produtos, lotes (com controle de quarentena/bloqueio e desmembramento rastreável), paióis (com ativação/inativação controlada), movimentações e Mapa Mensal SFPC (R-105).
- `/modules/products` — catálogo de produtos (atalho para a área de estoque).
- `/modules/operations` — ordens de serviço, relatório operacional e ações de
  orçamento, aprovação, montagem, cancelamento e encerramento.
- Os demais módulos ainda apresentam estado informativo; suas APIs não estão
  integradas às telas.

O módulo de estoque agora suporta alteração de situação do lote (`DISPONIVEL`, `QUARENTENA`, `BLOQUEADO`),
desmembramento entre paióis (`/inventory/lots/:id/split`), ativação e inativação de paióis com trava de saldo zero,
e relatório consolidado de Mapa Mensal SFPC para o Exército Brasileiro.
A API agora suporta edição de orçamento via `PUT /operations/orders/:id`, mas a interface
ainda não oferece tela para essa edição; apenas o cancelamento seguro até `EM_MONTAGEM`
foi integrado. A seleção de referências usa endpoints de leitura limitados ao necessário
para operações; CPF/CNPJ e número do CR não são retornados nessas opções.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Segurança e configuração

As rotas de negócio do navegador passam pelo BFF do Next.js e usam cookies
`HttpOnly`. Não exponha access/refresh tokens no JavaScript, não os grave em
armazenamento acessível ao cliente e não use as contas DEMO fora do ambiente
local. Em produção, publique frontend e BFF sob HTTPS, configure a origem da API
corretamente e valide os controles de sessão, CORS e cookies no ambiente final.
