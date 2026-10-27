"use client";

import type { FormEvent } from "react";
import type { Magazine, Product, Purchase } from "@/lib/api";

export interface ReceiveBatchItem {
  purchaseItemId: string;
  productId: string;
  magazineId: string;
  lotNumber: string;
  quantity: number;
  manufacturedAt: string;
  expiresAt: string;
  manufacturerOrImporter: string;
}

interface ReceiveOrderModalProps {
  purchase: Purchase | null;
  products: Product[];
  magazines: Magazine[];
  dueDate: string;
  invoiceRef: string;
  batches: ReceiveBatchItem[];
  submitting: boolean;
  error: string | null;
  onDueDateChange: (date: string) => void;
  onInvoiceRefChange: (ref: string) => void;
  onUpdateBatch: (index: number, updates: Partial<ReceiveBatchItem>) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ReceiveOrderModal({
  purchase,
  products,
  magazines,
  dueDate,
  invoiceRef,
  batches,
  submitting,
  error,
  onDueDateChange,
  onInvoiceRefChange,
  onUpdateBatch,
  onClose,
  onSubmit,
}: ReceiveOrderModalProps) {
  if (!purchase) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-xl font-bold">Recebimento Físico de Lotes</h2>
        <p className="text-xs text-neutral-400">
          Registrar entrada de mercadorias no estoque e criar automaticamente a respectiva conta a pagar.
        </p>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Vencimento da Conta a Pagar *</span>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Nota Fiscal / Chave de Acesso *</span>
              <input
                type="text"
                required
                placeholder="Ex: NF-e 001.234"
                value={invoiceRef}
                onChange={(e) => onInvoiceRefChange(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-3 pt-2.5 border-t border-neutral-200">
            <span className="text-sm font-semibold text-neutral-900 block">Lotes a Dar Entrada:</span>
            {batches.map((batch, index) => {
              const product = products.find((p) => p.id === batch.productId);
              return (
                <div
                  key={index}
                  className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-2 text-xs text-neutral-900"
                >
                  <div className="font-semibold text-neutral-900">
                    Produto: {product?.name || batch.productId}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="field">
                      <span>Nº do Lote *</span>
                      <input
                        type="text"
                        required
                        value={batch.lotNumber}
                        onChange={(e) => onUpdateBatch(index, { lotNumber: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Quantidade *</span>
                      <input
                        type="number"
                        min="1"
                        required
                        value={batch.quantity}
                        onChange={(e) => onUpdateBatch(index, { quantity: Number(e.target.value) })}
                      />
                    </label>
                    <label className="field">
                      <span>Paiol de Destino *</span>
                      <select
                        value={batch.magazineId}
                        onChange={(e) => onUpdateBatch(index, { magazineId: e.target.value })}
                        className="input"
                      >
                        {magazines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.remainingNeqKg} kg disp.)
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="field">
                      <span>Fabricação *</span>
                      <input
                        type="date"
                        required
                        value={batch.manufacturedAt}
                        onChange={(e) => onUpdateBatch(index, { manufacturedAt: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Validade *</span>
                      <input
                        type="date"
                        required
                        value={batch.expiresAt}
                        onChange={(e) => onUpdateBatch(index, { expiresAt: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Fabricante / Importador *</span>
                      <input
                        type="text"
                        required
                        value={batch.manufacturerOrImporter}
                        onChange={(e) => onUpdateBatch(index, { manufacturerOrImporter: e.target.value })}
                      />
                    </label>
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
            <button
              type="submit"
              className="button button--primary"
              disabled={submitting}
            >
              {submitting ? "Recebendo..." : "Confirmar Recebimento e Gerar Conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
