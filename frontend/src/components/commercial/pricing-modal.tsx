"use client";

import type { FormEvent } from "react";
import type { Product } from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (name: string) => void;
  items: Array<{ productId: string; unitPrice: number }>;
  onItemsChange: React.Dispatch<
    React.SetStateAction<Array<{ productId: string; unitPrice: number }>>
  >;
  products: Product[];
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function PricingModal({
  isOpen,
  onClose,
  name,
  onNameChange,
  items,
  onItemsChange,
  products,
  submitting,
  error,
  onSubmit,
}: PricingModalProps) {
  useEscapeToClose(isOpen, onClose);
  useModalFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold">Nova Tabela de Preços</h2>
        <form className="form-stack space-y-4" onSubmit={onSubmit}>
          <label className="field">
            <span>Nome da Tabela *</span>
            <input
              type="text"
              required
              placeholder="Ex: Tabela Varejo 2026, Atacado Revenda"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </label>

          <div className="space-y-2 border-t border-neutral-200 pt-3">
            <span className="text-sm font-semibold text-neutral-900 block">Preços Unitários por Produto:</span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const product = products.find((p) => p.id === item.productId);
                return (
                  <div
                    key={item.productId}
                    className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between text-xs text-neutral-900"
                  >
                    <span className="font-semibold text-neutral-900">{product?.name || "Produto"}</span>
                    <div className="w-32 flex items-center gap-1">
                      <span className="text-neutral-500 font-medium">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Preço de ${product?.name || "produto"}`}
                        value={item.unitPrice}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onItemsChange((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, unitPrice: val } : it)),
                          );
                        }}
                        className="input text-xs w-full text-right"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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
              {submitting ? "Salvando..." : "Salvar Tabela"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
