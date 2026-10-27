"use client";

import type { SalesQuote } from "@/lib/api";
import { formatCurrency, formatDateOnly, formatNumber } from "@/lib/format";
import { COMPANY_CONFIG } from "@/lib/company-config";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface QuotePrintModalProps {
  quote: SalesQuote | null;
  onClose: () => void;
}

export function QuotePrintModal({ quote, onClose }: QuotePrintModalProps) {
  useEscapeToClose(Boolean(quote), onClose);
  useModalFocusTrap(Boolean(quote));

  if (!quote) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content print-document"
        id="quote-print-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-print-title"
        style={{ maxWidth: "860px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header no-print flex items-center justify-between pb-3 border-b border-neutral-200">
          <div>
            <p className="eyebrow">Documento Comercial Formal</p>
            <h2 id="quote-print-title" className="text-lg font-bold">
              Proposta Comercial — Orçamento #{quote.id.slice(0, 8).toUpperCase()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="button button--primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow"
              type="button"
              onClick={() => window.print()}
            >
              🖨️ Imprimir Proposta (PDF)
            </button>
            <button
              className="button button--quiet text-xs py-1.5 px-2.5"
              type="button"
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="print-sheet">
          {/* Cabeçalho da Proposta */}
          <div className="print-header-military">
            <div className="military-title">{COMPANY_CONFIG.legalName}</div>
            <div className="military-subtitle">{COMPANY_CONFIG.tradeName} · {COMPANY_CONFIG.fullAddress}</div>
            <div className="military-subtitle">CNPJ: {COMPANY_CONFIG.taxId} · {COMPANY_CONFIG.crNumber} · Tel: {COMPANY_CONFIG.phone}</div>
            <h3 style={{ marginTop: "0.5rem", fontSize: "1.1rem", textTransform: "uppercase" }}>
              Proposta Comercial & Orçamento Formal
            </h3>
            <div className="military-meta">
              Orçamento: <strong>#{quote.id.slice(0, 8).toUpperCase()}</strong> · Emitido em: <strong>{formatDateOnly(quote.createdAt)}</strong> · Validade: <strong>7 dias</strong> ({formatDateOnly(quote.expiresAt)})
            </div>
          </div>

          {/* Dados do Cliente */}
          <div className="print-box">
            <div className="print-box-title">Identificação do Cliente / Proponente</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr", gap: "0.5rem", fontSize: "0.8rem" }}>
              <div>
                <span>Razão Social / Nome: </span>
                <strong>{quote.customer?.legalName || "Cliente Especial / Orçamento Direto"}</strong>
              </div>
              <div>
                <span>CPF / CNPJ: </span>
                <strong>{quote.customer?.taxId || "Não informado"}</strong>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr", gap: "0.5rem", fontSize: "0.8rem", marginTop: "0.3rem" }}>
              <div>
                <span>Certificado de Registro (CR): </span>
                <span>{quote.customer?.hasCr ? "Registrado no SFPC" : "Pessoa Física / Venda Livre (Fogos Classe A/B)"}</span>
              </div>
              <div>
                <span>Status do Orçamento: </span>
                <strong style={{ color: "#047857" }}>{quote.status}</strong>
              </div>
            </div>
          </div>

          {/* Tabela de Itens Cotados */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem", textTransform: "uppercase" }}>
              Relação de Produtos e Valores Unitários
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Produto / Descrição</th>
                  <th style={{ width: "12%" }}>Qtd</th>
                  <th style={{ width: "20%" }}>Preço Unitário</th>
                  <th style={{ width: "23%", textAlign: "right" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{it.product?.name || "Item Pirotécnico"}</strong>
                      <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>{it.product?.sku}</div>
                    </td>
                    <td>{formatNumber(Number(it.quantity))} un.</td>
                    <td>{formatCurrency(Number(it.unitPrice))}</td>
                    <td style={{ textAlign: "right" }}>
                      <strong>{formatCurrency(Number(it.subtotal))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resumo Financeiro */}
          <div className="print-box">
            <div className="print-box-title">Condições Comerciais e Totais</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem", textAlign: "center", fontSize: "0.8rem" }}>
              <div style={{ padding: "0.25rem", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Total dos Produtos</div>
                <strong>{formatCurrency(quote.items.reduce((acc, it) => acc + Number(it.subtotal), 0))}</strong>
              </div>
              <div style={{ padding: "0.25rem", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Valor Total da Proposta</div>
                <strong style={{ fontSize: "1rem", color: "#047857" }}>{formatCurrency(Number(quote.total))}</strong>
              </div>
            </div>
          </div>

          {/* Cláusulas e Termos */}
          <div className="print-box">
            <div className="print-box-title">Termos de Fornecimento e Regulamento PCE</div>
            <div style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "#374151" }}>
              <p style={{ margin: "0 0 0.25rem 0" }}>
                1. A presente proposta garante os preços e a reserva física dos lotes pelo prazo improrrogável de 7 (sete) dias corridos a partir da data de emissão.
              </p>
              <p style={{ margin: "0 0 0.25rem 0" }}>
                2. Para produtos controlados (PCE), a liberação da mercadoria depende da apresentação de CR vigente e emissão de Guia de Tráfego conforme normas do Comando Logístico (COLOG).
              </p>
              <p style={{ margin: 0 }}>
                3. Formas de pagamento aceitas: PIX Instantâneo, Boleto Bancário Faturado (sujeito à análise de crédito) e Cartão.
              </p>
            </div>
          </div>

          {/* Assinaturas */}
          <div className="print-signatures-grid">
            <div>
              <div className="print-signature-line">
                <strong>{COMPANY_CONFIG.tradeName}</strong>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>Consultor Comercial Responsável</div>
              </div>
            </div>
            <div>
              <div className="print-signature-line">
                <strong>Aceite do Cliente (De Acordo)</strong>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>Nome / Assinatura do Comprador</div>
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
            Imprimir Proposta
          </button>
        </div>
      </div>
    </div>
  );
}
