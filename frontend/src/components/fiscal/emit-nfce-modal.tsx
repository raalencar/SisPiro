"use client";

import type { FormEvent } from "react";
import type { Sale } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface EmitNfceModalProps {
  isOpen: boolean;
  sales: Sale[];
  saleId: string;
  submitting: boolean;
  error: string | null;
  onSaleIdChange: (id: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function EmitNfceModal({
  isOpen,
  sales,
  saleId,
  submitting,
  error,
  onSaleIdChange,
  onClose,
  onSubmit,
}: EmitNfceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        id="nfce-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nfce-modal-title"
      >
        <div className="modal-header">
          <h2 id="nfce-modal-title">
            Emitir NFC-e (Modelo 65 - Venda Balcão)
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
              <label htmlFor="nfce-sale-select" className="form-label">
                Venda de Balcão *
              </label>
              <select
                id="nfce-sale-select"
                className="form-input"
                value={saleId}
                onChange={(e) => onSaleIdChange(e.target.value)}
                required
              >
                <option value="">Selecione uma venda...</option>
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    Venda {sale.id.slice(0, 8)} -{" "}
                    {formatCurrency(Number(sale.total))}
                  </option>
                ))}
              </select>
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
                ? "Emitindo cupom fiscal..."
                : "Emitir NFC-e"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
