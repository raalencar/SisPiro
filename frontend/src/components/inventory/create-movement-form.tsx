"use client";

import type { Magazine, ProductLot } from "@/lib/api";

interface CreateMovementFormProps {
  lots: ProductLot[];
  destinationMagazines: Magazine[];
  selectedLot: ProductLot | undefined;
  selectedLotId: string;
  movementType: string;
  movementQuantity: string;
  onLotChange: (lotId: string) => void;
  onMovementTypeChange: (type: string) => void;
  onQuantityChange: (qty: string) => void;
}

export function CreateMovementForm({
  lots,
  destinationMagazines,
  selectedLot,
  selectedLotId,
  movementType,
  movementQuantity,
  onLotChange,
  onMovementTypeChange,
  onQuantityChange,
}: CreateMovementFormProps) {
  if (lots.length === 0) {
    return (
      <p className="form-hint">Cadastre e receba um lote antes de movimentar o estoque.</p>
    );
  }

  return (
    <>
      <label className="field">
        <span>Lote</span>
        <select
          name="productLotId"
          required
          value={selectedLotId}
          onChange={(event) => {
            const lotId = event.target.value;
            onLotChange(lotId);
            if (movementType === "TRANSFERENCIA") {
              onQuantityChange(lots.find((lot) => lot.id === lotId)?.quantity ?? "");
            }
          }}
        >
          <option value="" disabled>Selecione</option>
          {lots.map((lot) => (
            <option value={lot.id} key={lot.id}>
              {lot.lotNumber} · {lot.product.name} · saldo {lot.quantity} {lot.product.unit}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Tipo de movimentação</span>
          <select
            name="type"
            value={movementType}
            onChange={(event) => {
              const val = event.target.value;
              onMovementTypeChange(val);
              if (val === "TRANSFERENCIA") {
                onQuantityChange(selectedLot?.quantity ?? "");
              } else {
                onQuantityChange("");
              }
            }}
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="AJUSTE">Ajuste</option>
          </select>
        </label>
        <label className="field">
          <span>
            {movementType === "AJUSTE"
              ? "Ajuste de quantidade (+ ou -)"
              : movementType === "TRANSFERENCIA"
                ? "Saldo integral a transferir"
                : "Quantidade"}
          </span>
          <input
            name="quantity"
            type="number"
            min={movementType === "AJUSTE" ? "-99999999.99" : "0.01"}
            max="99999999.99"
            step="0.01"
            value={
              movementType === "TRANSFERENCIA"
                ? selectedLot?.quantity ?? ""
                : movementQuantity
            }
            onChange={(event) => onQuantityChange(event.target.value)}
            readOnly={movementType === "TRANSFERENCIA"}
            required
          />
        </label>
      </div>
      {movementType === "TRANSFERENCIA" && (
        <label className="field">
          <span>Paiol de destino</span>
          <select name="destinationMagazineId" required defaultValue="">
            <option value="" disabled>Selecione</option>
            {destinationMagazines.map((magazine) => (
              <option value={magazine.id} key={magazine.id}>
                {magazine.name} · {magazine.remainingNeqKg} kg NEQ livres
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>Referência (opcional)</span>
        <input name="reference" maxLength={100} />
      </label>
      <p className="form-hint">
        Ajustes e transferências preservam o histórico. Saídas e
        transferências podem ser bloqueadas por reservas, validade
        ou capacidade do destino.
      </p>
    </>
  );
}
