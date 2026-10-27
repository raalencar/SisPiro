"use client";

import type { FormEvent } from "react";
import type { PageResult, Product, Supplier } from "@/lib/api";

interface OrderItemState {
  productId: string;
  quantity: number;
  unitCost: number;
}

interface CreateOrderModalProps {
  isOpen: boolean;
  suppliers: PageResult<Supplier> | null;
  products: Product[];
  selectedSupplierId: string;
  orderNotes: string;
  orderItems: OrderItemState[];
  submitting: boolean;
  error: string | null;
  onSupplierChange: (id: string) => void;
  onNotesChange: (notes: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, updates: Partial<OrderItemState>) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function CreateOrderModal({
  isOpen,
  suppliers,
  products,
  selectedSupplierId,
  orderNotes,
  orderItems,
  submitting,
  error,
  onSupplierChange,
  onNotesChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onClose,
  onSubmit,
}: CreateOrderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-xl font-bold">Novo Pedido de Compra</h2>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <label className="field">
            <span>Fornecedor *</span>
            <select
              required
              value={selectedSupplierId}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="input"
            >
              {suppliers?.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.legalName} ({s.taxId})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Observações / Instruções</span>
            <input
              type="text"
              value={orderNotes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </label>

          <div className="space-y-2 pt-2 border-t border-neutral-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-neutral-900">Itens do Pedido:</span>
              <button
                type="button"
                className="button button--ghost text-xs py-1 px-2"
                onClick={onAddItem}
              >
                + Adicionar item
              </button>
            </div>

            {orderItems.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg items-center text-neutral-900"
              >
                <div className="col-span-6">
                  <select
                    aria-label="Produto"
                    value={item.productId}
                    onChange={(e) => onUpdateItem(index, { productId: e.target.value })}
                    className="input text-xs w-full"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    aria-label="Quantidade"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(index, { quantity: Number(e.target.value) })}
                    className="input text-xs w-full"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Custo"
                    aria-label="Custo unitário"
                    value={item.unitCost}
                    onChange={(e) => onUpdateItem(index, { unitCost: Number(e.target.value) })}
                    className="input text-xs w-full"
                  />
                </div>
                <div className="col-span-1 text-center">
                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="text-rose-400 hover:text-rose-300 font-bold"
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
            <button
              type="submit"
              className="button button--primary"
              disabled={submitting}
            >
              {submitting ? "Emitindo..." : "Emitir Pedido"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
