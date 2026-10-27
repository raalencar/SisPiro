"use client";

import type { FormEvent } from "react";
import type { Sale } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface EmitNfeModalProps {
  isOpen: boolean;
  sales: Sale[];
  saleId: string;
  nature: string;
  notes: string;
  submitting: boolean;
  error: string | null;
  onSaleIdChange: (id: string) => void;
  onNatureChange: (val: string) => void;
  onNotesChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function EmitNfeModal({
  isOpen,
  sales,
  saleId,
  nature,
  notes,
  submitting,
  error,
  onSaleIdChange,
  onNatureChange,
  onNotesChange,
  onClose,
  onSubmit,
}: EmitNfeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        className="modal-content"
        id="nfe-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nfe-modal-title"
      >
        <div className="modal-header">
          <h2 id="nfe-modal-title">Emitir NF-e (Modelo 55 - Mercadorias)</h2>
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
              <label htmlFor="nfe-sale-select" className="form-label">
                Venda a Faturar *
              </label>
              <select
                id="nfe-sale-select"
                className="form-input"
                value={saleId}
                onChange={(e) => onSaleIdChange(e.target.value)}
                required
              >
                <option value="">Selecione uma venda...</option>
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    Venda {sale.id.slice(0, 8)} -{" "}
                    {sale.customer?.legalName || "Cliente não cadastrado"} -{" "}
                    {formatCurrency(Number(sale.total))}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="nfe-nature-input" className="form-label">
                Natureza da Operação *
              </label>
              <input
                id="nfe-nature-input"
                type="text"
                className="form-input"
                value={nature}
                onChange={(e) => onNatureChange(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="nfe-notes-input" className="form-label">
                Informações Complementares de Interesse do Contribuinte
              </label>
              <textarea
                id="nfe-notes-input"
                className="form-input"
                rows={3}
                placeholder="Ex: Produtos controlados pelo Exército Brasileiro. Venda sujeita à apresentação de CR."
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
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
              {submitting ? "Autorizando na SEFAZ..." : "Autorizar NF-e"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
