"use client";

import type { FinancialDirection, FinancialEntry, FinancialStatus, PageResult } from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";

interface EntriesTabProps {
  entries: PageResult<FinancialEntry> | null;
  loading: boolean;
  directionFilter: FinancialDirection | "TODOS";
  statusFilter: FinancialStatus | "TODOS";
  entriesFrom: string;
  entriesTo: string;
  pixLoading: boolean;
  onDirectionFilterChange: (val: FinancialDirection | "TODOS") => void;
  onStatusFilterChange: (val: FinancialStatus | "TODOS") => void;
  onEntriesFromChange: (val: string) => void;
  onEntriesToChange: (val: string) => void;
  onClearFilters: () => void;
  onGeneratePix: (id: string) => void;
  onOpenPayment: (en: FinancialEntry) => void;
  onCancelEntry: (id: string) => void;
}

export function EntriesTab({
  entries,
  loading,
  directionFilter,
  statusFilter,
  entriesFrom,
  entriesTo,
  pixLoading,
  onDirectionFilterChange,
  onStatusFilterChange,
  onEntriesFromChange,
  onEntriesToChange,
  onClearFilters,
  onGeneratePix,
  onOpenPayment,
  onCancelEntry,
}: EntriesTabProps) {
  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="panel p-4 flex flex-wrap gap-4 items-end bg-white border border-neutral-200 shadow-sm rounded-lg">
        <label className="field w-36">
          <span className="text-xs font-semibold text-neutral-700">Direção</span>
          <select
            value={directionFilter}
            onChange={(e) => onDirectionFilterChange(e.target.value as FinancialDirection | "TODOS")}
            className="input text-xs"
          >
            <option value="TODOS">Todos</option>
            <option value="RECEBER">A Receber</option>
            <option value="PAGAR">A Pagar</option>
          </select>
        </label>

        <label className="field w-40">
          <span className="text-xs font-semibold text-neutral-700">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as FinancialStatus | "TODOS")}
            className="input text-xs"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ABERTO">Em Aberto</option>
            <option value="PARCIAL">Parcialmente Pago</option>
            <option value="PAGO">Liquidado / Pago</option>
            <option value="COMPENSADO">Compensado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </label>

        <label className="field w-36">
          <span className="text-xs font-semibold text-neutral-700">Vencimento De</span>
          <input
            type="date"
            value={entriesFrom}
            onChange={(e) => onEntriesFromChange(e.target.value)}
            className="input text-xs"
          />
        </label>

        <label className="field w-36">
          <span className="text-xs font-semibold text-neutral-700">Vencimento Até</span>
          <input
            type="date"
            value={entriesTo}
            onChange={(e) => onEntriesToChange(e.target.value)}
            className="input text-xs"
          />
        </label>

        <button
          type="button"
          className="button button--secondary text-xs py-2 px-3 border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-medium"
          onClick={onClearFilters}
        >
          Limpar Filtros
        </button>
      </div>

      {/* Tabela de Títulos */}
      <div className="panel p-0 overflow-hidden shadow-sm border border-neutral-200">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Carregando títulos financeiros...</div>
        ) : !entries || entries.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">Nenhum título encontrado com os filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-50/90 text-neutral-600 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Contraparte / Categoria</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3 text-right">Valor Total</th>
                  <th className="p-3 text-right">Amortizado</th>
                  <th className="p-3 text-right">Saldo Devedor</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {entries.data.map((en) => {
                  const isPayable = en.direction === "PAGAR";
                  return (
                    <tr key={en.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="p-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            isPayable
                              ? "bg-rose-50 text-rose-800 border border-rose-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {isPayable ? "A Pagar" : "A Receber"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{en.counterpart || en.counterparty}</span>
                          {en.installmentCount && en.installmentCount > 1 && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-300"
                              title={`Grupo de Parcelas: ${en.installmentGroup ?? ""}`}
                            >
                              Parcela {en.installmentNumber}/{en.installmentCount}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
                          <span>Categoria: <strong className="text-neutral-700">{en.category}</strong></span>
                          {en.saleId && <span className="text-neutral-400">• Venda vinculada</span>}
                          {en.purchaseId && <span className="text-neutral-400">• Pedido de compra</span>}
                          {en.serviceOrderId && <span className="text-neutral-400">• OS vinculada</span>}
                        </div>
                      </td>
                      <td className="p-3 text-xs">
                        <div className={en.overdue ? "text-rose-600 font-bold" : "text-neutral-800 font-medium"}>
                          {formatDateOnly(en.dueDate)}
                        </div>
                        {en.overdue && en.status !== "PAGO" && en.status !== "CANCELADO" && (
                          <span className="status-pill status-pill--critical text-[10px] mt-0.5">
                            Vencido
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-neutral-900">
                        {formatCurrency(Number(en.amount))}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                        {formatCurrency(Number(en.paid))}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-neutral-900">
                        {formatCurrency(Number(en.outstanding))}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`status-pill ${
                            en.status === "PAGO" || en.status === "COMPENSADO"
                              ? "status-pill--available"
                              : en.status === "PARCIAL"
                              ? "status-pill--reserved"
                              : en.status === "CANCELADO"
                              ? "status-pill--neutral"
                              : en.overdue
                              ? "status-pill--critical"
                              : "status-pill--reserved"
                          }`}
                        >
                          {en.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(en.status === "ABERTO" || en.status === "PARCIAL") && !isPayable && (
                            <button
                              type="button"
                              className="button button--secondary text-xs py-1 px-2.5 border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100 font-medium shadow-sm"
                              onClick={() => onGeneratePix(en.id)}
                              disabled={pixLoading}
                              title="Gerar cobrança PIX com QR Code dinâmico"
                            >
                              PIX
                            </button>
                          )}
                          {(en.status === "ABERTO" || en.status === "PARCIAL") && (
                            <button
                              type="button"
                              className="button button--primary text-xs py-1 px-2.5 shadow-sm"
                              onClick={() => onOpenPayment(en)}
                            >
                              {isPayable ? "Pagar" : "Baixar"}
                            </button>
                          )}
                          {en.status !== "PAGO" && en.status !== "CANCELADO" && (
                            <button
                              type="button"
                              className="button button--ghost text-xs py-1 px-2 text-rose-600 hover:bg-rose-50 font-medium"
                              onClick={() => onCancelEntry(en.id)}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
