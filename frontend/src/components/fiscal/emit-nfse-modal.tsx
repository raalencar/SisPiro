"use client";

import type { FormEvent } from "react";
import type { ServiceOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface EmitNfseModalProps {
  isOpen: boolean;
  serviceOrders: ServiceOrder[];
  orderId: string;
  description: string;
  submitting: boolean;
  error: string | null;
  onOrderIdChange: (id: string) => void;
  onDescriptionChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function EmitNfseModal({
  isOpen,
  serviceOrders,
  orderId,
  description,
  submitting,
  error,
  onOrderIdChange,
  onDescriptionChange,
  onClose,
  onSubmit,
}: EmitNfseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        id="nfse-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nfse-modal-title"
      >
        <div className="modal-header">
          <h2 id="nfse-modal-title">
            Emitir NFS-e (Serviços Pirotécnicos)
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
            <div className="form-group">
              <label htmlFor="nfse-order-select" className="form-label">
                Ordem de Serviço (OS) *
              </label>
              <select
                id="nfse-order-select"
                className="form-input"
                value={orderId}
                onChange={(e) => onOrderIdChange(e.target.value)}
                required
              >
                <option value="">Selecione uma ordem de serviço...</option>
                {serviceOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    OS #{order.code} -{" "}
                    {order.customer?.legalName || "Cliente"} -{" "}
                    {order.eventLocation} (
                    {formatCurrency(Number(order.contractedAmount || 0))})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="nfse-desc-input" className="form-label">
                Discriminação dos Serviços Prestados
              </label>
              <textarea
                id="nfse-desc-input"
                className="form-input"
                rows={3}
                placeholder="Deixe em branco para preenchimento automático com dados da OS, ART e Blaster responsável."
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="action-button secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="action-button primary"
              disabled={submitting}
            >
              {submitting
                ? "Emitindo nota na Prefeitura..."
                : "Emitir NFS-e"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
