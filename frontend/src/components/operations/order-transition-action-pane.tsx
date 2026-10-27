"use client";

import type { FormEvent } from "react";
import type { OrderAction } from "./types";

interface OrderTransitionActionPaneProps {
  action: OrderAction;
  onSubmitTransition: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

export function OrderTransitionActionPane({
  action,
  onSubmitTransition,
  onClose,
  submitting,
}: OrderTransitionActionPaneProps) {
  return (
    <form
      className="operations-form"
      onSubmit={(event) => void onSubmitTransition(event)}
    >
      <p>
        {action === "start"
          ? "A OS passará para montagem e manterá a reserva de estoque."
          : "A ordem será cancelada e, se houver reserva, o estoque será liberado."}
      </p>
      <div className="operations-form__footer">
        <button className="button button--quiet" type="button" onClick={onClose}>
          Voltar
        </button>
        <button
          className={
            action === "cancel"
              ? "button button--danger"
              : "button button--primary"
          }
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Processando..."
            : action === "start"
              ? "Confirmar início"
              : "Confirmar cancelamento"}
        </button>
      </div>
    </form>
  );
}
