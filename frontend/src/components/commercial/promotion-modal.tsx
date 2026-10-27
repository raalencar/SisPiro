"use client";

import type { FormEvent } from "react";
import type { Product, PromotionDiscountType } from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface PromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (name: string) => void;
  startsAt: string;
  onStartsAtChange: (date: string) => void;
  endsAt: string;
  onEndsAtChange: (date: string) => void;
  items: Array<{
    productId: string;
    discountType: PromotionDiscountType;
    promotionalPrice?: number;
    discountPercent?: number;
  }>;
  onItemsChange: React.Dispatch<
    React.SetStateAction<
      Array<{
        productId: string;
        discountType: PromotionDiscountType;
        promotionalPrice?: number;
        discountPercent?: number;
      }>
    >
  >;
  products: Product[];
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function PromotionModal({
  isOpen,
  onClose,
  name,
  onNameChange,
  startsAt,
  onStartsAtChange,
  endsAt,
  onEndsAtChange,
  items,
  onItemsChange,
  products,
  submitting,
  error,
  onSubmit,
}: PromotionModalProps) {
  useEscapeToClose(isOpen, onClose);
  useModalFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold">Nova Campanha Promocional</h2>
        <form className="form-stack space-y-4" onSubmit={onSubmit}>
          <label className="field">
            <span>Nome da Campanha *</span>
            <input
              type="text"
              required
              placeholder="Ex: Black Friday Pirotécnica, Junina 2026"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Data Início *</span>
              <input
                type="date"
                required
                value={startsAt}
                onChange={(e) => onStartsAtChange(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Data Fim *</span>
              <input
                type="date"
                required
                value={endsAt}
                onChange={(e) => onEndsAtChange(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-2 border-t border-neutral-200 pt-3">
            <span className="text-sm font-semibold text-neutral-900 block">Descontos por Produto:</span>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {items.map((item, idx) => {
                const product = products.find((p) => p.id === item.productId);
                return (
                  <div
                    key={item.productId}
                    className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg flex items-center justify-between gap-2 text-xs text-neutral-900"
                  >
                    <span className="font-semibold truncate max-w-[140px]">{product?.name || "Produto"}</span>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Tipo de desconto de ${product?.name || "produto"}`}
                        value={item.discountType}
                        onChange={(e) => {
                          const t = e.target.value as PromotionDiscountType;
                          onItemsChange((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, discountType: t } : it)),
                          );
                        }}
                        className="input text-xs py-1"
                      >
                        <option value="PERCENTUAL">Percentual (%)</option>
                        <option value="VALOR_FIXO">Valor Fixo (R$)</option>
                      </select>
                      <input
                        type="number"
                        step={item.discountType === "PERCENTUAL" ? "1" : "0.01"}
                        min="0"
                        max={item.discountType === "PERCENTUAL" ? "100" : undefined}
                        aria-label={`Valor do desconto de ${product?.name || "produto"}`}
                        value={item.discountType === "PERCENTUAL" ? (item.discountPercent ?? 0) : (item.promotionalPrice ?? 0)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onItemsChange((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? item.discountType === "PERCENTUAL"
                                  ? { ...it, discountPercent: val, promotionalPrice: undefined }
                                  : { ...it, promotionalPrice: val, discountPercent: undefined }
                                : it,
                            ),
                          );
                        }}
                        className="input text-xs w-20 text-right"
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
              {submitting ? "Salvando..." : "Criar Campanha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
