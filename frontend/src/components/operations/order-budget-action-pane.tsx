"use client";

import type { FormEvent } from "react";
import type {
  OperationalCustomer,
  OperationalLot,
} from "@/lib/api";
import { formatDateOnly, formatNumber } from "@/lib/format";
import {
  isUsableLot,
  localDateTime,
  type OrderAction,
  type OrderDraftItem,
} from "./types";

interface OrderBudgetActionPaneProps {
  action: OrderAction;
  customerId: string;
  onCustomerIdChange: (id: string) => void;
  selectedCustomer?: OperationalCustomer;
  customers: OperationalCustomer[];
  contractedAmount: string;
  onContractedAmountChange: (amount: string) => void;
  eventAt: string;
  onEventAtChange: (at: string) => void;
  eventLocation: string;
  onEventLocationChange: (loc: string) => void;
  draftItems: OrderDraftItem[];
  onDraftItemsChange: React.Dispatch<React.SetStateAction<OrderDraftItem[]>>;
  lots: OperationalLot[];
  selectedLotIds: string[];
  onSubmitCreate: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitEdit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
  referencesLoading: boolean;
}

export function OrderBudgetActionPane({
  action,
  customerId,
  onCustomerIdChange,
  selectedCustomer,
  customers,
  contractedAmount,
  onContractedAmountChange,
  eventAt,
  onEventAtChange,
  eventLocation,
  onEventLocationChange,
  draftItems,
  onDraftItemsChange,
  lots,
  selectedLotIds,
  onSubmitCreate,
  onSubmitEdit,
  onClose,
  submitting,
  referencesLoading,
}: OrderBudgetActionPaneProps) {
  return (
    <form
      className="operations-form"
      onSubmit={(event) =>
        void (action === "edit"
          ? onSubmitEdit(event)
          : onSubmitCreate(event))
      }
    >
      <div className="operations-form__grid">
        <label className="operations-form__wide">
          Cliente
          <select
            required
            value={customerId}
            onChange={(event) => onCustomerIdChange(event.target.value)}
          >
            <option value="">Selecione um cliente ativo</option>
            {customers
              .filter((customer) => customer.active)
              .map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.legalName}
                  {customer.hasCr ? " · CR cadastrado" : " · sem CR"}
                </option>
              ))}
          </select>
        </label>
        {selectedCustomer && (
          <p className="operations-form__wide operations-form__hint">
            {selectedCustomer.hasCr
              ? `CR cadastrado${
                  selectedCustomer.crExpiresAt
                    ? ` · válido até ${formatDateOnly(
                        selectedCustomer.crExpiresAt,
                      )}`
                    : ""
                }. Classes autorizadas: ${
                  selectedCustomer.authorizedPceClasses.join(", ") ||
                  "não informadas"
                }.`
              : "Cliente sem CR cadastrado; o backend validará a elegibilidade antes de reservar itens PCE."}
          </p>
        )}
        <label>
          Valor contratado (R$)
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={contractedAmount}
            onChange={(event) => onContractedAmountChange(event.target.value)}
          />
        </label>
        <label>
          Data e hora do evento
          <input
            type="datetime-local"
            required
            min={localDateTime(0)}
            value={eventAt}
            onChange={(event) => onEventAtChange(event.target.value)}
          />
        </label>
        <label className="operations-form__wide">
          Local do evento
          <input
            maxLength={500}
            required
            value={eventLocation}
            onChange={(event) => onEventLocationChange(event.target.value)}
          />
        </label>
      </div>
      <div className="operations-form__section">
        <div className="operations-toolbar">
          <h3>Produtos e lotes</h3>
          <button
            className="button button--quiet"
            type="button"
            onClick={() =>
              onDraftItemsChange((current) => [
                ...current,
                { lotId: "", quantity: "" },
              ])
            }
          >
            Adicionar item
          </button>
        </div>
        {draftItems.map((item, index) => {
          const lot = lots.find((entry) => entry.id === item.lotId);
          return (
            <div className="operations-item-form" key={`draft-${index}`}>
              <label>
                Lote
                <select
                  required
                  value={item.lotId}
                  onChange={(event) =>
                    onDraftItemsChange((current) =>
                      current.map((line, row) =>
                        row === index
                          ? { ...line, lotId: event.target.value }
                          : line,
                      ),
                    )
                  }
                >
                  <option value="">Selecione um lote</option>
                  {lots
                    .filter(
                      (candidate) =>
                        isUsableLot(candidate) &&
                        (candidate.id === item.lotId ||
                          !selectedLotIds.includes(candidate.id)),
                    )
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.product.name} · {candidate.lotNumber} ·{" "}
                        {candidate.magazine.name} · físico{" "}
                        {formatNumber(Number(candidate.quantity))}{" "}
                        {candidate.product.unit}
                      </option>
                    ))}
                </select>
                {lot && (
                  <small>
                    Quantidade física do lote. A aprovação validará o saldo
                    realmente reservável e a validade.
                  </small>
                )}
              </label>
              <label>
                Quantidade planejada
                <input
                  type="number"
                  min="0.01"
                  max={lot?.quantity}
                  step="0.01"
                  required
                  value={item.quantity}
                  onChange={(event) =>
                    onDraftItemsChange((current) =>
                      current.map((line, row) =>
                        row === index
                          ? { ...line, quantity: event.target.value }
                          : line,
                      ),
                    )
                  }
                />
              </label>
              {draftItems.length > 1 && (
                <button
                  className="button button--quiet"
                  type="button"
                  aria-label={`Remover item ${index + 1}`}
                  onClick={() =>
                    onDraftItemsChange((current) =>
                      current.filter((_, row) => row !== index),
                    )
                  }
                >
                  Remover
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="operations-form__footer">
        <button className="button button--quiet" type="button" onClick={onClose}>
          Fechar
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting || referencesLoading}
        >
          {submitting
            ? "Salvando..."
            : action === "edit"
              ? "Salvar alterações"
              : "Criar orçamento"}
        </button>
      </div>
    </form>
  );
}
