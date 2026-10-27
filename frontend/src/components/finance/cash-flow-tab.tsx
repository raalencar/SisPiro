"use client";

import type { CashFlowSummary } from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";

interface CashFlowTabProps {
  cashFlow: CashFlowSummary | null;
  cfFrom: string;
  cfTo: string;
  onCfFromChange: (val: string) => void;
  onCfToChange: (val: string) => void;
}

export function CashFlowTab({
  cashFlow,
  cfFrom,
  cfTo,
  onCfFromChange,
  onCfToChange,
}: CashFlowTabProps) {
  return (
    <div className="space-y-6">
      {/* Filtro de Período */}
      <div className="panel p-4 flex flex-wrap gap-4 items-end bg-white border border-neutral-200 shadow-sm rounded-lg">
        <label className="field w-40">
          <span className="text-xs font-semibold text-neutral-700">Período De</span>
          <input
            type="date"
            value={cfFrom}
            onChange={(e) => onCfFromChange(e.target.value)}
            className="input text-xs"
          />
        </label>
        <label className="field w-40">
          <span className="text-xs font-semibold text-neutral-700">Período Até</span>
          <input
            type="date"
            value={cfTo}
            onChange={(e) => onCfToChange(e.target.value)}
            className="input text-xs"
          />
        </label>
      </div>

      {/* Cards de Resumo */}
      {cashFlow ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-metric border-emerald-200">
            <span className="card-metric__label text-emerald-800">
              Entradas Realizadas
            </span>
            <div className="card-metric__value text-emerald-700">
              {formatCurrency(Number(cashFlow.totals.totalInflow))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">Total recebido no período</p>
          </div>

          <div className="card-metric border-rose-200">
            <span className="card-metric__label text-rose-800">
              Saídas Realizadas
            </span>
            <div className="card-metric__value text-rose-700">
              {formatCurrency(Number(cashFlow.totals.totalOutflow))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">Total pago no período</p>
          </div>

          <div className="card-metric border-neutral-200">
            <span className="card-metric__label text-neutral-700">
              Saldo Líquido Realizado
            </span>
            <div
              className={`card-metric__value ${
                Number(cashFlow.totals.netCashFlow) >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatCurrency(Number(cashFlow.totals.netCashFlow))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">Resultado de caixa no período</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">Calculando fluxo de caixa realizado...</p>
      )}

      {/* Tabela Diária */}
      {cashFlow && cashFlow.daily.length > 0 && (
        <div className="panel p-0 overflow-hidden shadow-sm border border-neutral-200">
          <div className="p-4 border-b border-neutral-200 font-bold text-sm text-neutral-900 bg-neutral-50/50">
            Movimentação Diária de Caixa
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-50/90 text-neutral-600 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3 text-right">Entradas (R$)</th>
                  <th className="p-3 text-right">Saídas (R$)</th>
                  <th className="p-3 text-right">Saldo do Dia (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {cashFlow.daily.map((d) => (
                  <tr key={d.date} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 text-xs text-neutral-700 font-mono font-medium">{formatDateOnly(d.date)}</td>
                    <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                      {formatCurrency(Number(d.inflow))}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-700 font-semibold">
                      {formatCurrency(Number(d.outflow))}
                    </td>
                    <td
                      className={`p-3 text-right font-mono font-bold ${
                        Number(d.net) >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatCurrency(Number(d.net))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
