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
restrita à rede confiável até concluir o bootstrap do primeiro administrador ou
executar o seed local de demonstração.

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

### Dados locais de demonstração

Depois de aplicar as migrações, o seed pode preencher as telas com dados
fictícios de estoque, clientes, fornecedores, compras, preços, vendas,
devoluções, ordens de serviço e financeiro:

```bash
npm run db:seed
```

Antes, mantenha `NODE_ENV=development`, altere `DEV_SEED_ENABLED=true` e
configure `DEV_SEED_ADMIN_PASSWORD` em `.env` com uma senha local de pelo menos
12 caracteres. O login criado é `demo.admin@local.test`; use a senha definida
nessa variável. O comando também exige que `DATABASE_URL` aponte para
`localhost`/loopback; falha fora de desenvolvimento ou sem a habilitação
explícita. Os registros são identificados como DEMO e não representam dados ou
documentos regulatórios reais. A execução é idempotente e pode ser repetida.

## Persistência e regras de domínio

`prisma/schema.prisma` inicia a modelagem de produtos, lotes, paióis, clientes
(incluindo classes PCE autorizadas), blasters, ordens de serviço, movimentações
de estoque e auditoria. Quantidades e NEQ usam `Decimal`; os fluxos iniciais de
estoque usam transações PostgreSQL, bloqueios concorrentes e validação de
capacidade do paiol antes de gravar.

### Autenticação, usuários e perfis

| Método | Rota | Acesso | Uso |
| --- | --- | --- | --- |
| `POST` | `/auth/bootstrap` | Público, uma única vez | Cria o primeiro administrador enquanto não houver usuários (protegido por rate limiting) |
| `POST` | `/auth/login` | Público | Autentica por e-mail e senha; emite tokens ou desafio MFA se habilitado |
| `POST` | `/auth/login/mfa` | Público | Conclui autenticação validando código TOTP ou código de backup |
| `POST` | `/auth/refresh` | Público, exige refresh token | Rotaciona o refresh token e emite novo access token |
| `POST` | `/auth/logout` | Público, exige refresh token | Revoga a sessão apresentada |
| `POST` | `/auth/password-reset/request` | Público | Solicita recuperação de senha e despacha instruções via fila BullMQ |
| `POST` | `/auth/password-reset/confirm` | Público | Redefine senha com token de uso único (15 min) e revoga todas as sessões ativas |
| `POST` | `/auth/mfa/setup` | Autenticado | Inicia pareamento MFA gerando segredo Base32 e URL `otpauth://` |
| `POST` | `/auth/mfa/enable` | Autenticado | Confirma código TOTP, ativa MFA e gera 8 códigos de backup de uso único |
| `POST` | `/auth/mfa/disable` | Autenticado | Desativa MFA exigindo confirmação da senha atual do usuário |
| `GET` | `/auth/me` | Autenticado | Consulta o usuário da sessão |
| `PATCH` | `/auth/me/password` | Autenticado | Altera a senha atual e revoga todas as sessões ativas |
| `GET` / `POST` | `/users` | `ADMIN` | Lista usuários ou cria usuário com perfis |
| `GET` / `PATCH` | `/users/:id` | `ADMIN` | Consulta ou atualiza nome, perfis e estado ativo |

Envie access tokens no cabeçalho `Authorization: Bearer <token>`. O access token
JWT dura 15 minutos por padrão; o refresh token opaco expira em 30 dias, é
rotacionado a cada uso e somente seu hash é persistido. Reutilizar um refresh
token antigo revoga a sessão. As durações são configuráveis. O endpoint de
bootstrap é protegido por lock transacional e deixa de criar usuários após o
primeiro cadastro; não existe cadastro público. Senhas são armazenadas com
scrypt e os erros de login não revelam se e-mail ou senha estavam incorretos.

#### Rate Limiting e Proteção contra Força Bruta
A autenticação possui serviço integrado de rate limiting (`LoginRateLimiterService`):
- Limite estrito de 5 tentativas inválidas por conta/e-mail em janela deslizante de 15 minutos.
- Limite por IP de 25 tentativas para mitigar ataques distribuídos sem bloquear redes corporativas sob NAT.
- Ao exceder o limite, retorna HTTP `429 Too Many Requests` com mensagem neutra, prevenindo enumeração de contas.
- Tentativas bem-sucedidas zeram imediatamente os contadores da conta e do IP.
- Contadores compartilhados em Redis (`ioredis`, conexão dedicada em `src/infrastructure/redis.provider.ts` com reconexão indefinida — o `retryStrategy` nunca desiste, evitando que uma instabilidade transitória do Redis vire um fallback permanente em memória), suportando múltiplas instâncias atrás de um load balancer sem multiplicar o limite efetivo. A checagem do limite e o incremento da tentativa são feitos atomicamente em uma única operação (script Lua no Redis, bloco síncrono no fallback em memória), eliminando a janela de corrida que existiria entre "checar" e "contabilizar" se fossem operações separadas.
- **Fallback em memória:** se o Redis estiver inacessível, o serviço cai para contadores em memória do processo (mesmas regras de limite). Nesse modo, os contadores zeram a cada restart/deploy e, com múltiplas instâncias, o limite efetivo multiplica pelo número de instâncias — uma degradação aceita apenas durante a indisponibilidade do Redis, não o comportamento normal.
- **IPs de loopback** (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`) recebem um limite elevado (100 tentativas em vez de 25) para não travar a suíte de testes e2e, que roda contra a própria API em loopback. Se um proxy reverso em produção não propagar o IP real do cliente para `@Ip()`, esse limite mais permissivo passaria a valer silenciosamente para tráfego externo — garanta que `trust proxy`/`X-Forwarded-For` esteja configurado corretamente no ambiente de implantação.

#### Recuperação de Senha
- Endpoint `POST /auth/password-reset/request`: resposta genérica timing-safe, gerando token opaco criptográfico de 32 bytes (com hash SHA-256 persistido em `tokens_recuperacao_senha` e expiração de 15 minutos).
- Despacho assíncrono de e-mails orquestrado via fila `background` do BullMQ.
- Endpoint `POST /auth/password-reset/confirm`: serializado com bloqueio pessimista (`FOR UPDATE`) no banco relacional contra ataques de repetição concorrente. Validação atômica de expiração e uso único.
- A conclusão da redefinição revoga automaticamente todas as sessões ativas do usuário (`sessoes_autenticacao`), espelhando o comportamento de segurança de `PATCH /auth/me/password`.

#### Autenticação Multifator (MFA - TOTP)
- Implementação estrita do padrão RFC 6238 TOTP (HMAC-SHA1, passos de 30s, segredo Base32 de 160 bits e tolerância de drift de relógio).
- Integração fluida no login: se o usuário tiver MFA ativo e não enviar o código, a API responde `{ mfaRequired: true, mfaToken: string }`, permitindo conclusão em `POST /auth/login/mfa` ou envio direto no campo `mfaCode`.
- Emissão de 8 códigos de recuperação (backup) de uso único na ativação, armazenados como hashes SHA-256 e consumidos irreversivelmente na utilização.
- Desativação exige validação obrigatória da senha atual do usuário.

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
access tokens. Os registros de auditoria de autenticação, gestão de usuários e
operações de negócio identificam o usuário autenticado. Registros históricos
anteriores à propagação permanecem com o ator nulo.

O backend emite tokens JSON e não define cookies. O frontend web usa o BFF do
Next.js para armazenar access e refresh tokens em cookies `HttpOnly`; clientes
alternativos devem manter os tokens fora de armazenamento acessível a
JavaScript. A autorização de todas as rotas de negócio continua sendo aplicada
pela API, independentemente dos controles de apresentação no frontend.

### Endpoints de estoque/WMS disponíveis

Todos usam o prefixo configurado (`/api/v1` por padrão):

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/inventory/products` | Lista e cadastra produtos/PCE |
| `GET` | `/inventory/products/:id` | Consulta produto |
| `GET` / `POST` | `/inventory/magazines` | Lista/cria paióis; lista inclui NEQ atual e capacidade restante |
| `GET` | `/inventory/magazines/:id` | Consulta paiol e capacidade |
| `PATCH` | `/inventory/magazines/:id/status` | Ativa ou inativa paiol (inativação exige saldo físico zerado) |
| `GET` / `POST` | `/inventory/lots` | Lista lotes ou registra lote com recebimento inicial |
| `GET` | `/inventory/operational-lots` | `OPERACOES`: opções de lote com dados mínimos para criar OS |
| `GET` | `/inventory/lots/:id` | Consulta lote, produto, paiol e NEQ |
| `PATCH` | `/inventory/lots/:id/status` | Altera status do lote (`DISPONIVEL`, `QUARENTENA`, `BLOQUEADO`) com justificativa e trava contra reservas |
| `POST` | `/inventory/lots/:id/split` | Desmembra lote para outro paiol com novo número rastreável e validação de NEQ/reservas |
| `GET` / `POST` | `/inventory/movements` | Consulta histórico ou registra movimentação |
| `GET` | `/inventory/reports/stock-summary` | Resume saldo físico, reservas, disponibilidade e lotes vencidos/próximos do vencimento |
| `GET` | `/inventory/reports/sfpc-monthly-map` | Mapa Mensal de Movimentação e Estocagem de PCE para o Exército (SFPC / R-105) |

As rotas de estoque exigem `ESTOQUE`, exceto `/inventory/operational-lots`,
liberada somente para `OPERACOES` e com seleção de campos reduzida (sem dados
de fabricante/importador). As listas aceitam `page` e `limit` (máximo 100);
produtos aceitam `search`, `type` e `isPce`, lotes aceitam `search`,
`productId`, `magazineId` e `status`, e movimentações aceitam `search`, `productLotId` e
`type`.

O recebimento inicial e as entradas/ajustes positivos validam a capacidade em
NEQ/kg dentro de transações que bloqueiam a linha do paiol. Transferências
tradicionais movimentam o saldo integral do lote mantendo a rastreabilidade do registro.
Para transferências parciais com divisão física entre paióis, utiliza-se o endpoint
`/inventory/lots/:id/split`, que deduz atomicamente a quantidade desmembrada do lote de
origem, valida ausência de reservas, valida a capacidade NEQ do paiol de destino e cria
um novo lote filho rastreável com histórico vinculado e movimentações registradas.
O controle de quarentena e bloqueio físico (`PATCH /inventory/lots/:id/status`) permite
interditar lotes com defeito, laudos pendentes ou retenções fiscais, bloqueando
automaticamente saídas, transferências, ajustes de quantidade, orçamentos, vendas e
reservas de Ordens de Serviço, com justificativa obrigatória e rastreabilidade integral
em log de auditoria.
A inativação de paióis (`/inventory/magazines/:id/status`) exige validação estrita de saldo
zerado para impedir orfandade de produtos controlados. Saídas impedem saldo
negativo; saídas, transferências, ajustes e desmembramentos bloqueiam lotes vencidos ou em quarentena/bloqueio.
O Mapa Mensal SFPC (`GET /inventory/reports/sfpc-monthly-map`) consolida o balanço regulatório
mensal exigido pela fiscalização militar (Portarias COLOG / R-105): Saldo Anterior + Entradas
(Compras, Devoluções, Ajustes) - Saídas (Vendas, Queimas em OS, Ajustes) = Saldo Atual e massa NEQ
por classe de risco e produto. Paiol inativo ou com licença dos Bombeiros vencida não recebe estoque. Cada gravação cria um
registro de auditoria na mesma transação, identificando o usuário autenticado. Registros
históricos permanecem com o ator nulo.
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
| `GET` | `/customers/operational-options` | `OPERACOES`: opções de cliente sem CPF/CNPJ ou número do CR |
| `POST` | `/customers/:id/pce-eligibility` | Avalia CR cadastrado para as classes solicitadas |
| `GET` / `POST` | `/blasters` | Lista e cadastra blasters |
| `GET` | `/blasters/operational-options` | `OPERACOES`: opções para OS sem CPF |
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
| `GET` / `POST` | `/pricing/promotions` | Lista ou cria promoções (preço fixo ou desconto percentual) por produto e vigência |
| `GET` | `/pricing/promotions/:id` | Consulta promoção e itens |
| `PATCH` | `/pricing/promotions/:id` | Ativa ou desativa promoção |
| `GET` | `/sales` | Lista vendas finalizadas com paginação |
| `GET` | `/sales/:id` | Consulta venda, cliente, preços e itens |
| `GET` | `/sales/reports/summary?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume vendas brutas, devoluções e vendas líquidas por produto e cliente |
| `GET` | `/commercial/reports/quotes-conversion?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume volume emitido, convertido, taxa de conversão (%) e ticket médio de orçamentos |
| `POST` | `/sales` | Finaliza venda, registra recebimento ou conta a receber e baixa estoque |
| `GET` / `POST` | `/sales/quotes` | Lista orçamentos comerciais ou emite orçamento com reserva de sete dias |
| `GET` | `/sales/quotes/:id` | Consulta orçamento, itens e estado da reserva |
| `PUT` | `/sales/quotes/:id` | Edita orçamento vigente (itens/tabela/cliente) com recálculo atômico da reserva |
| `POST` | `/sales/quotes/:id/send` | Dispara envio assíncrono do orçamento ao cliente via fila BullMQ |
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

O relatório de conversão de orçamentos comerciais (`/commercial/reports/quotes-conversion`)
consolida o desempenho da força de vendas no intervalo informado: quantidade total emitida,
quantidade convertida em vendas concluídas, quantidade expirada, taxa percentual de conversão e
ticket médio dos orçamentos gerados.

Orçamentos comerciais preservam os preços cotados e reservam os lotes por sete
dias. A emissão valida cliente, tabela de preço, elegibilidade PCE, validade do
lote e saldo não comprometido, inclusive diante de outras reservas concorrentes.
Orçamentos vigentes podem ter seu cliente, tabela de preço e itens editados via `PUT /sales/quotes/:id`
enquanto não convertidos e não expirados; a edição recalcula atomicamente a reserva no banco com lock
pessimista e renova o prazo de 7 dias. O endpoint `POST /sales/quotes/:id/send` agenda o envio do orçamento
por e-mail de forma desacoplada via fila BullMQ (`background`), com registro de auditoria `sales-quote.sent`.
Orçamentos expirados deixam de reservar saldo; cancelamento libera a reserva.
A conversão em venda preserva os preços cotados e baixa o estoque atomicamente.
Ordens de serviço e saídas, transferências ou ajustes negativos de estoque
respeitam essas reservas e não podem consumir o saldo comprometido.

Promoções suportam desconto por preço fixo (`PRECO_FIXO`) ou por percentual de desconto (`PERCENTUAL`).
Produtos não podem ter promoções ativas com períodos sobrepostos; a criação e a ativação
verificam essa regra. Na venda e na emissão/edição de orçamento, a promoção vigente é
aplicada automaticamente somente quando resultar no menor preço efetivo para o cliente. Se a promoção
gerar valor superior ao preço de tabela, prevalece o preço da tabela cadastrada. O valor
aplicado é salvo no orçamento/venda como snapshot imutável e não muda ao desativar a
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
financeiros. Para vendas legadas sem lançamento financeiro prévio associado, a
devolução é realizada de maneira idempotente e segura, registrando a reentrada
física no lote sem falhas de integridade.

Devoluções identificam os itens da venda original e aceitam quantidades parciais,
limitadas ao saldo ainda não devolvido. O sistema reentra os produtos no lote
original somente se o lote não estiver vencido e o paiol puder recebê-los sem
exceder capacidade NEQ; estoque, crédito aplicado, conta a pagar de reembolso e
auditoria são atualizados atomicamente. Não realiza cancelamento de documento
fiscal.

Este ciclo não oferece integração fiscal oficial. Não emite
NF-e, NFS-e, MDF-e ou Guia de Tráfego (escopo regulatório da Fase 3).

### Endpoints de ordens de serviço

| Método | Rota | Uso |
| --- | --- | --- |
| `GET` / `POST` | `/operations/orders` | Lista OS com paginação, busca e filtro; cria orçamento |
| `GET` | `/operations/orders/reports/summary?from=AAAA-MM-DD&to=AAAA-MM-DD` | Resume OS e valores contratados por status, pela data do evento |
| `GET` | `/operations/orders/:id` | Consulta OS, itens, cliente e situação da reserva |
| `PUT` | `/operations/orders/:id` | Edita orçamento de OS (cabeçalho e itens) antes da aprovação |
| `POST` | `/operations/orders/:id/approve` | Valida cliente/CR, blaster, lotes e reserva o estoque |
| `POST` | `/operations/orders/:id/start` | Inicia montagem mantendo a reserva |
| `POST` | `/operations/orders/:id/cancel` | Cancela orçamento, aprovação ou montagem e libera a reserva |
| `POST` | `/operations/orders/:id/close` | Registra queima, baixa consumo real e gera conta a receber |

As rotas de OS exigem `OPERACOES`. O perfil pode consultar apenas as opções
operacionais necessárias de clientes, blasters e lotes pelos endpoints acima;
cadastros completos e mutações de clientes/estoque continuam restritos aos
perfis originais. Respostas de OS não incluem CPF/CNPJ nem número do CR.

A criação gera um orçamento sem reservar estoque. Enquanto a OS estiver em
`ORCAMENTO`, seu cabeçalho e seus itens planejados podem ser editados via `PUT`.
A aprovação verifica elegibilidade do cliente e do blaster, validade dos lotes e
disponibilidade, considerando também os orçamentos comerciais vigentes e
serializando aprovações concorrentes por lote. A reserva de OS é derivada dos
itens planejados em `APROVADO` ou `EM_MONTAGEM`; saídas, transferências e ajustes
negativos independentes não podem consumir quantidades reservadas por OS ou
orçamento. Cancelar a OS (em `ORCAMENTO`, `APROVADO` ou `EM_MONTAGEM`) ou encerrá-la
libera a reserva atomicamente. No encerramento, a baixa é baseada na quantidade
efetivamente queimada, e as sobras voltam a ficar disponíveis. O relatório de
queima e as movimentações ficam registrados na auditoria.
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
| `GET` | `/finance/reports/payment-breakdown?from=AAAA-MM-DD&to=AAAA-MM-DD` | Detalha pagamentos por categoria, método e direção |
| `GET` | `/financial/reports/aging?referenceDate=AAAA-MM-DD` | Relatório de Aging Schedule agrupando títulos a pagar/receber por faixas de vencimento |

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
O detalhamento por categoria e método considera somente pagamentos e
recebimentos registrados no intervalo, pela data de ocorrência; agrupa por
categoria, método e combinação dos dois, e separa entradas de saídas. Contas
sem pagamento não são incluídas nesse relatório.
O relatório de Aging Schedule (`/financial/reports/aging`) calcula a maturidade de
todas as contas ativas a pagar e a receber com base na data de referência informada
(`referenceDate`, padrão: data atual se omitida), com filtro opcional por `direction`
(`PAGAR`/`RECEBER`), distribuindo os saldos pendentes em cinco faixas etárias estritas: `current` (a vencer),
`overdue1to30` (1 a 30 dias de atraso), `overdue31to60` (31 a 60 dias), `overdue61to90`
(61 a 90 dias) e `overdueOver90` (acima de 90 dias de atraso).

Lançamentos avulsos podem ser simples ou parcelados (informando `installmentsCount` e `intervalDays` ou `customDueDates`), gerando títulos vinculados ao mesmo `installmentGroup` com rateio exato de centavos (resto alocado na 1ª parcela) e datas calculadas atomicamente. Cada recebimento de compra gera
automaticamente uma conta a pagar vinculada à etapa recebida, a conclusão de
uma OS gera uma conta a receber com o valor contratado e as vendas geram
recebimentos ou contas a receber de acordo com a condição informada. Não há integração bancária,
conciliação ou estorno de pagamentos. Emissão fiscal, Guias de
Tráfego, mapas regulatórios e relatórios gerenciais adicionais ainda não estão
expostos pela API. O frontend já consome a autenticação, estoque, comercial, financeiro
e ordens de serviço.

Todas as rotas de negócio exigem access token e perfil compatível; liveness,
readiness e os endpoints de bootstrap/login/refresh/logout/password-reset/login-mfa são públicos.

### Revisão de Segurança, Concorrência e Operação (Fase 1)

Os itens 3 e 6 abaixo são **decisões de runbook de implantação, não infraestrutura
já provisionada neste repositório**: não há script de `GRANT`/criação de usuário
de banco nem pipeline de backup versionados aqui. Quem implantar em produção
precisa executar essas configurações manualmente (ou via IaC do ambiente de
destino) antes de considerar o item concluído. Os itens 1, 2, 4 e 5 descrevem
comportamento que já está implementado em código e pode ser verificado nos
testes e no próprio comportamento da API.

1. **Política de CORS:**
   - Em desenvolvimento local, aceita origens especificadas em `CORS_ORIGINS` (ex: `http://localhost:3000,http://127.0.0.1:3000`).
   - Em produção, configure explicitamente os domínios corporativos autorizados e HTTPS estrito, com `credentials: true`. Origens curinga (`*`) são terminantemente proibidas com autenticação por credenciais.

2. **Gestão de Segredos e Chaves:**
   - Variáveis sensíveis (`AUTH_JWT_SECRET`, `DATABASE_URL`, `REDIS_PASSWORD`) são injetadas estritamente via variáveis de ambiente/secret managers (Kubernetes Secrets, AWS Secrets Manager, Vault) e nunca versionadas.
   - Rotação documentada: a rotação de `AUTH_JWT_SECRET` requer reinicialização da API e invalida access tokens em circulação (máximo de 15 minutos de impacto), mantendo os hashes de refresh tokens íntegros.

3. **Permissões do Usuário de Banco (Princípio do Menor Privilégio) — runbook, não implementado neste repositório:**
   - O usuário de conexão da aplicação em produção (sugestão: `erp_app`) deve ser criado sem privilégios de `SUPERUSER` nem privilégios de DDL (`CREATE TABLE`, `DROP TABLE`).
   - Execução de migrações (`prisma migrate deploy`) deve usar um usuário administrativo dedicado (sugestão: `erp_migrator`), restrito ao pipeline de CD, nunca a aplicação em runtime.
   - A aplicação deve receber apenas `SELECT, INSERT, UPDATE, DELETE` nas tabelas do schema `public` e `USAGE, SELECT, UPDATE` nas sequências.

4. **Concorrência e Locks Pessimistas (Zero Double-Spend / Zero Race Conditions):**
   - Vendas comerciais concorrentes: bloqueio pessimista (`FOR UPDATE`) no lote de origem impede venda simultânea acima do saldo disponível.
   - Ordens de Serviço concorrentes: reserva atômica serializada no banco garante integridade física de produtos controlados.
   - Desmembramento de lote (`split`): lock pessimista de linha garante que transferências parciais concorrentes não excedam o saldo nem a capacidade NEQ do paiol de destino.
   - Recuperação de senha: trava atômica `FOR UPDATE` em `tokens_recuperacao_senha` impede reutilização simultânea (*replay attack*).

5. **Política e Retenção de Auditoria Regulatória:**
   - Por determinação regulatória do Exército Brasileiro (R-105 / SFPC) e regras de compliance pirotécnico, todos os eventos de movimentação de PCE, aprovação de OS, vendas, quarentena e autenticação são registrados em `registros_auditoria`.
   - A tabela `registros_auditoria` opera em modo estritamente *append-only* (imutável; sem permissão de `UPDATE` ou `DELETE` para a aplicação).
   - Política de retenção mínima: **5 anos** de histórico ativo para fins de fiscalização militar e auditoria externa. Expurgos históricos, quando autorizados, são transferidos para armazenamento a frio compactado (*cold storage* WORM/S3 Glacier).

6. **Backups e Monitoramento de Produção — runbook, não implementado neste repositório:**
   - Banco de dados: configurar rotina diária de dump lógico via `pg_dump` associada a arquivamento contínuo de logs de transação (WAL Archiving / Point-In-Time-Recovery - PITR) com meta de RPO < 5 minutos e RTO < 1 hora.
   - Observabilidade: os endpoints de integridade já existem e podem ser apontados por qualquer monitor externo: `/api/v1/health/live` (liveness do processo) e `/api/v1/health/ready` (readiness com verificação ativa de PostgreSQL e Redis). A configuração do monitor em si (alerting, dashboards) é responsabilidade do ambiente de implantação.

### Lacunas conhecidas e próximos módulos

Os itens da coluna de trabalho pendente permanecem em aberto ou são evoluções
futuras candidatas; rotas e regras detalhadas devem ser definidas antes de
iniciar cada novo escopo.

| Área | Situação atual | Trabalho pendente |
| --- | --- | --- |
| Acesso e operadores | Login JWT, refresh rotativo, rate limiting distribuído em Redis atômico (`ioredis`) com fallback gracioso em memória e HTTP 429, recuperação de senha com tokens de uso único e revogação de sessões, MFA (TOTP + backup codes), usuários e perfis por módulo implementados; auditoria identifica o ator; locks pessimistas contra race conditions; BFF web usa cookies HttpOnly; telas de MFA e recuperação de senha integradas no frontend | Nenhum (concluído) |
| Financeiro de vendas | Checkout, conversão de orçamento, execução de OS e recebimentos de compras geram lançamentos vinculados; suporte a parcelamento nativo com rateio exato de centavos (`installmentCount`, `intervalDays`, `installmentGroup`) e devoluções de vendas legadas sem lançamento financeiro de forma idempotente | Integrar estornos fiscais como dependência da modelagem fiscal da Fase 3 |
| Devolução e financeiro | Devolução aplica crédito ao saldo em aberto, cria conta a pagar para reembolso e suporta vendas legadas sem lançamento prévio de forma segura e idempotente | Nenhum no backend (concluído na Fase 2) |
| Orçamentos comerciais | Emissão, consulta, cancelamento, edição (`PUT`) com lock pessimista e recálculo atômico de reserva, envio de e-mail via BullMQ (`POST /send`), conversão em venda e relatório de conversão (`GET /commercial/reports/quotes-conversion`) implementados | Nenhum no backend (concluído na Fase 2) |
| Preços promocionais | Campanhas de preço fixo e desconto percentual (`PromotionDiscountType`), vigência inclusiva, aplicação automática estrita pelo menor preço efetivo e bloqueio de sobreposição por produto implementados | Nenhum no backend (concluído na Fase 2) |
| Fiscal e regulatório | Sem emissão fiscal ou integração oficial | Integrações e fluxos de NF-e, NFS-e, MDF-e e Guias de Tráfego, sujeitos à validação regulatória (Fase 3) |
| Bancos | Sem integração bancária ou conciliação | Importação/integração de extratos, conciliação e tratamento de divergências (Fase 3) |
| Relatórios | Resumos de vendas por produto/cliente, conversão de orçamentos, OS por status, painéis financeiros por vencimento/categoria/método, Aging schedule (`current`, `overdue1to30`, `overdue31to60`, `overdue61to90`, `overdueOver90`), posição de estoque com alertas de validade e Mapa SFPC disponíveis | Relatórios específicos de NF-e e Guia de Tráfego na Fase 3 |
| Frontend de negócio | Login/BFF, estoque (quarentena/split/paióis/SFPC), ordens de serviço, clientes, blasters, compras, comercial, financeiro (incluindo parcelamento), recuperação de senha e controle de acesso por módulo (RBAC de navegação) integrados à API | RBAC refinado por botão de ação (hoje é só por módulo/tela); validação visual em staging |

Esta lista registra lacunas conhecidas, não constitui contrato final de API nem
garante que todos os itens pertençam ao escopo aprovado do produto. Antes de
expor a API em produção, valide autenticação, autorização, controles de
segurança, observabilidade, retenção de auditoria, backups e configuração do
ambiente final. Consulte também o
[status consolidado do backend e frontend](../docs/STATUS-IMPLEMENTACAO.md).

## Container de produção

```bash
docker build -t erp-pirotecnico-backend .
```

O container inicia a API; migrações são executadas separadamente com
`npm run db:deploy` no processo de implantação.
