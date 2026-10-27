"use client";

import type { TrafficGuide } from "@/lib/api";
import { formatNumber } from "@/lib/format";

interface PrintGtModalProps {
  guide: TrafficGuide | null;
  onClose: () => void;
}

export function PrintGtModal({ guide, onClose }: PrintGtModalProps) {
  if (!guide) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        id="view-gt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-gt-title"
        style={{ maxWidth: "850px" }}
      >
        <div className="modal-header">
          <h2 id="view-gt-title">
            Espelho Oficial - Guia de Tráfego #{guide.number}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar visualização"
          >
            ✕
          </button>
        </div>
        <div
          className="modal-body"
          style={{
            maxHeight: "75vh",
            overflowY: "auto",
            fontFamily: "serif",
          }}
        >
          <div
            style={{
              textAlign: "center",
              borderBottom: "2px solid #000",
              paddingBottom: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <h3
              style={{
                margin: 0,
                textTransform: "uppercase",
                fontSize: "1.1rem",
              }}
            >
              República Federativa do Brasil
            </h3>
            <h4
              style={{
                margin: "4px 0",
                textTransform: "uppercase",
                fontSize: "1rem",
              }}
            >
              Ministério da Defesa • Exército Brasileiro
            </h4>
            <div style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
              Comando Logístico (COLOG) • Diretoria de Fiscalização de Produtos
              Controlados (DFPC)
            </div>
            <div
              style={{
                marginTop: "0.5rem",
                fontSize: "1.2rem",
                fontWeight: "bold",
              }}
            >
              GUIA DE TRÁFEGO PARA TRANSPORTE DE PCE (R-105)
            </div>
            <div style={{ fontSize: "1rem", color: "#444" }}>
              Nº {guide.number} • Status: {guide.status}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
              fontSize: "0.9rem",
            }}
          >
            <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <strong>EXPEDIDOR / ORIGEM:</strong>
              <div>Casa de Fogos SisPiro ERP</div>
              <div>
                Paiol: {guide.sourceMagazine?.name || "Paiol Central"}
              </div>
              <div>
                Município: {guide.originCity} / {guide.originState}
              </div>
            </div>

            <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <strong>DESTINATÁRIO / FINALIDADE:</strong>
              <div>
                Destino: {guide.destinationCity} / {guide.destinationState}
              </div>
              <div>Itinerário: {guide.routeDescription}</div>
              {guide.fiscalDocument && (
                <div>NF-e Vinculada: #{guide.fiscalDocument.number}</div>
              )}
              {guide.serviceOrder && (
                <div>OS de Queima: #{guide.serviceOrder.code}</div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1rem",
              fontSize: "0.9rem",
            }}
          >
            <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <strong>DADOS DO TRANSPORTE:</strong>
              <div>
                Veículo: Placa {guide.vehiclePlate} ({guide.vehiclePlateState}
                )
              </div>
              <div>Motorista: {guide.driverName}</div>
              <div>
                CPF: {guide.driverCpf} • CNH: {guide.driverLicense}
              </div>
              <div>
                Certificação MOPP:{" "}
                {guide.hasMopp ? "SIM (Habilitado)" : "NÃO"}
              </div>
            </div>

            <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <strong>RESPONSABILIDADE TÉCNICA:</strong>
              {guide.blaster ? (
                <>
                  <div>Blaster: {guide.blaster.name}</div>
                  <div>
                    Carteira de Blaster: {guide.blaster.licenseNumber}
                  </div>
                </>
              ) : (
                <div>
                  Transporte regular sob responsabilidade do expedidor
                </div>
              )}
              <div style={{ marginTop: "0.25rem", fontWeight: "bold" }}>
                Massa Líquida de Explosivo Total:{" "}
                {formatNumber(Number(guide.totalNeqKg), 4)} kg NEQ
              </div>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <strong>DISCRIMINAÇÃO DOS MATERIAIS CONTROLADOS (PCE):</strong>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "0.5rem",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #000" }}>
                  <th style={{ textAlign: "left", padding: "4px" }}>
                    Item / Descrição
                  </th>
                  <th style={{ textAlign: "left", padding: "4px" }}>
                    Nº Lote
                  </th>
                  <th style={{ textAlign: "center", padding: "4px" }}>
                    Classe ONU
                  </th>
                  <th style={{ textAlign: "right", padding: "4px" }}>Qtd</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>
                    NEQ (kg)
                  </th>
                </tr>
              </thead>
              <tbody>
                {guide.items?.map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px" }}>
                      {it.product?.name || "Produto PCE"}
                    </td>
                    <td style={{ padding: "4px" }}>
                      {it.productLot?.lotNumber || "-"}
                    </td>
                    <td style={{ textAlign: "center", padding: "4px" }}>
                      {it.unNumber} ({it.riskClass})
                    </td>
                    <td style={{ textAlign: "right", padding: "4px" }}>
                      {it.quantity}
                    </td>
                    <td style={{ textAlign: "right", padding: "4px" }}>
                      {(Number(it.neqGrams) / 1000).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2rem",
              textAlign: "center",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ borderTop: "1px solid #000", paddingTop: "0.5rem" }}>
              Assinatura do Motorista Transportador
            </div>
            <div style={{ borderTop: "1px solid #000", paddingTop: "0.5rem" }}>
              Assinatura do Blaster / Responsável Técnico
            </div>
          </div>
        </div>

        <div className="modal-footer">
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
