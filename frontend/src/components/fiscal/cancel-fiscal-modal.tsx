"use client";

import type { FormEvent } from "react";
import type { FiscalDocument } from "@/lib/api";

interface CancelFiscalModalProps {
  doc: FiscalDocument | null;
  reason: string;
  submitting: boolean;
  error: string | null;
  onReasonChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function CancelFiscalModal({
  doc,
  reason,
  submitting,
  error,
  onReasonChange,
  onClose,
  onSubmit,
}: CancelFiscalModalProps) {
  if (!doc) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        id="cancel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
      >
        <div className="modal-header">
          <h2 id="cancel-modal-title">
            Cancelar Documento Fiscal #{doc.number}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-danger" role="alert">
                <p>{error}</p>
              </div>
            )}
            <p style={{ marginBottom: "1rem" }}>
              Atenção: O cancelamento será transmitido diretamente à
              SEFAZ/Prefeitura e é irreversível. A legislação exige
              justificativa legal com no mínimo 15 caracteres.
            </p>
            <div className="form-group">
              <label htmlFor="cancel-reason-input" className="form-label">
                Justificativa do Cancelamento * (Mínimo 15 caracteres)
              </label>
              <textarea
                id="cancel-reason-input"
                className="form-input"
                rows={3}
                placeholder="Ex: Venda cancelada por desacordo comercial antes da circulação da mercadoria."
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                required
              />
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-muted, #718096)",
                  marginTop: "0.25rem",
                }}
              >
                Caracteres digitados: {reason.length}/15 mínimo
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="action-button secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Voltar
            </button>
            <button
              type="submit"
              className="action-button danger"
              disabled={submitting || reason.trim().length < 15}
            >
              {submitting
                ? "Cancelando na SEFAZ..."
                : "Confirmar Cancelamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
