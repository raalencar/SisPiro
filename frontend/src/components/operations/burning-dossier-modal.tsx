"use client";

import type { ServiceOrder } from "@/lib/api";
import { formatCurrency, formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";
import { COMPANY_CONFIG } from "@/lib/company-config";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface BurningDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ServiceOrder | null;
}

export function BurningDossierModal({
  isOpen,
  onClose,
  order,
}: BurningDossierModalProps) {
  useEscapeToClose(isOpen, onClose);
  useModalFocusTrap(isOpen);

  if (!isOpen || !order) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content print-document"
        id="burning-order-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="burning-order-title"
        style={{ maxWidth: "860px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header no-print">
          <div>
            <p className="eyebrow">Documento Técnico Operacional</p>
            <h2 id="burning-order-title">
              Ficha Técnica de Montagem e Ordem de Queima — OS #{order.code}
            </h2>
          </div>
          <button
            className="button button--quiet"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <div className="print-sheet">
          {/* Cabeçalho da Ordem de Queima */}
          <div className="print-header-military">
            <div className="military-title">{COMPANY_CONFIG.legalName}</div>
            <div className="military-subtitle">{COMPANY_CONFIG.tradeName} · {COMPANY_CONFIG.crNumber}</div>
            <div className="military-subtitle">{COMPANY_CONFIG.fullAddress} · Tel: {COMPANY_CONFIG.phone}</div>
            <h3 style={{ marginTop: "0.5rem", fontSize: "1.1rem", textTransform: "uppercase" }}>
              Ordem de Queima & Ficha Técnica de Montagem em Campo
            </h3>
            <div className="military-meta">
              Ordem de Serviço nº <strong>#{order.code}</strong> · Situação Atual: <strong>{order.status}</strong>
            </div>
          </div>

          {/* Informações do Evento e Localização */}
          <div className="print-box">
            <div className="print-box-title">Dados do Evento e Contratante</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr", gap: "0.5rem", fontSize: "0.8rem" }}>
              <div>
                <span>Título do Show: </span>
                <strong>Espetáculo Pirotécnico #{order.code}</strong>
              </div>
              <div>
                <span>Data/Hora do Evento: </span>
                <strong>{formatDateTime(order.eventAt)}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr", gap: "0.5rem", fontSize: "0.8rem", marginTop: "0.3rem" }}>
              <div>
                <span>Local da Montagem/Queima: </span>
                <strong>{order.eventLocation}</strong>
              </div>
              <div>
                <span>Cliente Contratante: </span>
                <span>{order.customer.legalName}</span>
              </div>
            </div>
          </div>

          {/* Responsabilidade Técnica do Blaster */}
          <div className="print-box">
            <div className="print-box-title">Equipe Técnica e Habilitação Militar (DFPC/COLOG)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "0.5rem", fontSize: "0.8rem" }}>
              <div>
                <span>Blaster Encarregado: </span>
                <strong>{order.responsibleBlaster?.name ?? "Designado na montagem"}</strong>
              </div>
              <div>
                <span>Habilitação Técnica: </span>
                <span>
                  {order.responsibleBlaster
                    ? `Vigente até ${formatDateOnly(order.responsibleBlaster.licenseExpiresAt)}`
                    : "CREA/CR Vigente"}
                </span>
              </div>
              <div>
                <span>ART nº: </span>
                <strong>{order.artNumber ?? "ART vinculada"}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "0.5rem", fontSize: "0.8rem", marginTop: "0.3rem" }}>
              <div>
                <span>Carga Líquida Explosiva Total: </span>
                <strong style={{ color: "#b91c1c" }}>{formatNumber(Number(order.reservedNeqKg), 2)} kg NEQ</strong>
              </div>
              <div>
                <span>Valor do Contrato: </span>
                <strong>{formatCurrency(Number(order.contractedAmount))}</strong>
              </div>
              <div>
                <span>Reserva no Paiol: </span>
                <span>{order.reservationActive ? "Ativa no WMS" : "Liberada"}</span>
              </div>
            </div>
          </div>

          {/* Tabela de Produtos e Explosivos Alocados com Colunas de Anotação de Campo */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem", textTransform: "uppercase" }}>
              Relação de Produtos Controlados Alocados e Anotação de Disparo
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Produto / SKU</th>
                  <th style={{ width: "15%" }}>Lote</th>
                  <th style={{ width: "12%" }}>Qtd Prevista</th>
                  <th style={{ width: "12%" }}>NEQ (kg)</th>
                  <th style={{ width: "13%" }}>Disparado</th>
                  <th style={{ width: "13%" }}>Sobra / Falha</th>
                </tr>
              </thead>
              <tbody>
                {order.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#6b7280" }}>
                      Nenhum item alocado para esta ordem de serviço.
                    </td>
                  </tr>
                ) : (
                  order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.product.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>{item.product.sku}</div>
                      </td>
                      <td>{item.productLot.lotNumber}</td>
                      <td>
                        <strong>{formatNumber(Number(item.plannedQuantity))} {item.product.unit}</strong>
                      </td>
                      <td>{formatNumber(Number(item.neqKg), 2)} kg</td>
                      <td style={{ background: "#fdfdfd", borderBottom: "1px dashed #000" }}>
                        {item.firedQuantity !== null && item.firedQuantity !== undefined
                          ? `${formatNumber(Number(item.firedQuantity))} ${item.product.unit}`
                          : "____"}
                      </td>
                      <td style={{ background: "#fdfdfd", borderBottom: "1px dashed #000" }}>
                        {item.firedQuantity !== null && item.firedQuantity !== undefined
                          ? `${formatNumber(Number(item.plannedQuantity) - Number(item.firedQuantity))} ${item.product.unit}`
                          : "____"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Checklist de Segurança Pré e Pós Queima */}
          <div className="print-box">
            <div className="print-box-title">Checklist Operacional e Segurança de Campo</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.75rem" }}>
              <div>
                <div>[ ] Perímetro de isolamento isolado conforme distâncias da tabela de segurança.</div>
                <div style={{ marginTop: "0.2rem" }}>[ ] Linhas de disparo testadas com ohmímetro de segurança intrínseca.</div>
                <div style={{ marginTop: "0.2rem" }}>[ ] Equipamentos de combate a incêndio (extintores H2O/PQS) no local.</div>
              </div>
              <div>
                <div>[ ] Vistoria da direção e intensidade do vento imediatamente antes do show.</div>
                <div style={{ marginTop: "0.2rem" }}>[ ] Autorização prévia do Corpo de Bombeiros e órgãos locais de trânsito.</div>
                <div style={{ marginTop: "0.2rem" }}>[ ] Varredura pós-queima realizada para neutralização de falhas de detonação.</div>
              </div>
            </div>
          </div>

          {/* Assinaturas */}
          <div className="print-signatures-grid">
            <div>
              <div className="print-signature-line">
                <strong>Blaster Pirotécnico Encarregado</strong>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                  {order.responsibleBlaster?.name ?? "Responsável Técnico"} · ART {order.artNumber ?? "Vinculada"}
                </div>
              </div>
            </div>
            <div>
              <div className="print-signature-line">
                <strong>Contratante / Responsável pelo Evento</strong>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                  {order.customer.legalName}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            type="button"
            className="button button--quiet"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.print()}
          >
            Imprimir Ordem de Queima
          </button>
        </div>
      </div>
    </div>
  );
}
