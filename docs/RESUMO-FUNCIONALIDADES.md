# Resumo de Funcionalidades — SisPiro ERP

Atualizado em 26 de outubro de 2026. Visão consolidada, por área de negócio, do
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

### Faturamento e Módulo Fiscal (Frente 1 - Concluída)
- Arquitetura Adapter/Strategy plugável (`FiscalGateway`) com provedor padrão `FiscalSandboxAdapter` para emulação completa e `FocusNfeAdapter` para produção via Focus NFe.
- Geração autêntica de chave de acesso de 44 dígitos com Dígito Verificador calculado via Módulo 11 conforme manual de integração da SEFAZ.
- Emissão eletrônica de NF-e (Modelo 55) vinculada a vendas faturadas, com NCM pirotécnico (3604.10.00), CFOP e validação de destinatário (CPF/CNPJ).
- Emissão de NFC-e (Modelo 65) para vendas de balcão e consumidor final.
- Emissão de NFS-e para prestação de serviços pirotécnicos vinculada a Ordens de Serviço (OS), com discriminação de queima, ART e Blaster responsável.
- Cancelamento fiscal homologado perante o gateway SEFAZ com justificativa legal obrigatória (mínimo de 15 caracteres) e geração de protocolo de homologação.
- Workspace completo de Faturamento (`/modules/billing`) no frontend com tabela de documentos, badges de status SEFAZ, cópia rápida de chave, atalhos de DANFE/XML e modais de emissão/cancelamento com acessibilidade total (focus trap e Escape).

### Expedição e Guia de Tráfego do Exército (Frente 2 - Concluída)
- Modelo `TrafficGuide` e `TrafficGuideItem` no Prisma com enum `TrafficGuideStatus` (`EMITIDA`, `EM_TRANSITO`, `CONCLUIDA`, `CANCELADA`).
- Regras regulamentares do Exército Brasileiro (DFPC/SFPC - R-105):
  - Numeração anual sequencial auditada (ex: `GT-2026/0001`).
  - Validação de paiol ativo e conferência estrita de saldo físico disponível no lote de origem.
  - Verificação de validade da carteira profissional do Blaster perante a data limite do trânsito.
  - Cálculo automático em tempo real da massa líquida total de explosivos (NEQ em kg) a partir da densidade energética cadastrada no produto PCE.
  - Controle de dados do transporte rodoviário: veículo, placa/UF, motorista habilitado com certificação MOPP e itinerário rodoviário detalhado.
  - Atualização do status de deslocamento (`EM_TRANSITO`, `CONCLUIDA`, `CANCELADA` com justificativa legal mínima de 10 caracteres).
- Workspace regulatório no frontend (`/modules/compliance`):
  - Tabela de guias com busca por número, placa, motorista e filtros por status.
  - Modal acessível de emissão de nova GT com seleção de produtos/lotes e indicador visual de carga NEQ.
  - **Espelho Oficial Militar de Impressão**: Layout idêntico ao modelo DFPC/COLOG com cabeçalho oficial da República Federativa do Brasil, discriminação dos PCEs com classe ONU e campos de assinatura de responsabilidade técnica.

### Qualidade e infraestrutura de teste
- Backend: 36 testes unitários (incluindo testes de validações militares, regras de Blaster e cálculo de NEQ) + 46 e2e, lint e build limpos.
- Frontend: 72 testes unitários e de componentes (incluindo testes dedicados do ComplianceWorkspace com React Testing Library + jsdom), lint, typecheck e build limpos (20 rotas).
- Smoke tests E2E executados com sucesso real para o Módulo Fiscal (Frente 1) e Guia de Tráfego (Frente 2).
- Total geral: 108 testes automatizados passando com 100% de sucesso.

---

## ⏳ Pendente — desbloqueado, não feito ainda

| Item | Observação | No sprint atual? |
| --- | --- | --- |
| **Frente 3: PIX Dinâmico & Conciliação Bancária** | Cobrança PIX com QR Code dinâmico no PDV/Orçamento, webhook de confirmação automática no Financeiro e importação de extratos OFX. | **Próxima frente sequencial** |
| **Frente 4: SRE e Automação de Produção** | Provisionamento de scripts de backup automatizado do PostgreSQL com retenção em S3, health checks avançados e docker-compose produtivo. | Próximo |
| Validação de sessão expirada/refresh em Firefox e Safari | Validado em Chrome contra o backend real; Firefox/Safari não testados — sem ferramenta de automação disponível. | Secundário |

---

## 🔒 Bloqueado — requer decisão explícita antes de iniciar

Nada bloqueia as próximas frentes técnicas (Frente 3: PIX Dinâmico e Frente 4: SRE). Módulo Fiscal (Frente 1) e Guia de Tráfego do Exército (Frente 2) foram concluídos com êxito.

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
- Listagem e cadastro de Clientes e Blasters respondiam 404 do próprio
  roteador do Next.js (rota BFF com catch-all obrigatório em vez de
  opcional) — as duas telas nunca funcionaram de fato, apesar de
  documentadas como integradas e testadas (corrigido).
- Tela de Blasters quebrava com erro de runtime ao ler `authorizedClasses`,
  campo de Cliente/CR que nunca existiu no modelo de Blaster — feature
  inteira fabricada sem contrato de API real (corrigido: removida).
- Telas de Clientes/Blasters não disparavam o fluxo de sessão-expirada
  (checagem de prefixo de rota `isBusinessRequest` não reconhecia a própria chamada de listagem
  raiz, sem barra antes do query string) — mostravam erro solto em vez do redirecionamento limpo ao login
  (corrigido).
- Incompatibilidade sistêmica de nomes de campo quebrando todo o módulo Comercial
  para escrita (orçamentos, PDV, promoções e relatórios — ex.: divergência em `discountType`,
  `price`, `active`, `paymentMethod` entre formulários e schema NestJS) (corrigido).
- Fluxo de Compras completamente quebrado para emitir pedidos e receber lotes físicos
  em paióis (campos `supplierId`, `unitCost` e estrutura do recebimento divergindo da API) (corrigido).
- Campos fabricados `tradeName`, `email`, `phone` no cadastro de Clientes (`customers-workspace.tsx`
  e tipo `Customer`), rejeitados com 400 Bad Request pela validação estrita (`forbidNonWhitelisted`)
  do backend (corrigido: removidos e alinhados ao modelo Prisma/DTO real).
- Campo `counterpart` em vez de `counterparty` e omissão da `description` obrigatória
  ao cadastrar títulos manuais no Financeiro (`finance-workspace.tsx` e `api.ts`),
  causando rejeição 400 pelo backend (corrigido).
- Elementos com contraste insuficiente sobre fundos claros na tela inicial/deslogada
  (`.environment-label`, `.eyebrow`, `.page-footer`), elevados para taxa >5:1 para
  conformidade estrita com WCAG 2.1 AA (corrigido).

Padrão a observar: os bugs mais graves encontrados até aqui foram todos de
**integração real** (campo com nome errado, corpo de requisição descartado,
processo rodando código desatualizado) — nenhum teste unitário ou e2e de API
os pegou sozinho. Vale considerar manter smoke test manual no navegador como
parte do critério de aceite de fases futuras, não só suíte automatizada.
