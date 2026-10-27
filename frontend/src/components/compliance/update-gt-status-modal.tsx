"use client";

import type { FormEvent } from "react";
import type { TrafficGuide, TrafficGuideStatus } from "@/lib/api";

interface UpdateGtStatusModalProps {
  guide: TrafficGuide | null;
  newStatus: TrafficGuideStatus;
  statusReason: string;
  statusSubmitting: boolean;
  statusError: string | null;
  onNewStatusChange: (status: TrafficGuideStatus) => void;
  onStatusReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function UpdateGtStatusModal({
  guide,
  newStatus,
  statusReason,
  statusSubmitting,
  statusError,
  onNewStatusChange,
  onStatusReasonChange,
  onClose,
  onSubmit,
}: UpdateGtStatusModalProps) {
  if (!guide) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        id="status-gt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-gt-title"
      >
        <div className="modal-header">
          <h2 id="status-gt-title">Atualizar Status - {guide.number}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={statusSubmitting}
          >
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {statusError && (
              <div className="alert alert-danger" role="alert">
                <p>{statusError}</p>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="new-status-select" className="form-label">
                Novo Status Regulatório *
              </label>
              <select
                id="new-status-select"
                className="form-input"
                value={newStatus}
                onChange={(e) =>
                  onNewStatusChange(e.target.value as TrafficGuideStatus)
                }
                required
              >
                <option value="EM_TRANSITO">
                  EM TRÂNSITO (Carga Liberada)
                </option>
                <option value="CONCLUIDA">
                  CONCLUÍDA (Chegada Confirmada no Destino)
                </option>
                <option value="CANCELADA">
                  CANCELADA (Viagem Suspensa/Revogada)
                </option>
              </select>
            </div>

            {newStatus === "CANCELADA" && (
              <div className="form-group">
                <label
                  htmlFor="status-reason-input"
                  className="form-label"
                >
                  Justificativa Militar do Cancelamento * (Mínimo 10
                  caracteres)
                </label>
                <textarea
                  id="status-reason-input"
                  className="form-input"
                  rows={3}
                  placeholder="Ex: Cancelamento do espetáculo por intempéries climáticas."
                  value={statusReason}
                  onChange={(e) => onStatusReasonChange(e.target.value)}
                  required
                />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="action-button secondary"
              onClick={onClose}
              disabled={statusSubmitting}
            >
              Voltar
            </button>
            <button
              type="submit"
              className="action-button primary"
              disabled={statusSubmitting}
            >
              {statusSubmitting ? "Atualizando..." : "Confirmar Alteração"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
