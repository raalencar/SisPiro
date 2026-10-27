"use client";

import type { ProductLot } from "@/lib/api";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { EmptyTable } from "./types";

interface LotsTabProps {
  lots: ProductLot[];
  expiredLotIds: Set<string>;
  expiringLotIds: Set<string>;
  onOpenStatusModal: (lot: ProductLot) => void;
  onOpenSplitModal: (lot: ProductLot) => void;
}

export function LotsTab({
  lots,
  expiredLotIds,
  expiringLotIds,
  onOpenStatusModal,
  onOpenSplitModal,
}: LotsTabProps) {
  if (lots.length === 0) {
    return <EmptyTable message="Nenhum lote corresponde à busca." />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Lote / produto</th>
            <th>Paiol</th>
            <th>Saldo</th>
            <th>NEQ</th>
            <th>Validade</th>
            <th>Situação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
            <tr key={lot.id}>
              <td>
                <strong>{lot.lotNumber}</strong>
                <small>
                  {lot.product.sku} · {lot.product.name}
                </small>
              </td>
              <td>{lot.magazine.name}</td>
              <td>
                {formatNumber(Number(lot.quantity))} {lot.product.unit}
              </td>
              <td>{formatNumber(Number(lot.neqKg))} kg</td>
              <td>{formatDateOnly(lot.expiresAt)}</td>
              <td>
                {lot.status === "BLOQUEADO" ? (
                  <span
                    className="stock-badge stock-badge--danger"
                    title={lot.statusReason ?? "Lote bloqueado"}
                  >
                    Bloqueado
                  </span>
                ) : lot.status === "QUARENTENA" ? (
                  <span
                    className="stock-badge stock-badge--warning"
                    title={lot.statusReason ?? "Lote em quarentena"}
                  >
                    Quarentena
                  </span>
                ) : expiredLotIds.has(lot.id) ? (
                  <span className="stock-badge stock-badge--danger">
                    Vencido
                  </span>
                ) : expiringLotIds.has(lot.id) ? (
                  <span className="stock-badge stock-badge--warning">
                    Vence em breve
                  </span>
                ) : (
                  <span className="stock-badge">Disponível</span>
                )}
              </td>
              <td>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => onOpenStatusModal(lot)}
                  >
                    Situação
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={lot.status !== "DISPONIVEL"}
                    title={
                      lot.status !== "DISPONIVEL"
                        ? "Apenas lotes disponíveis podem ser desmembrados"
                        : "Desmembrar lote"
                    }
                    onClick={() => onOpenSplitModal(lot)}
                  >
                    Desmembrar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
