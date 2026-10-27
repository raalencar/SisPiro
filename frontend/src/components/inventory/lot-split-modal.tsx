"use client";

import type { FormEvent } from "react";
import type { Magazine, ProductLot } from "@/lib/api";
import { formatNumber } from "@/lib/format";

interface LotSplitModalProps {
  lot: ProductLot | null;
  magazines: Magazine[];
  splitMagazineId: string;
  splitNewLotNumber: string;
  splitQuantity: string;
  splitSubmitting: boolean;
  splitError: string | null;
  onSplitMagazineIdChange: (id: string) => void;
  onSplitNewLotNumberChange: (lotNum: string) => void;
  onSplitQuantityChange: (qty: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function LotSplitModal({
  lot,
  magazines,
  splitMagazineId,
  splitNewLotNumber,
  splitQuantity,
  splitSubmitting,
  splitError,
  onSplitMagazineIdChange,
  onSplitNewLotNumberChange,
  onSplitQuantityChange,
  onClose,
  onSubmit,
}: LotSplitModalProps) {
  if (!lot) return null;

  return (
    <div
      className="form-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !splitSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className="inventory-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lot-split-dialog-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Movimentação WMS</p>
            <h2 id="lot-split-dialog-title">
              Desmembrar Lote: {lot.lotNumber}
            </h2>
          </div>
          <button
            className="button button--quiet"
            type="button"
            disabled={splitSubmitting}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <form className="form-stack inventory-form" onSubmit={onSubmit}>
          {splitError && (
            <p className="form-error" role="alert">
              {splitError}
            </p>
          )}
          <div style={{ padding: "0.5rem 0", fontSize: "0.9rem" }}>
            <span>Saldo atual do lote de origem: </span>
            <strong>
              {formatNumber(Number(lot.quantity))} {lot.product.unit}
            </strong>
            <span> · Paiol atual: </span>
            <strong>{lot.magazine.name}</strong>
          </div>

          <label className="field">
            <span>Paiol de Destino do Novo Lote</span>
            <select
              value={splitMagazineId}
              onChange={(e) => onSplitMagazineIdChange(e.target.value)}
              required
            >
              <option value="">Selecione o paiol de destino...</option>
              {magazines
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Capacidade disp.:{" "}
                    {formatNumber(Number(m.remainingNeqKg))} kg NEQ)
                  </option>
                ))}
            </select>
          </label>

          <label className="field">
            <span>Identificador do Novo Lote Filho</span>
            <input
              type="text"
              maxLength={50}
              value={splitNewLotNumber}
              onChange={(e) => onSplitNewLotNumberChange(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Quantidade a Desmembrar ({lot.product.unit})</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={Number(lot.quantity) - 0.01}
              value={splitQuantity}
              onChange={(e) => onSplitQuantityChange(e.target.value)}
              placeholder={`Menor que ${lot.quantity}`}
              required
            />
          </label>

          <div className="form-actions">
            <button
              className="button button--quiet"
              type="button"
              disabled={splitSubmitting}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={splitSubmitting}
            >
              {splitSubmitting ? "Desmembrando..." : "Confirmar Desmembramento"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
