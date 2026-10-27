"use client";

import type { FormEvent } from "react";
import type { SalesQuote } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface ConvertQuoteModalProps {
  quote: SalesQuote | null;
  onClose: () => void;
  destination: "SALE" | "ORDER";
  onDestinationChange: (dest: "SALE" | "ORDER") => void;
  eventLocation: string;
  onEventLocationChange: (loc: string) => void;
  eventAt: string;
  onEventAtChange: (at: string) => void;
  condition: "IMEDIATO" | "PRAZO";
  onConditionChange: (cond: "IMEDIATO" | "PRAZO") => void;
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function ConvertQuoteModal({
  quote,
  onClose,
  destination,
  onDestinationChange,
  eventLocation,
  onEventLocationChange,
  eventAt,
  onEventAtChange,
  condition,
  onConditionChange,
  paymentMethod,
  onPaymentMethodChange,
  dueDate,
  onDueDateChange,
  submitting,
  error,
  onSubmit,
}: ConvertQuoteModalProps) {
  useEscapeToClose(Boolean(quote), onClose);
  useModalFocusTrap(Boolean(quote));

  if (!quote) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-md w-full space-y-4">
        <h2 className="text-xl font-bold">Converter Orçamento</h2>
        <p className="text-xs text-neutral-400">
          Valor Total: <strong>{formatCurrency(Number(quote.total))}</strong> · Cliente: <strong>{quote.customer?.legalName || "Não informado"}</strong>
        </p>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <label className="field">
            <span>Destino da Conversão *</span>
            <select
              value={destination}
              onChange={(e) => onDestinationChange(e.target.value as "SALE" | "ORDER")}
              className="input font-semibold text-primary-400"
            >
              <option value="SALE">🛍️ Venda Direta / Balcão (Baixa imediata de estoque)</option>
              <option value="ORDER" disabled={!quote.customerId}>
                🎆 Ordem de Serviço (Espetáculo Pirotécnico & Blaster)
              </option>
            </select>
            {!quote.customerId && (
              <span className="text-[11px] text-amber-400 block mt-1">
                * Orçamentos sem cliente cadastrado só podem ser convertidos em Venda Balcão.
              </span>
            )}
          </label>

          {destination === "ORDER" ? (
            <>
              <label className="field">
                <span>Local da Queima / Evento *</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Arena Municipal, Clube de Campo, Fazenda Santa Fé"
                  value={eventLocation}
                  onChange={(e) => onEventLocationChange(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Data e Hora do Evento *</span>
                <input
                  type="datetime-local"
                  required
                  value={eventAt}
                  onChange={(e) => onEventAtChange(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Condição de Pagamento *</span>
                <select
                  value={condition}
                  onChange={(e) => onConditionChange(e.target.value as "IMEDIATO" | "PRAZO")}
                  className="input"
                >
                  <option value="IMEDIATO">Imediato (À vista)</option>
                  <option value="PRAZO">A Prazo</option>
                </select>
              </label>

              {condition === "IMEDIATO" ? (
                <label className="field">
                  <span>Método de Pagamento *</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => onPaymentMethodChange(e.target.value)}
                    className="input"
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span>Data de Vencimento *</span>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => onDueDateChange(e.target.value)}
                  />
                </label>
              )}
            </>
          )}

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
              {submitting
                ? "Convertendo..."
                : destination === "ORDER"
                  ? "Gerar Ordem de Serviço"
                  : "Confirmar Venda e Baixar Estoque"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
