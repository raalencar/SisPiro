# Backend ERP Pirotécnico

API modular em NestJS/TypeScript, com PostgreSQL 16, Prisma, Redis e BullMQ.
Os módulos refletem os contextos da especificação: compliance, estoque/WMS,
operações, comercial e financeiro.

## Requisitos

- Node.js 22 ou superior e npm
- Docker com Docker Compose

## Desenvolvimento local

```bash
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run db:generate
npm run db:deploy
npm run start:dev
```

A API usa o prefixo configurado em `API_PREFIX` (por padrão, `/api/v1`).
Documentação OpenAPI: `/api/v1/docs`. Liveness: `/api/v1/health/live`.
Readiness, incluindo PostgreSQL e Redis: `/api/v1/health/ready`.

O Compose expõe PostgreSQL e Redis apenas em `localhost` (portas padrão `55432`
e `56379`) e persiste os dados em volumes Docker. Ajuste `POSTGRES_PASSWORD` e
`DATABASE_URL` em `.env` para manter os valores consistentes. `.env` não deve
ser versionado nem usado com credenciais locais em produção. Se as portas
alternativas também estiverem ocupadas, altere `POSTGRES_HOST_PORT` e
`REDIS_HOST_PORT`, mantendo `DATABASE_URL` e `REDIS_PORT` alinhados.

## Comandos úteis

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
npm run db:studio
```

Use `npm run db:migrate -- --name nome_da_migracao` para criar uma migração de
desenvolvimento e `npm run db:deploy` para aplicar migrações já versionadas em
ambientes de implantação a partir de um runner com as dependências do projeto
instaladas.

## Persistência e regras de domínio

`prisma/schema.prisma` inicia a modelagem de produtos, lotes, paióis, clientes
(incluindo classes PCE autorizadas), blasters, ordens de serviço, movimentações
de estoque e auditoria. Quantidades e NEQ usam `Decimal`; os fluxos iniciais de
estoque usam transações PostgreSQL, bloqueios concorrentes e validação de
capacidade do paiol antes de gravar.

### Endpoints de estoque/WMS disponíveis

Todos usam o prefixo configurado (`/api/v1` por padrão):

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/inventory/products` | Lista e cadastra produtos/PCE |
| `GET` | `/inventory/products/:id` | Consulta produto |
| `GET` / `POST` | `/inventory/magazines` | Lista/cria paióis; lista inclui NEQ atual e capacidade restante |
| `GET` | `/inventory/magazines/:id` | Consulta paiol e capacidade |
| `GET` / `POST` | `/inventory/lots` | Lista lotes ou registra lote com recebimento inicial |
| `GET` | `/inventory/lots/:id` | Consulta lote, produto, paiol e NEQ |
| `GET` / `POST` | `/inventory/movements` | Consulta histórico ou registra movimentação |

As listas aceitam `page` e `limit` (máximo 100); produtos aceitam `search`,
`type` e `isPce`, lotes aceitam `search`, `productId` e `magazineId`, e
movimentações aceitam `search`, `productLotId` e `type`.

O recebimento inicial e as entradas/ajustes positivos validam a capacidade em
NEQ/kg dentro de transações que bloqueiam a linha do paiol. Transferências também
validam a capacidade do destino e, devido ao modelo atual de lote vinculado a
um único paiol, precisam mover o saldo integral do lote. Para dividir estoque,
cadastre lotes separados com rastreabilidade própria. Saídas impedem saldo
negativo; saídas e transferências bloqueiam lotes vencidos. Paiol inativo ou com
licença dos Bombeiros vencida não recebe estoque. Cada gravação cria um registro
de auditoria na mesma transação; a identificação do ator ficará nula até existir
autenticação.

### Compras e fornecedores

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/suppliers` | Lista ou cadastra fornecedor com CPF/CNPJ e documentação de CR |
| `GET` / `PATCH` | `/suppliers/:id` | Consulta e atualiza dados, CR, classes PCE e estado ativo |
| `GET` / `POST` | `/purchases` | Lista pedidos ou cria pedido pendente com produtos, quantidades e custos |
| `GET` | `/purchases/:id` | Consulta fornecedor, itens e recebimentos da compra |
| `POST` | `/purchases/:id/receive` | Registra recebimento parcial ou integral criando lotes e entradas |
| `POST` | `/purchases/:id/cancel` | Cancela pedido pendente |

O recebimento aceita parte dos itens ou quantidades. Para cada lote recebido,
informe número, fabricação, validade, fabricante/importador, paiol e quantidade;
informe também a data de vencimento e a referência fiscal da etapa. O total
acumulado não pode superar o pedido. Uma linha de compra pode ser recebida em
lotes diferentes, e o status passa por `PENDENTE`, `PARCIAL` e `RECEBIDO`;
pedidos já recebidos ou cancelados não aceitam novos recebimentos. Lotes,
recebimentos, movimentos, uma conta a pagar por etapa e auditoria são gravados
atomicamente. O valor da conta corresponde à soma dos custos unitários dos
itens multiplicados pelas quantidades recebidas naquela etapa; fornecedor,
vencimento e referência fiscal também são associados ao lançamento. A operação
verifica capacidade NEQ e licença do paiol. Para PCE, o fornecedor precisa estar
ativo e ter CR vigente e classe autorizada cadastrados. Essa validação não
consulta sistemas oficiais.

### Endpoints de clientes e profissionais

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/customers` | Lista e cadastra clientes |
| `GET` / `PATCH` | `/customers/:id` | Consulta e atualiza cadastro, CR e classes autorizadas |
| `POST` | `/customers/:id/pce-eligibility` | Avalia CR cadastrado para as classes solicitadas |
| `GET` / `POST` | `/blasters` | Lista e cadastra blasters |
| `GET` / `PATCH` | `/blasters/:id` | Consulta e atualiza cadastro e habilitação |
| `POST` | `/blasters/:id/eligibility` | Avalia a validade cadastrada para uma data de evento |

As duas listas aceitam paginação e busca; também aceitam `active=true|false`.
CPF/CNPJ são normalizados para dígitos e têm dígitos verificadores conferidos.
CR informado exige número e validade; a avaliação PCE verifica estado ativo,
prazo do CR e classes autorizadas no cadastro. A avaliação do blaster compara
estado ativo e validade da habilitação com a data do evento.

Essas avaliações usam somente os dados mantidos localmente: não consultam
Exército, CREA/CFT ou outros sistemas oficiais e não substituem conferência
documental. Criações e atualizações registram audit log na mesma transação.

### Tabelas de preço e vendas/PDV

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/pricing/lists` | Lista ou cria tabelas de preço com preços unitários por produto |
| `GET` | `/pricing/lists/:id` | Consulta tabela e itens |
| `GET` | `/sales` | Lista vendas finalizadas com paginação |
| `GET` | `/sales/:id` | Consulta venda, cliente, preços e itens |
| `POST` | `/sales` | Finaliza checkout/PDV e baixa estoque atomicamente |
| `GET` | `/sales/:id/returns` | Consulta devoluções registradas para uma venda |
| `POST` | `/sales/:id/returns` | Registra devolução parcial/total e reentrada rastreável |

Uma venda informa tabela de preço, lotes e quantidades. Os preços unitários e
subtotais são copiados para a venda no checkout, preservando o valor praticado.
Venda de balcão sem cliente identificado é permitida somente para produtos não
PCE. Produtos PCE exigem cliente ativo, CR dentro da validade e autorização para
todas as classes incluídas. A finalização bloqueia lotes vencidos, saldo já
reservado por OS e estoque insuficiente, criando movimentações de saída e
auditoria na mesma transação. O checkout concorrente do mesmo lote é serializado.

Devoluções identificam os itens da venda original e aceitam quantidades parciais,
limitadas ao saldo ainda não devolvido. O sistema reentra os produtos no lote
original somente se o lote não estiver vencido e o paiol puder recebê-los sem
exceder capacidade NEQ; registro, movimentações e auditoria são atômicos. Isso
controla a devolução física, mas não realiza estorno financeiro nem cancelamento
de documento fiscal.

Este ciclo ainda não oferece orçamentos/carrinho persistente, tabela promocional
ou integração fiscal. Não emite NF-e, NFS-e, MDF-e ou Guia de Tráfego.

### Endpoints de ordens de serviço

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/operations/orders` | Lista OS com paginação, busca e filtro; cria orçamento |
| `GET` | `/operations/orders/:id` | Consulta OS, itens, cliente e situação da reserva |
| `POST` | `/operations/orders/:id/approve` | Valida cliente/CR, blaster, lotes e reserva o estoque |
| `POST` | `/operations/orders/:id/start` | Inicia montagem mantendo a reserva |
| `POST` | `/operations/orders/:id/cancel` | Cancela orçamento/aprovação e libera a reserva |
| `POST` | `/operations/orders/:id/close` | Registra quantidades queimadas e baixa consumo real |

A criação gera um orçamento sem reservar estoque. A aprovação verifica
elegibilidade do cliente e do blaster, validade dos lotes e disponibilidade,
serializando aprovações concorrentes por lote. A reserva é derivada dos itens
planejados das OS em `APROVADO` ou `EM_MONTAGEM`; saídas, transferências e
ajustes negativos independentes não podem consumir quantidades reservadas.
Cancelar ou encerrar a OS libera a reserva. No encerramento, a baixa é baseada
na quantidade efetivamente queimada, e as sobras voltam a ficar disponíveis.
O relatório de queima e as movimentações ficam registrados na auditoria.

### Contas a pagar/receber e fluxo de caixa

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/finance/entries` | Lista ou cria contas a pagar (`PAGAR`) e receber (`RECEBER`) |
| `GET` | `/finance/entries/:id` | Consulta lançamento, pagamentos, valor pago e saldo pendente |
| `POST` | `/finance/entries/:id/payments` | Registra pagamento/recebimento parcial ou quitação |
| `POST` | `/finance/entries/:id/cancel` | Cancela lançamento aberto sem pagamentos |
| `GET` | `/finance/cash-flow?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume entradas e saídas efetivamente pagas por dia |

Lançamentos armazenam direção, categoria, contraparte, valor e vencimento; o
cliente é opcional para contas a receber. Pagamentos são imutáveis neste fluxo,
serializados por lançamento para impedir quitação acima do saldo. O status muda
entre `ABERTO`, `PARCIAL` e `PAGO`; lançamentos sem pagamentos podem ser
`CANCELADO`. `overdue` sinaliza saldo pendente cujo vencimento passou. O fluxo de
caixa representa pagamentos realizados, não projeções futuras.

Lançamentos avulsos continuam manuais; cada recebimento de compra gera
automaticamente uma conta a pagar vinculada à etapa recebida. Vendas e ordens de
serviço ainda não geram lançamentos automaticamente. Não há integração bancária,
conciliação, parcelamento ou estorno de pagamentos. Emissão fiscal, Guias de
Tráfego, mapas regulatórios e relatórios avançados ainda não estão expostos pela
API. As telas do frontend também ainda não consomem estes endpoints.

Os endpoints atuais não têm autenticação/autorização e são destinados somente ao
desenvolvimento local. Antes da produção, implemente controle de acesso e
identidade do operador, trilha de auditoria append-only (incluindo permissões de
banco), revisão dos fluxos regulatórios e testes de concorrência das regras de
estoque.

### Lacunas conhecidas e próximos módulos

Os itens abaixo **não estão implementados**. São próximos escopos candidatos;
as rotas e regras detalhadas devem ser definidas antes de iniciar cada módulo.

| Área | Situação atual | Trabalho pendente |
| --- | --- | --- |
| Acesso e operadores | API sem autenticação ou autorização; auditoria sem identidade do ator | Endpoints e fluxo de login, usuários, perfis/permissões e identificação do operador nas gravações |
| Financeiro de vendas e OS | Contas avulsas são manuais; compras geram contas a pagar por recebimento | Definir e implementar geração de contas a receber conforme checkout/venda e regras de cobrança de OS |
| Devolução e financeiro | Devolução reentra estoque; não gera estorno financeiro | Definir e registrar estorno/crédito vinculado à devolução e à venda original |
| Orçamentos comerciais | OS cria orçamento operacional; não existe carrinho/orçamento persistente de venda | Persistência, consulta e conversão de orçamento/carrinho em venda |
| Preços promocionais | Tabelas de preço básicas implementadas | Regras de promoção, vigência e precedência de preços |
| Fiscal e regulatório | Sem emissão fiscal ou integração oficial | Integrações e fluxos de NF-e, NFS-e, MDF-e e Guias de Tráfego, sujeitos à validação regulatória |
| Bancos | Sem integração bancária ou conciliação | Importação/integração de extratos, conciliação e tratamento de divergências |
| Relatórios | Listagens operacionais e fluxo de caixa realizado disponíveis | Relatórios gerenciais, regulatórios e projeções financeiras |
| Frontend de negócio | Telas de negócio ainda não consomem as APIs | Integrar os módulos existentes à interface |

Esta lista registra lacunas conhecidas, não constitui contrato final de API nem
garante que todos os itens pertençam ao escopo aprovado do produto. A API não
deve ser exposta em produção antes da implementação e validação de autenticação,
autorização e demais controles de segurança.

## Container de produção

```bash
docker build -t erp-pirotecnico-backend .
```

O container inicia a API; migrações são executadas separadamente com
`npm run db:deploy` no processo de implantação.
