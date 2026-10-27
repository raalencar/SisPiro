"use client";

import type { FormEvent } from "react";
import { Icon } from "@/components/icon";
import type { ServiceOrder, ServiceOrderStatus } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { STATUS_LABELS, STATUS_TONES } from "./types";

interface OrdersTableProps {
  orders: ServiceOrder[];
  selectedId: string | null;
  loading: boolean;
  page: number;
  totalPages: number;
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  statusFilter: ServiceOrderStatus | "";
  onStatusFilterChange: (val: ServiceOrderStatus | "") => void;
  onPageChange: (newPage: number) => void;
  onApplyFilters: (e: FormEvent<HTMLFormElement>) => void;
  onReload: () => void;
  onChangeSelected: (order: ServiceOrder) => void;
}

export function OrdersTable({
  orders,
  selectedId,
  loading,
  page,
  totalPages,
  searchInput,
  onSearchInputChange,
  statusFilter,
  onStatusFilterChange,
  onPageChange,
  onApplyFilters,
  onReload,
  onChangeSelected,
}: OrdersTableProps) {
  return (
    <>
      <form className="operations-filters" onSubmit={onApplyFilters}>
        <label className="operations-search">
          <span>Buscar ordem</span>
          <input
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            placeholder="Código, cliente ou local"
          />
        </label>
        <label>
          <span>Situação</span>
          <select
            value={statusFilter}
            onChange={(event) => {
              onStatusFilterChange(event.target.value as ServiceOrderStatus | "");
              onPageChange(1);
            }}
          >
            <option value="">Todas as situações</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button button--quiet" type="submit">
          Filtrar
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={onReload}
          aria-label="Atualizar ordens"
        >
          <Icon name="refresh" size={16} /> Atualizar
        </button>
      </form>

      {loading && orders.length === 0 ? (
        <p className="table-empty" role="status">
          Carregando ordens de serviço...
        </p>
      ) : orders.length === 0 ? (
        <p className="table-empty">
          Nenhuma ordem de serviço encontrada para os filtros informados.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table operations-table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Cliente</th>
                <th>Evento</th>
                <th>Valor contratado</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={
                    selectedId === order.id ? "operations-row--selected" : ""
                  }
                >
                  <td>
                    <strong>#{order.code}</strong>
                    <small>{order.eventLocation}</small>
                  </td>
                  <td>{order.customer.legalName}</td>
                  <td>{formatDateTime(order.eventAt)}</td>
                  <td>{formatCurrency(Number(order.contractedAmount))}</td>
                  <td>
                    <span className={`status-pill status-pill--${STATUS_TONES[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => onChangeSelected(order)}
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(totalPages > 1 || page > 1) && (
        <nav className="table-pagination" aria-label="Paginação de ordens">
          <button
            className="button button--quiet"
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            className="button button--quiet"
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  );
}
