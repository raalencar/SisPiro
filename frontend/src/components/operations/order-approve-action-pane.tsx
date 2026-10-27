"use client";

import type { FormEvent } from "react";
import type { OperationalBlaster } from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

interface OrderApproveActionPaneProps {
  blasterId: string;
  onBlasterIdChange: (id: string) => void;
  blasters: OperationalBlaster[];
  artNumber: string;
  onArtNumberChange: (art: string) => void;
  onSubmitApprove: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

export function OrderApproveActionPane({
  blasterId,
  onBlasterIdChange,
  blasters,
  artNumber,
  onArtNumberChange,
  onSubmitApprove,
  onClose,
  submitting,
}: OrderApproveActionPaneProps) {
  return (
    <form
      className="operations-form"
      onSubmit={(event) => void onSubmitApprove(event)}
    >
      <p>
        A aprovação verifica elegibilidade do cliente e do blaster e reserva
        os lotes de forma atômica.
      </p>
      <div className="operations-form__grid">
        <label className="operations-form__wide">
          Blaster responsável
          <select
            required
            value={blasterId}
            onChange={(event) => onBlasterIdChange(event.target.value)}
          >
            <option value="">Selecione um blaster ativo</option>
            {blasters
              .filter((blaster) => blaster.active)
              .map((blaster) => (
                <option key={blaster.id} value={blaster.id}>
                  {blaster.name} · licença até{" "}
                  {formatDateOnly(blaster.licenseExpiresAt)}
                </option>
              ))}
          </select>
        </label>
        <label className="operations-form__wide">
          Número da ART (opcional)
          <input
            maxLength={50}
            value={artNumber}
            onChange={(event) => onArtNumberChange(event.target.value)}
          />
        </label>
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
          {submitting ? "Validando..." : "Aprovar e reservar"}
        </button>
      </div>
    </form>
  );
}
