"use client";

import type { FormEvent } from "react";
import type { Customer, FinancialDirection } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface NewEntryModalProps {
  isOpen: boolean;
  direction: FinancialDirection;
  category: string;
  counterpart: string;
  amount: number;
  dueDate: string;
  customerId: string;
  isInstallment: boolean;
  installmentsCount: number;
  intervalDays: number;
  submitting: boolean;
  error: string | null;
  customers: Customer[];
  onDirectionChange: (val: FinancialDirection) => void;
  onCategoryChange: (val: string) => void;
  onCounterpartChange: (val: string) => void;
  onAmountChange: (val: number) => void;
  onDueDateChange: (val: string) => void;
  onCustomerIdChange: (val: string) => void;
  onIsInstallmentChange: (val: boolean) => void;
  onInstallmentsCountChange: (val: number) => void;
  onIntervalDaysChange: (val: number) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function NewEntryModal({
  isOpen,
  direction,
  category,
  counterpart,
  amount,
  dueDate,
  customerId,
  isInstallment,
  installmentsCount,
  intervalDays,
  submitting,
  error,
  customers,
  onDirectionChange,
  onCategoryChange,
  onCounterpartChange,
  onAmountChange,
  onDueDateChange,
  onCustomerIdChange,
  onIsInstallmentChange,
  onInstallmentsCountChange,
  onIntervalDaysChange,
  onClose,
  onSubmit,
}: NewEntryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-lg w-full space-y-4">
        <h2 className="text-xl font-bold">Novo Lançamento Financeiro</h2>
        <form className="form-stack space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Direção *</span>
              <select
                value={direction}
                onChange={(e) => onDirectionChange(e.target.value as FinancialDirection)}
              >
                <option value="PAGAR">Conta a Pagar (Saída)</option>
                <option value="RECEBER">Conta a Receber (Entrada)</option>
              </select>
            </label>
            <label className="field">
              <span>Categoria *</span>
              <input
                type="text"
                required
                placeholder="Ex: ENERGIA, ALUGUEL, FRETE"
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Contraparte (Favorecido ou Pagador) *</span>
            <input
              type="text"
              required
              placeholder="Ex: Distribuidora de Energia S.A."
              value={counterpart}
              onChange={(e) => onCounterpartChange(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span>Valor (R$) *</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount || ""}
                onChange={(e) => onAmountChange(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>Data de Vencimento *</span>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
              />
            </label>
          </div>

          {direction === "RECEBER" && customers.length > 0 && (
            <label className="field">
              <span>Cliente Vinculado (Opcional)</span>
              <select
                value={customerId}
                onChange={(e) => onCustomerIdChange(e.target.value)}
              >
                <option value="">Nenhum / Não vinculado</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legalName} ({c.taxId})
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Opções de Parcelamento */}
          <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-800">
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={(e) => onIsInstallmentChange(e.target.checked)}
                className="rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Parcelar este lançamento (gerar múltiplos títulos)</span>
            </label>

            {isInstallment && (
              <div className="space-y-3 pt-2.5 border-t border-neutral-200">
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Quantidade de Parcelas *</span>
                    <input
                      type="number"
                      min="2"
                      max="60"
                      required
                      value={installmentsCount}
                      onChange={(e) =>
                        onInstallmentsCountChange(Math.max(2, Math.min(60, Number(e.target.value) || 2)))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Intervalo (dias) *</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      required
                      value={intervalDays}
                      onChange={(e) =>
                        onIntervalDaysChange(Math.max(1, Math.min(365, Number(e.target.value) || 30)))
                      }
                    />
                  </label>
                </div>

                {amount > 0 && (
                  <p className="text-xs text-neutral-600">
                    Serão gerados <span className="font-semibold text-neutral-900">{installmentsCount}</span> títulos de aproximadamente{" "}
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(amount / installmentsCount)}
                    </span>{" "}
                    a cada <span className="font-semibold text-neutral-900">{intervalDays} dias</span>.
                  </p>
                )}
              </div>
            )}
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
              {submitting ? "Cadastrando..." : "Cadastrar Título"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
