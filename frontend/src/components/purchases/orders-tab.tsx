"use client";

import type { PageResult, Purchase, PurchaseStatus } from "@/lib/api";
import { formatCurrency, formatDateOnly, formatNumber } from "@/lib/format";
import {
  STATUS_LABELS,
  STATUS_TONES,
  purchaseTotal,
  receivedQuantity,
} from "./types";

interface OrdersTabProps {
  purchases: PageResult<Purchase> | null;
  loading: boolean;
  statusFilter: PurchaseStatus | "";
  onStatusFilterChange: (status: PurchaseStatus | "") => void;
  onOpenReceive: (p: Purchase) => void;
  onCancelOrder: (id: string) => void;
}

export function OrdersTab({
  purchases,
  loading,
  statusFilter,
  onStatusFilterChange,
  onOpenReceive,
  onCancelOrder,
}: OrdersTabProps) {
  return (
    <div className="space-y-4">
      {/* Filtros de compras */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as PurchaseStatus | "")}
          className="input w-48 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PARCIAL">Recebimento Parcial</option>
          <option value="RECEBIDO">Recebido Total</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* Tabela de Compras */}
      <div className="panel p-0 overflow-hidden shadow-sm border border-neutral-200">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Carregando pedidos de compra...</div>
        ) : !purchases || purchases.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">Nenhum pedido de compra encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-50/90 text-neutral-600 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Fornecedor</th>
                  <th className="p-3">Itens</th>
                  <th className="p-3">Valor Total</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {purchases.data.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 text-xs text-neutral-500">
                      {formatDateOnly(p.createdAt)}
                    </td>
                    <td className="p-3 font-semibold text-neutral-900">
                      {p.supplier?.legalName || "Fornecedor s/ nome"}
                    </td>
                    <td className="p-3 text-xs">
                      {p.items.map((it, i) => (
                        <div key={i} className="text-neutral-800 font-medium">
                          {it.product?.name || "Produto"}: {formatNumber(receivedQuantity(it))}/
                          {formatNumber(Number(it.orderedQuantity))} {it.product?.unit}
                        </div>
                      ))}
                    </td>
                    <td className="p-3 font-mono font-bold text-neutral-900">
                      {formatCurrency(purchaseTotal(p))}
                    </td>
                    <td className="p-3">
                      <span className={`status-pill status-pill--${STATUS_TONES[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(p.status === "PENDENTE" || p.status === "PARCIAL") && (
                          <>
                            <button
                              type="button"
                              className="button button--primary text-xs py-1 px-2.5 shadow-sm"
                              onClick={() => onOpenReceive(p)}
                            >
                              Receber Lote
                            </button>
                            {p.status === "PENDENTE" && (
                              <button
                                type="button"
                                className="button button--ghost text-xs py-1 px-2 text-rose-600 hover:bg-rose-50 font-medium"
                                onClick={() => onCancelOrder(p.id)}
                              >
                                Cancelar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
