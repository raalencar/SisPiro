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
- **Autorização:** a API é a autoridade para autenticação e perfis. A tela
  informa erros de acesso retornados pelo backend; ocultação de ações por perfil
  ainda não foi implementada.

A API ainda não possui endpoints de edição ou exclusão de produtos, paióis,
lotes e movimentos; a interface não oferece esses controles. Lotes e
movimentações preservam a trilha de auditoria.

## Rotas da interface

- `/` — visão geral e estado dos módulos.
- `/modules/inventory` — posição de estoque e abas de produtos, lotes, paióis e
  movimentações.
- `/modules/products` — catálogo de produtos (atalho para a área de estoque).
- Os demais módulos ainda apresentam estado informativo; suas APIs não estão
  integradas às telas.

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
