"use client";

import type { TrafficGuide } from "@/lib/api";
import { formatDateOnly, formatNumber } from "@/lib/format";

interface GtTableProps {
  guides: TrafficGuide[];
  loading: boolean;
  onViewGuide: (guide: TrafficGuide) => void;
  onQuickDispatch: (guide: TrafficGuide) => void;
  onOpenStatusModal: (guide: TrafficGuide) => void;
}

export function GtTable({
  guides,
  loading,
  onViewGuide,
  onQuickDispatch,
  onOpenStatusModal,
}: GtTableProps) {
  if (loading) {
    return (
      <div className="empty-state" style={{ padding: "3rem" }}>
        <p>Carregando Guias de Tráfego...</p>
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "3rem" }}>
        <h3>Nenhuma Guia de Tráfego emitida</h3>
        <p>
          Emita a primeira Guia de Tráfego para autorizar o deslocamento legal
          de produtos controlados pelo Exército.
        </p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nº da GT</th>
            <th>Itinerário (Origem → Destino)</th>
            <th>Veículo / Placa</th>
            <th>Motorista / MOPP</th>
            <th>Blaster Técnico</th>
            <th>Carga NEQ (kg)</th>
            <th>Status</th>
            <th>Validade</th>
            <th style={{ textAlign: "right" }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {guides.map((gt) => (
            <tr key={gt.id}>
              <td>
                <strong>{gt.number}</strong>
                {gt.fiscalDocument && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-muted, #718096)",
                    }}
                  >
                    NF-e #{gt.fiscalDocument.number}
                  </div>
                )}
                {gt.serviceOrder && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-muted, #718096)",
                    }}
                  >
                    OS #{gt.serviceOrder.code}
                  </div>
                )}
              </td>
              <td>
                <strong>
                  {gt.originCity}/{gt.originState} → {gt.destinationCity}/
                  {gt.destinationState}
                </strong>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--color-muted, #718096)",
                  }}
                >
                  {gt.routeDescription}
                </div>
              </td>
              <td>
                <strong>
                  {gt.vehiclePlate} ({gt.vehiclePlateState})
                </strong>
                {gt.vehicleModel && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-muted, #718096)",
                    }}
                  >
                    {gt.vehicleModel}
                  </div>
                )}
              </td>
              <td>
                <div>
                  <strong>{gt.driverName}</strong>
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--color-muted, #718096)",
                  }}
                >
                  CNH: {gt.driverLicense}{" "}
                  {gt.hasMopp ? "• MOPP Ativo" : ""}
                </div>
              </td>
              <td>
                {gt.blaster ? (
                  <div>
                    <strong>{gt.blaster.name}</strong>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--color-muted, #718096)",
                      }}
                    >
                      CR: {gt.blaster.licenseNumber}
                    </div>
                  </div>
                ) : (
                  <span
                    style={{
                      color: "var(--color-muted, #718096)",
                      fontSize: "0.85rem",
                    }}
                  >
                    Não exigido
                  </span>
                )}
              </td>
              <td>
                <strong>
                  {formatNumber(Number(gt.totalNeqKg), 4)} kg NEQ
                </strong>
              </td>
              <td>
                <span
                  className={`badge ${
                    gt.status === "EMITIDA"
                      ? "badge-info"
                      : gt.status === "EM_TRANSITO"
                        ? "badge-warning"
                        : gt.status === "CONCLUIDA"
                          ? "badge-success"
                          : "badge-danger"
                  }`}
                >
                  {gt.status === "EM_TRANSITO"
                    ? "EM TRÂNSITO"
                    : gt.status === "CONCLUIDA"
                      ? "CONCLUÍDA"
                      : gt.status}
                </span>
              </td>
              <td>
                <div style={{ fontSize: "0.85rem" }}>
                  <div>De: {formatDateOnly(gt.validFrom)}</div>
                  <div>Até: {formatDateOnly(gt.validUntil)}</div>
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    className="action-button secondary sm"
                    onClick={() => onViewGuide(gt)}
                    title="Ver espelho da Guia de Tráfego"
                  >
                    Espelho GT
                  </button>

                  {gt.status === "EMITIDA" && (
                    <button
                      type="button"
                      className="action-button primary sm"
                      onClick={() => onQuickDispatch(gt)}
                      title="Liberar veículo e iniciar trânsito militar"
                    >
                      Despachar
                    </button>
                  )}

                  {gt.status !== "CONCLUIDA" &&
                    gt.status !== "CANCELADA" && (
                      <button
                        type="button"
                        className="action-button secondary sm"
                        onClick={() => onOpenStatusModal(gt)}
                        title="Mais opções de status / cancelamento"
                      >
                        Status...
                      </button>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
