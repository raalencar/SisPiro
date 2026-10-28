# Catálogo Amazon Fireworks (fornecedor)

Extraído em 2026-10-27 da WooCommerce Store API pública
(`https://www.amazonfireworks.com.br/wp-json/wc/store/v1/products`) — 167 produtos, 173 imagens.
Importável via `backend/prisma/import-supplier-catalog.mjs` para a tabela `fornecedor_catalogo_itens`
(ver `backend/README.md`). Itens só viram `Product` por cadastro explícito com NEQ/classe de risco. Importado em produção em 2026-10-27 (167 itens/173 imagens) sob o fornecedor matriz CNPJ 33.817.923/0001-90.

- `catalogo.json` / `catalogo.csv` — dados normalizados (código AMZ, efeito, embalagens, tempo, categorias, imagens).
- `imagens/` — fotos originais, nome `<CODIGO>_wc<wc_id>.<ext>` (fora do git, ~80 MB).
- `raw/` — resposta crua da API (fora do git).
- `build_catalog.py` — regenera o catálogo a partir de `raw/`.

Re-extrair: baixar `raw/products-p{1,2}.json` (`?per_page=100&page=N`) e rodar `python3 build_catalog.py`.

## Fornecedor
IMPORTACAO E EXPORTACAO AMAZON BR LTDA (nome fantasia AMAZON BR / marca Amazon Fireworks).
Matriz CNPJ 33.817.923/0001-90 — Lagoa da Prata/MG; filial 33.817.923/0002-70 — Fortaleza/CE (aberta 22/06/2026).
Confirmar com a NF de compra qual CNPJ fatura para a Casa de Fogos São João.

## Cuidados
- **Site de origem comprometido**: 150/167 descrições trazem JS malicioso ofuscado injetado
  (redirect para `olame.live`). O parser descarta esses parágrafos — nunca renderizar o HTML cru.
- **Código AMZ não é único**: 9 códigos repetidos entre produtos distintos (ex.: AMZ 2503–2508 usados
  tanto em "Fumaça de Solo" quanto em "Torta Smoke Cracker"; HAVAÍÍ/HAWAII duplicado). Usar `wc_id`
  como chave de origem e conferir com o fornecedor.
- 7 itens sem código (acessórios: tubos de fibra, fio, estalos).
- Sem preço (site é vitrine), sem dados PCE/lote/classe de risco/NEQ — isso precisa vir da nota/ficha
  técnica do fornecedor antes de qualquer cadastro de item PCE.
