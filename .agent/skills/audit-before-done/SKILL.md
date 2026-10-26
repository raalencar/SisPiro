---
name: audit-before-done
description: Use antes de considerar qualquer entrega do backend ou frontend do SisPiro ERP como concluída, ou quando for pedida revisão/auditoria de uma mudança. Checklist de qualidade, invariantes de domínio, segurança e escopo.
---

Revisão independente de quem implementou a mudança, para evitar viés de
confirmação. Não corrija o problema encontrado — reporte (arquivo, linha,
cenário concreto de falha, qual regra foi violada) e pare; só aplique o fix
se isso tiver sido pedido explicitamente. Lista vazia é um resultado válido
— não invente achados para parecer produtivo.

## Qualidade geral

- Backend: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.
- Frontend: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Testes novos cobrem a regra de negócio nova, incluindo caso de rejeição,
  não só o caminho feliz.
- Sem abstrações ou flags especulativas para casos hipotéticos; sem
  comentários explicando o óbvio.

## Invariantes de domínio (ver `AGENTS.md` na raiz para o contexto completo)

- Trava de NEQ validada em transação com lock de linha antes de qualquer
  aumento de estoque físico.
- Lote com fabricação/validade/fabricante presente em toda entrada/saída de
  item PCE.
- Sem saldo negativo; lote vencido bloqueado para saída/transferência/split.
- Reservas de OS e orçamentos comerciais respeitadas (saldo "disponível"
  exclui reservado).
- PCE: cliente ativo, CR válido, classe autorizada checada antes de vender
  ou reservar.
- Toda gravação de negócio relevante grava audit log na mesma transação,
  com o usuário autenticado como ator.
- Dinheiro e NEQ usam `Decimal`, nunca `float`/`number`.
- Rota de negócio nova tem guard de perfil (`ESTOQUE`, `COMERCIAL`,
  `OPERACOES`, `COMPRAS`, `FINANCEIRO`, `ADMIN`).

## Segurança

- Nenhum token, segredo ou senha em texto plano, log, ou commitado.
- Frontend não grava access/refresh token em `localStorage`/
  `sessionStorage`; fluxo de token restrito ao BFF com cookies `HttpOnly`.
- Sem SQL cru concatenado, sem desabilitar validação de DTO, sem ampliar
  CORS/permissões sem necessidade explícita.
- Endpoints `operational-options`/`operational-lots` continuam omitindo
  CPF/CNPJ e número de CR.

## Escopo

- NF-e/NFC-e/NFS-e, Guia de Tráfego, PIX, conciliação OFX, MFA, recuperação
  de senha, rate limiting e parcelamento financeiro já estão implementados
  — evoluir essas áreas não é scope creep.
- Fora de escopo sem aprovação explícita registrada na conversa: emissão de
  MDF-e, importação de extrato CNAB, edição/exclusão de produtos, paióis,
  lotes ou movimentos de estoque.

## Evidência de verificação real (não só "build passou")

Para qualquer mudança visível em `frontend/`: a tarefa só está pronta com
evidência de ter rodado a jornada de verdade (print, gravação de navegador
ou passo a passo observado), não só lint/build/teste unitário passando.
Este histórico de bugs do projeto (ex.: campos inventados em Clientes,
fluxo de Compras completamente quebrado) veio de telas aceitas sem essa
verificação.

## Documentação

`backend/README.md`, `frontend/README.md`, `docs/STATUS-IMPLEMENTACAO.md`
e `README.md` raiz devem refletir exatamente o que foi implementado — nem
mais (aspiracional), nem menos (desatualizado).

## Formato do relatório

Achados ordenados por severidade (mais grave primeiro). Para cada achado:
arquivo, linha, o que está errado, cenário concreto que falha
(entrada/estado → resultado incorreto), e qual regra foi violada.
