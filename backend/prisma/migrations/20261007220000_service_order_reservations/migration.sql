CREATE INDEX "ordens_servico_status_data_evento_idx"
ON "ordens_servico"("status", "data_evento");

CREATE INDEX "ordem_servico_itens_produto_lote_id_idx"
ON "ordem_servico_itens"("produto_lote_id");
