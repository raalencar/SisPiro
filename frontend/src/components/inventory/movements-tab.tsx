"use client";

import type { StockMovement } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EmptyTable, movementLabels } from "./types";

interface MovementsTabProps {
  movements: StockMovement[];
}

export function MovementsTab({ movements }: MovementsTabProps) {
  if (movements.length === 0) {
    return <EmptyTable message="Nenhuma movimentação corresponde à busca." />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Lote / produto</th>
            <th>Quantidade</th>
            <th>Origem / destino</th>
            <th>Referência</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id}>
              <td>{formatDateTime(movement.occurredAt)}</td>
              <td>
                <span className="stock-badge">
                  {movementLabels[movement.type] ?? movement.type}
                </span>
              </td>
              <td>
                <strong>{movement.productLot.lotNumber}</strong>
                <small>{movement.productLot.product.name}</small>
              </td>
              <td>
                {formatNumber(Number(movement.quantity))}{" "}
                {movement.productLot.product.unit}
              </td>
              <td>
                {movement.sourceMagazine?.name ?? "—"}
                {movement.destinationMagazine && (
                  <small> para {movement.destinationMagazine.name}</small>
                )}
              </td>
              <td>{movement.reference ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
