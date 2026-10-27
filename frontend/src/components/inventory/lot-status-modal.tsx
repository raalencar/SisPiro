"use client";

import type { FormEvent } from "react";
import type { ProductLot, ProductLotStatus } from "@/lib/api";

interface LotStatusModalProps {
  lot: ProductLot | null;
  newStatus: ProductLotStatus;
  statusReason: string;
  statusSubmitting: boolean;
  statusError: string | null;
  onNewStatusChange: (status: ProductLotStatus) => void;
  onStatusReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function LotStatusModal({
  lot,
  newStatus,
  statusReason,
  statusSubmitting,
  statusError,
  onNewStatusChange,
  onStatusReasonChange,
  onClose,
  onSubmit,
}: LotStatusModalProps) {
  if (!lot) return null;

  return (
    <div
      className="form-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !statusSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className="inventory-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lot-status-dialog-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Rastreabilidade e Quarentena</p>
            <h2 id="lot-status-dialog-title">
              Situação do Lote: {lot.lotNumber}
            </h2>
          </div>
          <button
            className="button button--quiet"
            type="button"
            disabled={statusSubmitting}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <form className="form-stack inventory-form" onSubmit={onSubmit}>
          {statusError && (
            <p className="form-error" role="alert">
              {statusError}
            </p>
          )}
          <label className="field">
            <span>Situação Regulatória do Lote</span>
            <select
              value={newStatus}
              onChange={(e) =>
                onNewStatusChange(e.target.value as ProductLotStatus)
              }
              required
            >
              <option value="DISPONIVEL">
                Disponível (Liberado para saídas e reservas)
              </option>
              <option value="QUARENTENA">
                Quarentena (Retido para conferência/análise)
              </option>
              <option value="BLOQUEADO">
                Bloqueado (Interditado para saídas e entradas)
              </option>
            </select>
          </label>

          <label className="field">
            <span>
              Motivo da Situação{" "}
              {newStatus !== "DISPONIVEL" ? "(Obrigatório)" : "(Opcional)"}
            </span>
            <input
              type="text"
              maxLength={255}
              value={statusReason}
              onChange={(e) => onStatusReasonChange(e.target.value)}
              placeholder="Ex.: Laudo de inspeção, avaria física na caixa, retenção fiscal"
              required={newStatus !== "DISPONIVEL"}
            />
          </label>

          <div className="form-actions">
            <button
              className="button button--quiet"
              type="button"
              disabled={statusSubmitting}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={statusSubmitting}
            >
              {statusSubmitting ? "Gravando..." : "Salvar Situação"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
