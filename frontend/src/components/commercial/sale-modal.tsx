"use client";

import type { FormEvent } from "react";
import type { OperationalCustomer, OperationalLot, PricingList, Product } from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface SaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  onCustomerIdChange: (id: string) => void;
  pricingListId: string;
  onPricingListIdChange: (id: string) => void;
  condition: "IMEDIATO" | "PRAZO";
  onConditionChange: (cond: "IMEDIATO" | "PRAZO") => void;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  items: Array<{ productId: string; productLotId: string; quantity: number }>;
  onItemsChange: React.Dispatch<
    React.SetStateAction<
      Array<{ productId: string; productLotId: string; quantity: number }>
    >
  >;
  customers: OperationalCustomer[];
  pricingLists: PricingList[];
  products: Product[];
  lots: OperationalLot[];
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function SaleModal({
  isOpen,
  onClose,
  customerId,
  onCustomerIdChange,
  pricingListId,
  onPricingListIdChange,
  condition,
  onConditionChange,
  paymentMethod,
  onPaymentMethodChange,
  dueDate,
  onDueDateChange,
  items,
  onItemsChange,
  customers,
  pricingLists,
  products,
  lots,
  submitting,
  error,
  onSubmit,
}: SaleModalProps) {
  useEscapeToClose(isOpen, onClose);
  useModalFocusTrap(isOpen);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-xl font-bold">Checkout de Venda (PDV)</h2>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <label className="field">
            <span>Cliente (obrigatório para PCE ou vendas a prazo)</span>
            <select
              value={customerId}
              onChange={(e) => onCustomerIdChange(e.target.value)}
              className="input"
            >
              <option value="">Venda de balcão sem identificação</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legalName}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tabela de Preço *</span>
            <select
              required
              value={pricingListId}
              onChange={(e) => onPricingListIdChange(e.target.value)}
              className="input"
            >
              {pricingLists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Condição</span>
              <select
                value={condition}
                onChange={(e) => onConditionChange(e.target.value as "IMEDIATO" | "PRAZO")}
                className="input"
              >
                <option value="IMEDIATO">À vista</option>
                <option value="PRAZO">A Prazo</option>
              </select>
            </label>
            {condition === "IMEDIATO" ? (
              <label className="field">
                <span>Método de Pagamento</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => onPaymentMethodChange(e.target.value)}
                  className="input"
                >
                  <option value="PIX">PIX</option>
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="CARTAO_DEBITO">Débito</option>
                  <option value="CARTAO_CREDITO">Crédito</option>
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Vencimento</span>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-200">
            <span className="text-sm font-semibold text-neutral-900 block">Produtos e Lotes:</span>
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg items-center text-xs text-neutral-900"
              >
                <div className="col-span-5">
                  <select
                    aria-label="Produto"
                    value={item.productId}
                    onChange={(e) => {
                      const val = e.target.value;
                      onItemsChange((prev) =>
                        prev.map((it, idx) =>
                          idx === index ? { ...it, productId: val } : it,
                        ),
                      );
                    }}
                    className="input text-xs w-full"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <select
                    aria-label="Lote"
                    value={item.productLotId}
                    onChange={(e) => {
                      const val = e.target.value;
                      onItemsChange((prev) =>
                        prev.map((it, idx) =>
                          idx === index ? { ...it, productLotId: val } : it,
                        ),
                      );
                    }}
                    className="input text-xs w-full"
                  >
                    {lots
                      .filter((l) => l.product.id === item.productId || !item.productId)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lotNumber} ({l.quantity} disp.)
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    aria-label="Quantidade"
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
                <div className="col-span-1 text-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onItemsChange((prev) => prev.filter((_, idx) => idx !== index))
                      }
                      className="text-rose-400 font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
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
              {submitting ? "Finalizando..." : "Concluir Venda"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
