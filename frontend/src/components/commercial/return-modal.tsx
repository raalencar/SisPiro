"use client";

import type { FormEvent } from "react";
import type { Sale } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface ReturnModalProps {
  sale: Sale | null;
  onClose: () => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  items: Array<{ saleItemId: string; quantity: number }>;
  onItemsChange: React.Dispatch<
    React.SetStateAction<Array<{ saleItemId: string; quantity: number }>>
  >;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function ReturnModal({
  sale,
  onClose,
  reason,
  onReasonChange,
  items,
  onItemsChange,
  submitting,
  error,
  onSubmit,
}: ReturnModalProps) {
  useEscapeToClose(Boolean(sale), onClose);
  useModalFocusTrap(Boolean(sale));

  if (!sale) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-lg w-full space-y-4">
        <h2 className="text-xl font-bold">Registrar Devolução de Mercadorias</h2>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <label className="field">
            <span>Motivo da Devolução *</span>
            <input
              type="text"
              required
              placeholder="Ex: Produto avariado, desistência do cliente"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </label>

          <div className="space-y-2 pt-2 border-t border-neutral-200">
            <span className="text-sm font-semibold text-neutral-900 block">Itens da Venda:</span>
            {items.map((item, index) => {
              const saleItem = sale.items.find((it) => it.id === item.saleItemId);
              return (
                <div
                  key={index}
                  className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between text-xs text-neutral-900"
                >
                  <div>
                    <span className="font-semibold text-neutral-900">{saleItem?.product?.name || "Item"}</span>
                    <div className="text-neutral-500 mt-0.5">
                      Preço unitário: <strong className="text-neutral-700">{formatCurrency(Number(saleItem?.unitPrice || 0))}</strong>
                    </div>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      max={Number(saleItem?.quantity || 1)}
                      aria-label={`Quantidade a devolver de ${saleItem?.product?.name || "item"}`}
                      value={item.quantity}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onItemsChange((prev) =>
                          prev.map((it, idx) =>
                            idx === index ? { ...it, quantity: val } : it,
                          ),
                        );
                      }}
                      className="input text-xs w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="form-error text-xs" role="alert">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? "Registrando..." : "Confirmar Devolução"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
