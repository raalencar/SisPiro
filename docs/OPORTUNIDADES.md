# Oportunidades de melhoria — backlog para definição

Lista de melhorias propostas pela Casa de Fogos São João, analisadas contra o
código. **Nada aqui está implementado.** Cada item fica com a situação atual,
as decisões de arquitetura recomendadas, as fases e as perguntas em aberto.
Quando um item for aprovado e entregue, sai daqui e passa a constar em
`STATUS-IMPLEMENTACAO.md`.

Status possíveis: `aguardando definição` · `aprovado` · `em implementação` · `descartado`.

---

## 8. Visualização de custos e geração de orçamentos

**Status:** aguardando definição (analisado em 2026-10-27).

### Pedido (resumo)

- **8.1 Tela interna do orçamento:** mostrar lado a lado, por item:
  - quantidade, preço de custo e preço de venda;
  - custo total e total de venda;
  - desconto (R$ ou %);
  - margem estimada calculada depois do desconto.
- **8.2 PDF do cliente** ("GERAR ORÇAMENTO EM PDF"). Contém só dados comerciais:
  - dados da empresa e do cliente;
  - nome, data e local do evento;
  - itens com as quantidades;
  - total de venda, desconto e **valor final** em destaque;
  - condições de pagamento e validade.

  **Nunca** deve conter custo, custo operacional, margem, resultado ou comparativo
  entre custo e venda. Vale também para impressão e compartilhamento, e o arquivo
  não pode ter dado de custo oculto que possa ser recuperado.
- **8.3 Acesso:** quem elabora ou negocia vê custo e venda; a administração vê
  também custo total, descontos e margem. A permissão é configurável por usuário.
- **8.4 Um orçamento, duas visões:** o funcionário preenche uma vez e o sistema
  gera a versão interna e a do cliente.

### Situação atual no código

| Requisito | Hoje |
|---|---|
| Orçamento de evento | `ServiceOrder` em `ORCAMENTO` tem data e local do evento. Os itens (`ServiceOrderItem`) **não têm preço**. Há um único `contractedAmount` digitado à mão. |
| Orçamento de balcão | `SalesQuote`/`SalesQuoteItem` têm preço vindo da tabela de preços, subtotal e validade de 7 dias. Não têm custo, desconto negociado nem evento. |
| Preço de custo | Não existe em `Product`. Só aparece em `PurchaseItem.unitCost` (Compras). |
| Desconto R$/% | Só como promoção da tabela de preços (`ProductPromotion`). Não existe no orçamento. |
| Serviços e equipamentos (equipe técnica, máquina de CO₂) | `ServiceOrderItem` exige `productLotId`, então não comporta serviço nem equipamento alugado. |
| PDF/impressão | `quote-print-modal.tsx` (balcão) usa `window.print()` do navegador. As condições de pagamento estão fixas no código. |
| Permissão por usuário | Usuário tem `roles[]` (ADMIN, ESTOQUE, COMERCIAL, OPERACOES, COMPRAS, FINANCEIRO). Não há permissão avulsa de "ver custo". |

### Decisões de arquitetura recomendadas

1. **Escopo inicial: orçamento de evento (OS).** É o caso descrito no pedido.
   Estender ao orçamento de balcão fica para uma fase posterior, se for pedido.
2. **Custo como snapshot na linha do orçamento**, não no produto:
   - o valor sugerido é o custo da última compra (`PurchaseItem.unitCost`) e
     pode ser ajustado por usuário autorizado;
   - para serviço, o custo é digitado.

   Motivos: editar produto está fora de escopo, e mudar um custo de referência
   não pode alterar orçamentos antigos.
3. **Tipos de linha:** produto com lote (PCE ou não) ou serviço/equipamento sem
   lote. NEQ, reserva de estoque e Guia de Tráfego continuam valendo só para
   linhas com lote.
4. **Desconto único no orçamento**, em R$ ou %. Margem = (venda − desconto −
   custo) ÷ (venda − desconto). O valor final calculado substitui o
   `contractedAmount` manual e continua alimentando o Contas a Receber no
   encerramento.
5. **Proteção do custo no servidor:**
   - a API não serializa custo nem margem para quem não tem permissão (não
     basta esconder na tela);
   - o PDF do cliente sai de um endpoint próprio, montado a partir de um DTO
     só comercial.

   Esconder com CSS ou usar `window.print()` sobre a tela interna **não atende** ao 8.2.
6. **PDF gerado no servidor** e registrado no `AuditLog` (quem gerou e quando).
   Serve também para envio por e-mail ou WhatsApp.
7. **Permissão nova `CUSTOS`** em `UserRole`, atribuída por usuário. ADMIN
   sempre vê. Atende ao "configurável por usuário" sem reescrever o controle de acesso.
8. **Campos novos na OS:** nome do evento, condições de pagamento (texto) e
   validade da proposta.
9. **Auditoria** de alteração de preço, custo e desconto, e de geração do PDF.

### Fases propostas (esforço total: grande)

- **A — Base no backend:**
  - linhas de OS com preço de venda, custo e tipo de linha;
  - desconto, campos novos e perfil `CUSTOS`;
  - serialização filtrada por perfil;
  - migração só aditiva.
- **B — Tela interna:** custo e venda lado a lado, com totais, desconto e margem em tempo real.
- **C — PDF do cliente no servidor**, com teste automatizado provando que o
  arquivo não contém nenhum dado de custo ou margem.
- **D — Visão da administração:** custo total, descontos e margem por
  orçamento, período e vendedor.

### Perguntas em aberto (decisão do Rafael)

1. Só orçamento de evento (OS), ou o orçamento de balcão também precisa de custo e margem?
2. Equipe técnica e máquina de CO₂ entram como cadastro reutilizável
   ("catálogo de serviços", com preço e custo padrão) ou como texto livre em cada orçamento?
3. O custo sugerido pela última compra serve, ou a empresa tem uma tabela de
   custos própria que deve ser a referência?
