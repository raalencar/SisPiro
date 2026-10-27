"use client";

import type { TrafficGuide } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { COMPANY_CONFIG } from "@/lib/company-config";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface PrintGtModalProps {
  guide: TrafficGuide | null;
  onClose: () => void;
}

export function PrintGtModal({ guide, onClose }: PrintGtModalProps) {
  useEscapeToClose(Boolean(guide), onClose);
  useModalFocusTrap(Boolean(guide));

  if (!guide) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content print-document"
        id="view-gt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-gt-title"
        style={{ maxWidth: "860px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-header no-print flex items-center justify-between pb-3 border-b border-neutral-200">
          <div>
            <p className="eyebrow">Documento Regulatório Militar — R-105</p>
            <h2 id="view-gt-title" className="text-lg font-bold">
              Espelho Oficial - Guia de Tráfego #{guide.number}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button button--primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow"
              onClick={() => window.print()}
            >
              🖨️ Imprimir Guia Oficial (PDF)
            </button>
            <button
              type="button"
              className="button button--quiet text-xs py-1.5 px-2.5"
              onClick={onClose}
              aria-label="Fechar visualização"
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        <div className="print-sheet">
          {/* Cabeçalho Militar Oficial */}
          <div className="print-header-military">
            <div className="military-title">República Federativa do Brasil</div>
            <div className="military-subtitle">Ministério da Defesa · Exército Brasileiro</div>
            <div className="military-subtitle">Comando Logístico (COLOG) · Diretoria de Fiscalização de Produtos Controlados (DFPC)</div>
            <h3 style={{ marginTop: "0.5rem", fontSize: "1.1rem", textTransform: "uppercase" }}>
              Guia de Tráfego para Transporte de PCE (R-105)
            </h3>
            <div className="military-meta">
              Guia Nº <strong>#{guide.number}</strong> · Status: <strong>{guide.status}</strong> · Emissão SisPiro ERP
            </div>
          </div>

          {/* Dados de Origem e Destino */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div className="print-box">
              <div className="print-box-title">Expedidor / Origem</div>
              <div style={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                <div><strong>Razão Social:</strong> {COMPANY_CONFIG.legalName}</div>
                <div><strong>Nome Fantasia:</strong> {COMPANY_CONFIG.tradeName}</div>
                <div><strong>CNPJ / CR:</strong> {COMPANY_CONFIG.taxId} · {COMPANY_CONFIG.crNumber}</div>
                <div><strong>Endereço:</strong> {COMPANY_CONFIG.fullAddress}</div>
                <div><strong>Paiol de Saída:</strong> {guide.sourceMagazine?.name || "Paiol Central"}</div>
                <div><strong>Município:</strong> {guide.originCity} / {guide.originState}</div>
              </div>
            </div>

            <div className="print-box">
              <div className="print-box-title">Destinatário / Finalidade</div>
              <div style={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                <div><strong>Destino:</strong> {guide.destinationCity} / {guide.destinationState}</div>
                <div><strong>Itinerário:</strong> {guide.routeDescription}</div>
                {guide.fiscalDocument && (
                  <div><strong>NF-e Vinculada:</strong> #{guide.fiscalDocument.number}</div>
                )}
                {guide.serviceOrder && (
                  <div><strong>OS de Queima:</strong> #{guide.serviceOrder.code}</div>
                )}
              </div>
            </div>
          </div>

          {/* Dados do Transporte e Responsabilidade Técnica */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div className="print-box">
              <div className="print-box-title">Dados do Transporte Rodoviário</div>
              <div style={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                <div><strong>Veículo:</strong> Placa {guide.vehiclePlate} ({guide.vehiclePlateState})</div>
                <div><strong>Motorista Transportador:</strong> {guide.driverName}</div>
                <div><strong>CPF / CNH:</strong> {guide.driverCpf} · {guide.driverLicense}</div>
                <div><strong>Certificação MOPP:</strong> {guide.hasMopp ? "SIM (Habilitado para Cargas Perigosas)" : "NÃO"}</div>
              </div>
            </div>

            <div className="print-box">
              <div className="print-box-title">Responsabilidade Técnica & Carga</div>
              <div style={{ fontSize: "0.8rem", lineHeight: 1.4 }}>
                {guide.blaster ? (
                  <>
                    <div><strong>Blaster Encarregado:</strong> {guide.blaster.name}</div>
                    <div><strong>Carteira de Blaster:</strong> {guide.blaster.licenseNumber}</div>
                  </>
                ) : (
                  <div>Transporte regular de mercadorias sob responsabilidade do expedidor</div>
                )}
                <div style={{ marginTop: "0.35rem", fontWeight: 700, color: "#111827" }}>
                  Massa Líquida Total (NEQ): {formatNumber(Number(guide.totalNeqKg), 4)} kg NEQ
                </div>
              </div>
            </div>
          </div>

          {/* Discriminação dos Materiais Controlados */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.25rem", textTransform: "uppercase" }}>
              Discriminação dos Produtos Controlados pelo Exército (PCE)
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Produto / Artigo Pirotécnico</th>
                  <th style={{ textAlign: "left" }}>Nº Lote</th>
                  <th style={{ textAlign: "center" }}>Classe ONU</th>
                  <th style={{ textAlign: "right" }}>Qtd</th>
                  <th style={{ textAlign: "right" }}>NEQ (kg)</th>
                </tr>
              </thead>
              <tbody>
                {guide.items?.map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.product?.name || "Produto PCE"}</td>
                    <td>{it.productLot?.lotNumber || "-"}</td>
                    <td style={{ textAlign: "center" }}>{it.unNumber} ({it.riskClass})</td>
                    <td style={{ textAlign: "right" }}>{it.quantity}</td>
                    <td style={{ textAlign: "right" }}>{(Number(it.neqGrams) / 1000).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Campo de Assinaturas Formais */}
          <div className="print-signatures-grid">
            <div>
              <div className="print-signature-line">
                <strong>{guide.driverName}</strong>
                <div>Motorista Transportador (MOPP)</div>
              </div>
            </div>
            <div>
              <div className="print-signature-line">
                <strong>{guide.blaster?.name || "Responsável Técnico"}</strong>
                <div>Blaster Pirotécnico / Responsável Técnico</div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
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
            Imprimir Guia Oficial
          </button>
        </div>
      </div>
    </div>
  );
}
