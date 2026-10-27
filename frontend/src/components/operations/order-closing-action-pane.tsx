"use client";

import type { FormEvent } from "react";
import type { ServiceOrder } from "@/lib/api";
import { formatNumber } from "@/lib/format";

interface OrderClosingActionPaneProps {
  selected: ServiceOrder;
  dueDate: string;
  onDueDateChange: (date: string) => void;
  reportNotes: string;
  onReportNotesChange: (notes: string) => void;
  firedQuantities: Record<string, string>;
  onFiredQuantitiesChange: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  onSubmitTransition: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

export function OrderClosingActionPane({
  selected,
  dueDate,
  onDueDateChange,
  reportNotes,
  onReportNotesChange,
  firedQuantities,
  onFiredQuantitiesChange,
  onSubmitTransition,
  onClose,
  submitting,
}: OrderClosingActionPaneProps) {
  return (
    <form
      className="operations-form"
      onSubmit={(event) => void onSubmitTransition(event)}
    >
      <p>
        Informe a quantidade efetivamente disparada. O backend baixa o consumo
        real, libera sobras e cria uma conta a receber pelo valor contratado.
      </p>
      <div className="operations-form__grid">
        <label>
          Vencimento da conta a receber
          <input
            type="date"
            required
            value={dueDate}
            onChange={(event) => onDueDateChange(event.target.value)}
          />
        </label>
        <label className="operations-form__wide">
          Notas do relatório
          <textarea
            maxLength={2000}
            rows={3}
            value={reportNotes}
            onChange={(event) => onReportNotesChange(event.target.value)}
          />
        </label>
      </div>
      <div className="operations-form__section">
        <h3>Quantidades disparadas</h3>
        {selected.items.map((item) => (
          <label className="operations-close-item" key={item.id}>
            <span>
              <strong>{item.product.name}</strong>
              <small>
                Planejado: {formatNumber(Number(item.plannedQuantity))}{" "}
                {item.product.unit}
              </small>
            </span>
            <span>
              {item.product.unit}
              <input
                type="number"
                min="0"
                max={item.plannedQuantity}
                step="0.01"
                required
                value={firedQuantities[item.id] ?? item.plannedQuantity}
                onChange={(event) =>
                  onFiredQuantitiesChange((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
              />
            </span>
          </label>
        ))}
      </div>
      <div className="operations-form__footer">
        <button className="button button--quiet" type="button" onClick={onClose}>
          Fechar
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Concluindo..." : "Concluir e registrar consumo"}
        </button>
      </div>
    </form>
  );
}
