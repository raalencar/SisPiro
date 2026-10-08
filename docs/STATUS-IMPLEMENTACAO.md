# Status da implementação SisPiro ERP

Atualizado em 7 de outubro de 2026. Este documento resume as entregas existentes
no backend e no frontend e registra trabalho ainda necessário. O estado dos
endpoints de negócio deve ser confirmado também contra a versão efetivamente
implantada da API.

## Entregue no backend

- API NestJS/TypeScript com PostgreSQL, Prisma, Redis/BullMQ e documentação
  OpenAPI.
- Autenticação JWT com login, bootstrap inicial, refresh rotativo, logout,
  alteração de senha, usuários e perfis por módulo.
- Auditoria transacional para operações de negócio e autenticação, incluindo
  identidade do operador autenticado em novos registros.
- Seed DEMO local idempotente, com dados fictícios para os módulos e guardas
  contra execução fora de ambiente de desenvolvimento/loopback.
- Estoque/WMS: produtos PCE, lotes rastreáveis, paióis, capacidade NEQ,
  recebimentos e movimentos de estoque, reservas e resumo de posição/validade.
- Cadastros e operações para clientes, blasters, fornecedores/compras,
  tabelas de preços e promoções, orçamentos/vendas/devoluções, ordens de serviço
  e contas a pagar/receber e relatórios financeiros.
- Documentação das rotas, regras de domínio, seed e lacunas no
  [`backend/README.md`](../backend/README.md).

## Entregue no frontend

- Navegação Next.js e verificação de liveness/readiness da API.
- BFF same-origin para login, sessão, renovação e logout; os tokens ficam em
  cookies `HttpOnly`, `SameSite=Lax`, com `Secure` em produção.
- Estoque/WMS conectado a produtos, lotes, paióis e histórico de movimentos,
  com paginação e busca onde a API oferece esses filtros.
- Resumo de estoque e alertas de vencimento, quando disponíveis na instância
  implantada.
- Formulários de produto, paiol, recebimento de lote e movimentações de entrada,
  saída, ajuste e transferência.
- Estados explícitos de carregamento/erro e apresentação das mensagens de
  validação retornadas pela API.
- Documentação de setup e escopo em [`frontend/README.md`](../frontend/README.md).

## Trabalho pendente no backend

### Segurança e preparação para produção

- Implementar limitação de tentativas de login, recuperação de senha e MFA,
  conforme requisitos aprovados.
- Validar controles de segurança, política/retensão de auditoria, permissões do
  banco, CORS, gestão de segredos, backups e monitoramento no ambiente de
  implantação.
- Fazer revisão de segurança e testes de concorrência antes de expor a API à
  internet.

### Domínio e integrações

- Definir e implementar emissão fiscal e integrações oficiais para NF-e,
  NFS-e, MDF-e e Guias de Tráfego, com validação regulatória.
- Definir integração bancária, importação de extratos, conciliação e tratamento
  de divergências.
- Avaliar necessidade de relatórios operacionais/regulatórios adicionais,
  projeções financeiras, envio/edição de orçamentos e evolução de promoções.
- Continuar especificando regras de negócio e contratos OpenAPI antes de ampliar
  endpoints ou telas.

### Compatibilidade da instância local

O controlador atual declara `GET /inventory/reports/stock-summary`, porém a
instância local consultada durante esta entrega respondeu `404` e não listou a
rota no OpenAPI servido. Confirme que o backend está executando o build atual,
reinicie-o e valide a rota no OpenAPI e com uma chamada autenticada. Até isso
ocorrer, a interface reporta que o resumo está indisponível e mantém acessíveis
as listas de produtos, lotes, paióis e movimentos.

## Trabalho pendente no frontend

- Integrar à interface as APIs já disponíveis para clientes, blasters, compras,
  vendas/orçamentos/devoluções, ordens de serviço e financeiro/relatórios.
- Definir fluxos por perfil e ocultar/desabilitar ações indisponíveis para o
  usuário; a autorização continua obrigatoriamente no backend.
- Validar as jornadas completas com usuários/perfis não administradores, erros
  de autorização, sessão expirada e refresh em navegadores suportados.
- Validar responsividade e acessibilidade das telas integradas com usuários.
- Implementar telas de faturamento e regulatório somente após endpoints e regras
  oficiais estarem disponíveis e aprovados.

## Limites funcionais explícitos

- O backend não oferece atualmente edição/exclusão para produtos, paióis, lotes
  e movimentos de estoque; o frontend não inventa essas operações.
- Transferência de estoque movimenta o saldo integral do lote no modelo atual;
  divisão requer lotes distintos rastreáveis.
- A API permanece responsável pela autorização final, capacidade NEQ, validade,
  reservas, consistência transacional e auditoria.
- Dados com prefixo/identificação DEMO são fictícios e não devem ser usados em
  operação real nem em produção.

## Verificação executada nesta entrega

- Frontend: `npm run lint`, `npm run typecheck`, `npm test` (13 testes) e
  `npm run build`.
- Frontend no navegador: login DEMO e consulta de produtos, lotes, paióis e
  movimentações.
- API local: readiness respondeu com PostgreSQL e Redis disponíveis; o
  endpoint do resumo divergiu da versão esperada no código-fonte, como anotado
  acima.

Para requisitos de execução, endpoints e regras detalhadas, consulte
[`backend/README.md`](../backend/README.md) e
[`frontend/README.md`](../frontend/README.md).
