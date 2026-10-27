"use client";

import type { Sale } from "@/lib/api";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { COMPANY_CONFIG } from "@/lib/company-config";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface SaleReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export function SaleReceiptModal({ sale, onClose }: SaleReceiptModalProps) {
  useEscapeToClose(Boolean(sale), onClose);
  useModalFocusTrap(Boolean(sale));

  if (!sale) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content print-document"
        id="sale-receipt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sale-receipt-title"
        style={{ maxWidth: "640px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header no-print">
          <div>
            <p className="eyebrow">Comprovante de Venda</p>
            <h2 id="sale-receipt-title">
              Recibo PDV — Venda #{sale.id.slice(0, 8).toUpperCase()}
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
          {/* Cabeçalho Recibo */}
          <div style={{ borderBottom: "2px dashed #000000", paddingBottom: "0.75rem", marginBottom: "0.75rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{COMPANY_CONFIG.legalName}</div>
            <div style={{ fontSize: "0.8rem", color: "#374151" }}>{COMPANY_CONFIG.fullAddress}</div>
            <div style={{ fontSize: "0.8rem" }}>CNPJ: {COMPANY_CONFIG.taxId} · {COMPANY_CONFIG.crNumber} · Tel: {COMPANY_CONFIG.phone}</div>
            <h4 style={{ marginTop: "0.4rem", fontSize: "0.95rem", textTransform: "uppercase" }}>
              Comprovante de Atendimento no Balcão (PDV)
            </h4>
            <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
              Venda: <strong>#{sale.id.slice(0, 8).toUpperCase()}</strong> · Data: <strong>{formatDateTime(sale.createdAt)}</strong>
            </div>
          </div>

          {/* Cliente */}
          <div style={{ fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            <div>Cliente: <strong>{sale.customer?.legalName || "Consumidor Final (Venda Presencial)"}</strong></div>
            {sale.customer?.taxId && (
              <div>CPF/CNPJ: <span>{sale.customer.taxId}</span></div>
            )}
          </div>

          {/* Tabela de Itens */}
          <table className="print-table" style={{ fontSize: "0.75rem", marginBottom: "0.75rem" }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Preço Un.</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it, idx) => (
                <tr key={idx}>
                  <td>{it.product?.name || "Produto"}</td>
                  <td>{formatNumber(Number(it.quantity))}</td>
                  <td>{formatCurrency(Number(it.unitPrice))}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(Number(it.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totalizador */}
          <div style={{ borderTop: "2px dashed #000000", paddingTop: "0.5rem", textAlign: "right", fontSize: "0.95rem" }}>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, marginTop: "0.25rem", color: "#047857" }}>
              TOTAL PAGO: {formatCurrency(Number(sale.total))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", marginTop: "1rem", paddingTop: "0.5rem", fontSize: "0.7rem", color: "#4b5563", textAlign: "center" }}>
            Mercadoria conferida e entregue no balcão. Para circulação externa de controlados (PCE), porte obrigatório da Guia de Tráfego e Documento Fiscal correspondente.
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
            Imprimir Recibo
          </button>
        </div>
      </div>
    </div>
  );
}
