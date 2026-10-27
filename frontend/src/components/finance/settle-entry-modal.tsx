"use client";

import type { FormEvent } from "react";
import type { FinancialEntry } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface SettleEntryModalProps {
  entry: FinancialEntry | null;
  amount: number;
  method: string;
  date: string;
  notes: string;
  submitting: boolean;
  error: string | null;
  onAmountChange: (val: number) => void;
  onMethodChange: (val: string) => void;
  onDateChange: (val: string) => void;
  onNotesChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function SettleEntryModal({
  entry,
  amount,
  method,
  date,
  notes,
  submitting,
  error,
  onAmountChange,
  onMethodChange,
  onDateChange,
  onNotesChange,
  onClose,
  onSubmit,
}: SettleEntryModalProps) {
  if (!entry) return null;

  const isPayable = entry.direction === "PAGAR";

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-lg w-full space-y-4">
        <h2 className="text-xl font-bold">
          {isPayable ? "Registrar Pagamento" : "Registrar Recebimento"}
        </h2>
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs space-y-1 text-neutral-900">
          <div>
            <span className="text-neutral-500">Título:</span>{" "}
            <span className="font-semibold text-neutral-900">{entry.counterpart || entry.counterparty}</span>
          </div>
          <div>
            <span className="text-neutral-500">Saldo Restante:</span>{" "}
            <span className="font-mono font-bold text-amber-700">
              {formatCurrency(Number(entry.outstanding))}
            </span>
          </div>
        </div>

        <form className="form-stack space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Valor do Pagamento (R$) *</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={Number(entry.outstanding)}
                required
                value={amount || ""}
                onChange={(e) => onAmountChange(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Forma de Pagamento *</span>
              <select
                value={method}
                onChange={(e) => onMethodChange(e.target.value)}
              >
                <option value="PIX">PIX</option>
                <option value="DINHEIRO">Dinheiro em Espécie</option>
                <option value="BOLETO">Boleto Bancário</option>
                <option value="TRANSFERENCIA">Transferência / TED</option>
                <option value="CARTAO">Cartão de Crédito/Débito</option>
              </select>
            </label>
          </div>

          <label className="field">
            <span>Data do Pagamento *</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Observações / Comprovante (Opcional)</span>
            <input
              type="text"
              placeholder="Ex: Transação bancária autenticada"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </label>

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
              {submitting ? "Processando..." : "Confirmar Baixa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
