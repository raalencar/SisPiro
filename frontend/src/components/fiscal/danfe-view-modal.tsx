"use client";

import type { FiscalDocument } from "@/lib/api";
import { COMPANY_CONFIG } from "@/lib/company-config";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface DanfeViewModalProps {
  doc: FiscalDocument | null;
  onClose: () => void;
}

export function DanfeViewModal({ doc, onClose }: DanfeViewModalProps) {
  if (!doc) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content print-document"
        id="danfe-view-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="danfe-view-title"
        style={{
          maxWidth: "860px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div className="modal-header no-print">
          <div>
            <p className="eyebrow">
              Documento Auxiliar da Nota Fiscal Eletrônica
            </p>
            <h2 id="danfe-view-title">
              Espelho DANFE — {doc.type} nº {doc.number}
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
          {/* Cabeçalho DANFE */}
          <div
            style={{
              border: "2px solid #000000",
              padding: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {COMPANY_CONFIG.legalName}
                </h3>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#374151",
                    marginTop: "0.25rem",
                  }}
                >
                  {COMPANY_CONFIG.fullAddress}
                </div>
                <div style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  CNPJ: <strong>{COMPANY_CONFIG.taxId}</strong> · IE:{" "}
                  <strong>{COMPANY_CONFIG.stateRegistration}</strong>
                </div>
                <div style={{ fontSize: "0.8rem" }}>
                  Certificado de Registro (CR):{" "}
                  <strong>{COMPANY_CONFIG.crNumber}</strong>
                </div>
              </div>

              <div
                style={{
                  borderLeft: "2px solid #000000",
                  paddingLeft: "1rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  DANFE Simplificado
                </div>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                  Documento Auxiliar da{" "}
                  {doc.type === "NFE"
                    ? "Nota Fiscal Eletrônica (Mod 55)"
                    : doc.type === "NFCE"
                      ? "Nota Fiscal de Consumidor Eletrônica (Mod 65)"
                      : "Nota Fiscal de Serviços Eletrônica"}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <div>
                    Série: <strong>{doc.series}</strong>
                  </div>
                  <div>
                    Número: <strong>{doc.number}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chave de Acesso e Código de Barras */}
          <div className="print-barcode-box">
            <div className="print-barcode-simulation" />
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "0.95rem",
                fontWeight: 700,
                letterSpacing: "1px",
                textAlign: "center",
              }}
            >
              {doc.accessKey
                ? doc.accessKey.replace(/(.{4})/g, "$1 ").trim()
                : "CHAVE DE ACESSO HOMOLOGADA PELA SEFAZ"}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "#4b5563",
                marginTop: "0.25rem",
              }}
            >
              Consulta de autenticidade no portal oficial da SEFAZ
              autorizadora
            </div>
          </div>

          {/* Protocolo de Autorização */}
          <div className="print-box">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "0.5rem",
                fontSize: "0.8rem",
              }}
            >
              <div>
                Protocolo de Autorização de Uso:{" "}
                <strong>
                  {doc.protocol || "SEFAZ-HOMOLOGADO-001"}
                </strong>
              </div>
              <div style={{ textAlign: "right" }}>
                Data/Hora de Autorização:{" "}
                <strong>
                  {formatDateTime(doc.issuedAt || doc.createdAt)}
                </strong>
              </div>
            </div>
          </div>

          {/* Destinatário / Tomador */}
          <div className="print-box">
            <div className="print-box-title">Destinatário / Remetente</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "0.5rem",
                fontSize: "0.8rem",
              }}
            >
              <div>
                Razão Social / Nome:{" "}
                <strong>
                  {doc.sale?.customer?.legalName ||
                    doc.serviceOrder?.customer?.legalName ||
                    "Consumidor Final / Operação Presencial"}
                </strong>
              </div>
              <div>
                CPF / CNPJ:{" "}
                <strong>
                  {doc.sale?.customer?.taxId ||
                    doc.serviceOrder?.customer?.taxId ||
                    "Não informado"}
                </strong>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "0.5rem",
                fontSize: "0.8rem",
                marginTop: "0.25rem",
              }}
            >
              <div>
                Referência Interna:{" "}
                <span>
                  {doc.sale
                    ? `Venda Comercial #${doc.sale.code}`
                    : doc.serviceOrder
                      ? `Ordem de Serviço #${doc.serviceOrder.code} - ${doc.serviceOrder.eventLocation}`
                      : "Lançamento Avulso"}
                </span>
              </div>
              <div>
                Ambiente: <strong>Produção / SEFAZ</strong>
              </div>
            </div>
          </div>

          {/* Totais do Documento */}
          <div className="print-box">
            <div className="print-box-title">
              Cálculo do Imposto e Totais da Operação
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.5rem",
                textAlign: "center",
                fontSize: "0.8rem",
              }}
            >
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Base ICMS
                </div>
                <strong>
                  {formatCurrency(Number(doc.totalAmount))}
                </strong>
              </div>
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Valor ICMS (Simples)
                </div>
                <strong>R$ 0,00</strong>
              </div>
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  PIS / COFINS
                </div>
                <strong>R$ 0,00</strong>
              </div>
              <div
                style={{
                  padding: "0.25rem",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  Valor Total da Nota
                </div>
                <strong style={{ fontSize: "0.95rem", color: "#047857" }}>
                  {formatCurrency(Number(doc.totalAmount))}
                </strong>
              </div>
            </div>
          </div>

          {/* Dados Adicionais */}
          <div className="print-box">
            <div className="print-box-title">
              Dados Adicionais / Observações de Interesse do Fisco
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                lineHeight: 1.5,
                color: "#374151",
              }}
            >
              <p style={{ margin: "0 0 0.25rem 0" }}>
                • Documento emitido por ME ou EPP optante pelo Simples
                Nacional. Não gera direito a crédito fiscal de IPI.
              </p>
              <p style={{ margin: "0 0 0.25rem 0" }}>
                • Operação com Produtos Controlados pelo Exército (PCE).
                Rastreabilidade de lotes e fabricação asseguradas conforme
                Decreto nº 10.030/2019 (R-105).
              </p>
              <p style={{ margin: 0 }}>
                • Transporte rodoviário acobertado por Guia de Tráfego Militar
                expedida nos termos da legislação vigente.
              </p>
            </div>
          </div>
        </div>

        <div
          className="modal-footer no-print"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            className="action-button secondary"
            onClick={onClose}
          >
            Fechar
          </button>
          <button
            type="button"
            className="action-button primary"
            onClick={() => window.print()}
          >
            Imprimir DANFE
          </button>
        </div>
      </div>
    </div>
  );
}
