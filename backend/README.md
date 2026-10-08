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
Configure `AUTH_JWT_SECRET` com uma chave aleatória de pelo menos 32 caracteres
(`openssl rand -base64 48` é uma opção). O valor no `.env.example` é apenas um
placeholder e não deve ser usado fora do desenvolvimento local. Mantenha a API
restrita à rede confiável até concluir o bootstrap do primeiro administrador.

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

### Autenticação, usuários e perfis

| Método | Rota | Acesso | Uso |
| --- | --- | --- | --- |
| `POST` | `/auth/bootstrap` | Público, uma única vez | Cria o primeiro administrador enquanto não houver usuários |
| `POST` | `/auth/login` | Público | Autentica por e-mail e senha e inicia sessão |
| `POST` | `/auth/refresh` | Público, exige refresh token | Rotaciona o refresh token e emite novo access token |
| `POST` | `/auth/logout` | Público, exige refresh token | Revoga a sessão apresentada |
| `GET` | `/auth/me` | Autenticado | Consulta o usuário da sessão |
| `PATCH` | `/auth/me/password` | Autenticado | Altera a senha atual e revoga todas as sessões |
| `GET` / `POST` | `/users` | `ADMIN` | Lista usuários ou cria usuário com perfis |
| `GET` / `PATCH` | `/users/:id` | `ADMIN` | Consulta ou atualiza nome, perfis e estado ativo |

Envie access tokens no cabeçalho `Authorization: Bearer <token>`. O access token
JWT dura 15 minutos por padrão; o refresh token opaco expira em 30 dias, é
rotacionado a cada uso e somente seu hash é persistido. Reutilizar um refresh
token antigo revoga a sessão. As durações são configuráveis. O endpoint de
bootstrap é protegido por lock transacional e deixa de criar usuários após o
primeiro cadastro; não existe cadastro público. Senhas são armazenadas com
scrypt e os erros de login não revelam se e-mail ou senha estavam incorretos.

Perfis concedem acesso por módulo; `ADMIN` acessa todos os módulos e não pode
ser o último administrador ativo removido ou rebaixado.

| Perfil | Módulos |
| --- | --- |
| `ESTOQUE` | Estoque/WMS |
| `COMERCIAL` | Clientes, preços e vendas |
| `OPERACOES` | Blasters e ordens de serviço |
| `COMPRAS` | Fornecedores e compras |
| `FINANCEIRO` | Contas e fluxo de caixa |
| `ADMIN` | Todos os módulos e gestão de usuários |

Usuários podem receber mais de um perfil. Desativar usuário, alterar sua senha,
encerrar sessão ou detectar reutilização de refresh invalida imediatamente seus
access tokens. Os registros de auditoria das operações de autenticação e gestão
de usuários identificam o ator; os registros históricos e os fluxos de negócio
existentes ainda precisam propagar essa identidade.

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
| `GET` | `/inventory/reports/stock-summary` | Resume saldo físico, reservas, disponibilidade e lotes vencidos/próximos do vencimento |

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
O resumo de estoque considera reservas ativas de OS e orçamentos comerciais.
Exibe o saldo físico, reservado e disponível por produto e por lote; lotes
vencidos ficam separados e têm disponibilidade vendável zero. Lotes que vencem
hoje ou nos próximos 30 dias aparecem como próximos do vencimento.

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
| `GET` / `POST` | `/pricing/promotions` | Lista ou cria promoções de preço fixo por produto e vigência |
| `GET` | `/pricing/promotions/:id` | Consulta promoção e itens |
| `PATCH` | `/pricing/promotions/:id` | Ativa ou desativa promoção |
| `GET` | `/sales` | Lista vendas finalizadas com paginação |
| `GET` | `/sales/:id` | Consulta venda, cliente, preços e itens |
| `GET` | `/sales/reports/summary?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume vendas brutas, devoluções e vendas líquidas por produto e cliente |
| `POST` | `/sales` | Finaliza venda, registra recebimento ou conta a receber e baixa estoque |
| `GET` / `POST` | `/sales/quotes` | Lista orçamentos comerciais ou emite orçamento com reserva de sete dias |
| `GET` | `/sales/quotes/:id` | Consulta orçamento, itens e estado da reserva |
| `POST` | `/sales/quotes/:id/cancel` | Cancela orçamento e libera a reserva |
| `POST` | `/sales/quotes/:id/convert` | Converte orçamento vigente em venda com condição de pagamento |
| `GET` | `/sales/:id/returns` | Consulta devoluções registradas para uma venda |
| `POST` | `/sales/:id/returns` | Registra devolução parcial/total e reentrada rastreável |

Uma venda informa tabela de preço, lotes e quantidades. Os preços unitários e
subtotais são copiados para a venda no checkout, preservando o valor praticado.
Venda de balcão sem cliente identificado é permitida somente para produtos não
PCE. Produtos PCE exigem cliente ativo, CR dentro da validade e autorização para
todas as classes incluídas. A finalização bloqueia lotes vencidos, saldo já
reservado por OS ou por orçamento comercial vigente e estoque insuficiente,
criando movimentações de saída e auditoria na mesma transação. O checkout
concorrente do mesmo lote é serializado.

O relatório de vendas filtra vendas pela data de finalização e devoluções pela
data em que foram registradas. Apresenta valores brutos, devoluções e líquido
no período, com detalhamento por produto e cliente; vendas sem cliente ficam
no grupo “Venda de balcão sem cliente”. Uma devolução no período reduz o líquido
do período mesmo quando a venda original ocorreu antes dele.

Orçamentos comerciais preservam os preços cotados e reservam os lotes por sete
dias. A emissão valida cliente, tabela de preço, elegibilidade PCE, validade do
lote e saldo não comprometido, inclusive diante de outras reservas concorrentes.
Orçamentos expirados deixam de reservar saldo; cancelamento libera a reserva.
A conversão em venda preserva os preços cotados e baixa o estoque atomicamente.
Ordens de serviço e saídas, transferências ou ajustes negativos de estoque
respeitam essas reservas e não podem consumir o saldo comprometido.

Promoções usam um preço fixo por produto com início e fim inclusivos. Produtos
não podem ter promoções ativas com períodos sobrepostos; a ativação também
verifica essa regra. Na venda e na emissão de orçamento, a promoção vigente é
aplicada automaticamente somente quando seu preço for inferior ao preço da
tabela escolhida. Se não houver preço na tabela, a promoção pode fornecer o
preço; se o preço promocional for maior, prevalece o preço da tabela. O valor
aplicado é salvo no orçamento/venda como snapshot e não muda ao desativar a
promoção.

O checkout e a conversão de orçamento recebem `condition`: `IMEDIATO` exige
`paymentMethod` (métodos financeiros existentes) e registra atomicamente uma
conta a receber quitada com o pagamento correspondente; `PRAZO` exige
`dueDate` e cliente cadastrado, criando uma conta aberta vinculada à venda. A
venda de balcão sem cliente cadastrado somente pode ser quitada imediatamente.
Parcelas e métodos divididos não são criados no checkout; recebimentos parciais
posteriores podem ser registrados pelos endpoints financeiros. Devoluções
aplicam primeiro o valor devolvido ao saldo a receber ainda aberto; qualquer
excedente, ou valor de venda já quitada, gera uma conta a pagar aberta vinculada
à devolução, com vencimento informado quando houver reembolso. O valor usado
para abater o saldo fica registrado como crédito aplicado; o status
`COMPENSADO` identifica contas quitadas integralmente por créditos sem
recebimento em dinheiro. O pagamento posterior do reembolso segue os endpoints
financeiros.

Devoluções identificam os itens da venda original e aceitam quantidades parciais,
limitadas ao saldo ainda não devolvido. O sistema reentra os produtos no lote
original somente se o lote não estiver vencido e o paiol puder recebê-los sem
exceder capacidade NEQ; estoque, crédito aplicado, conta a pagar de reembolso e
auditoria são atualizados atomicamente. Não realiza cancelamento de documento
fiscal.

Este ciclo ainda não oferece tabela promocional ou integração fiscal. Não emite
NF-e, NFS-e, MDF-e ou Guia de Tráfego.

### Endpoints de ordens de serviço

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/operations/orders` | Lista OS com paginação, busca e filtro; cria orçamento |
| `GET` | `/operations/orders/reports/summary?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume OS e valores contratados por status, pela data do evento |
| `GET` | `/operations/orders/:id` | Consulta OS, itens, cliente e situação da reserva |
| `POST` | `/operations/orders/:id/approve` | Valida cliente/CR, blaster, lotes e reserva o estoque |
| `POST` | `/operations/orders/:id/start` | Inicia montagem mantendo a reserva |
| `POST` | `/operations/orders/:id/cancel` | Cancela orçamento/aprovação e libera a reserva |
| `POST` | `/operations/orders/:id/close` | Registra queima, baixa consumo real e gera conta a receber |

A criação gera um orçamento sem reservar estoque. A aprovação verifica
elegibilidade do cliente e do blaster, validade dos lotes e disponibilidade,
considerando também os orçamentos comerciais vigentes e serializando aprovações
concorrentes por lote. A reserva de OS é derivada dos itens planejados em
`APROVADO` ou `EM_MONTAGEM`; saídas, transferências e ajustes negativos
independentes não podem consumir quantidades reservadas por OS ou orçamento.
Cancelar ou encerrar a OS libera a reserva. No encerramento, a baixa é baseada
na quantidade efetivamente queimada, e as sobras voltam a ficar disponíveis.
O relatório de queima e as movimentações ficam registrados na auditoria.
Ao criar a OS, informe o valor contratado. Ao concluir a execução, informe
também o vencimento; o sistema cria atomicamente uma única conta a receber pelo
valor contratado, vinculada ao cliente e à OS. O valor não é recalculado com
base na quantidade disparada. Ordens antigas sem valor contratado precisam ser
canceladas e recriadas antes de concluir.
O resumo operacional agrupa todas as OS, inclusive canceladas, por status e
soma valores contratados conforme a data do evento dentro de `from/to`. Ordens
legadas sem valor contratado permanecem na contagem e são sinalizadas em
`ordersWithoutContractedAmount`; seus valores não entram nas somas.

### Contas a pagar/receber e fluxo de caixa

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/finance/entries` | Lista ou cria contas a pagar (`PAGAR`) e receber (`RECEBER`) |
| `GET` | `/finance/entries/:id` | Consulta lançamento, pagamentos, valor pago e saldo pendente |
| `POST` | `/finance/entries/:id/payments` | Registra pagamento/recebimento parcial ou quitação |
| `POST` | `/finance/entries/:id/cancel` | Cancela lançamento aberto sem pagamentos |
| `GET` | `/finance/cash-flow?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume entradas e saídas efetivamente pagas por dia |
| `GET` | `/finance/dashboard?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume fluxo realizado e saldos atuais a pagar/receber por vencimento |

Lançamentos armazenam direção, categoria, contraparte, valor e vencimento; o
cliente é opcional para contas a receber. Pagamentos são imutáveis neste fluxo,
serializados por lançamento para impedir quitação acima do saldo, considerando
créditos aplicados por devoluções. O status pode ser `ABERTO`, `PARCIAL`, `PAGO`,
`COMPENSADO` ou `CANCELADO`. `overdue` sinaliza saldo pendente cujo vencimento
passou. O fluxo de caixa representa pagamentos realizados, não projeções futuras.
O painel financeiro usa o período para agrupar pagamentos pela data de
realização e saldos pendentes atuais pelo vencimento: contas em aberto com
vencimento anterior a `from` aparecem separadas das que vencem entre `from` e
`to`. Pagamentos parciais e créditos aplicados reduzem o saldo; lançamentos
cancelados não são incluídos. Os saldos representam a situação atual e não uma
reconstrução histórica no fim do período.

Lançamentos avulsos continuam manuais; cada recebimento de compra gera
automaticamente uma conta a pagar vinculada à etapa recebida, a conclusão de
uma OS gera uma conta a receber com o valor contratado e as vendas geram
recebimentos ou contas a receber de acordo com a condição informada. Não há integração bancária,
conciliação, parcelamento ou estorno de pagamentos. Emissão fiscal, Guias de
Tráfego, mapas regulatórios e relatórios gerenciais adicionais ainda não estão
expostos pela API. As telas do frontend também ainda não consomem estes
endpoints.

Todas as rotas de negócio exigem access token e perfil compatível; liveness,
readiness e os endpoints de bootstrap/login/refresh/logout são públicos. A API
ainda não possui limitação de tentativas de login, recuperação de senha,
autenticação multifator ou transporte de refresh token por cookie HttpOnly. O
cliente não deve persistir tokens em armazenamento acessível a JavaScript; para
uso web em produção, implemente uma camada BFF/cookie seguro ou estratégia
equivalente. Antes da produção, propague a identidade do operador para toda a
auditoria de negócio, restrinja permissões de banco, revise os fluxos
regulatórios e faça revisão de segurança e testes de concorrência.

### Lacunas conhecidas e próximos módulos

Os itens abaixo **não estão implementados**. São próximos escopos candidatos;
as rotas e regras detalhadas devem ser definidas antes de iniciar cada módulo.

| Área | Situação atual | Trabalho pendente |
| --- | --- | --- |
| Acesso e operadores | Login JWT, refresh rotativo, usuários e perfis por módulo implementados; auditoria de autenticação identifica ator | Recuperação de senha, MFA, limitação de tentativas, transporte seguro de refresh no cliente e propagação de ator nos demais logs de negócio |
| Financeiro de vendas | Checkout, conversão de orçamento, execução de OS e recebimentos de compras geram lançamentos vinculados | Integrar estornos fiscais e revisar devoluções de vendas legadas sem vínculo financeiro |
| Devolução e financeiro | Devolução aplica crédito ao saldo em aberto e cria conta a pagar para eventual reembolso | Nenhuma regra financeira pendente para novas vendas |
| Orçamentos comerciais | Emissão, consulta, cancelamento e conversão em venda implementados; reserva de lote por sete dias integrada a vendas, OS e movimentações | Revisar regras comerciais e evoluir conforme necessidade (por exemplo, edição e envio do orçamento) |
| Preços promocionais | Campanhas de preço fixo, vigência inclusiva, aplicação automática sem aumento sobre o preço de tabela e bloqueio de sobreposição por produto implementados | Evoluir conforme necessidade (por exemplo, descontos percentuais, segmentação e campanhas promocionais) |
| Fiscal e regulatório | Sem emissão fiscal ou integração oficial | Integrações e fluxos de NF-e, NFS-e, MDF-e e Guias de Tráfego, sujeitos à validação regulatória |
| Bancos | Sem integração bancária ou conciliação | Importação/integração de extratos, conciliação e tratamento de divergências |
| Relatórios | Resumos de vendas por produto/cliente, OS por status, painel financeiro e posição de estoque com alertas de validade disponíveis | Outros relatórios operacionais, regulatórios e projeções financeiras |
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
