"use client";

import type { AgingReport } from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";

interface AgingTabProps {
  agingReport: AgingReport | null;
  agingAsOf: string;
  onAgingAsOfChange: (val: string) => void;
}

export function AgingTab({
  agingReport,
  agingAsOf,
  onAgingAsOfChange,
}: AgingTabProps) {
  return (
    <div className="space-y-6">
      {/* Filtro Data Base */}
      <div className="panel p-4 flex flex-wrap gap-4 items-end bg-white border border-neutral-200 shadow-sm rounded-lg">
        <label className="field w-40">
          <span className="text-xs font-semibold text-neutral-700">Data de Corte (asOf)</span>
          <input
            type="date"
            value={agingAsOf}
            onChange={(e) => onAgingAsOfChange(e.target.value)}
            className="input text-xs"
          />
        </label>
      </div>

      {/* Card de Exposição Líquida */}
      {agingReport && (
        <div className="card-metric border-neutral-200">
          <span className="card-metric__label text-neutral-700">
            Exposição Líquida Total (Recebíveis - A Pagar)
          </span>
          <div
            className={`card-metric__value ${
              Number(agingReport.netExposure) >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatCurrency(Number(agingReport.netExposure))}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Posição calculada com base na data de corte {formatDateOnly(agingReport.asOf)}.
          </p>
        </div>
      )}

      {/* Tabela com os 5 Buckets de Vencimento */}
      {agingReport ? (
        <div className="panel p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-800/50 text-neutral-300">
                <tr>
                  <th className="p-3">Carteira</th>
                  <th className="p-3 text-right">A Vencer (Em dia)</th>
                  <th className="p-3 text-right">1 a 30 dias</th>
                  <th className="p-3 text-right">31 a 60 dias</th>
                  <th className="p-3 text-right">61 a 90 dias</th>
                  <th className="p-3 text-right">&gt; 90 dias</th>
                  <th className="p-3 text-right font-bold">Total Aberto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {/* Recebíveis */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3 font-semibold text-emerald-400">Contas a Receber</td>
                  <td className="p-3 text-right font-mono text-neutral-200">
                    {formatCurrency(Number(agingReport.receivables.current))}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-400">
                    {formatCurrency(Number(agingReport.receivables.overdue1to30))}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-500">
                    {formatCurrency(Number(agingReport.receivables.overdue31to60))}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-400">
                    {formatCurrency(Number(agingReport.receivables.overdue61to90))}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-500 font-bold">
                    {formatCurrency(Number(agingReport.receivables.overdueOver90))}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-300">
                    {formatCurrency(Number(agingReport.receivables.total))}
                  </td>
                </tr>

                {/* A Pagar */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3 font-semibold text-rose-400">Contas a Pagar</td>
                  <td className="p-3 text-right font-mono text-neutral-200">
                    {formatCurrency(Number(agingReport.payables.current))}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-400">
                    {formatCurrency(Number(agingReport.payables.overdue1to30))}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-500">
                    {formatCurrency(Number(agingReport.payables.overdue31to60))}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-400">
                    {formatCurrency(Number(agingReport.payables.overdue61to90))}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-500 font-bold">
                    {formatCurrency(Number(agingReport.payables.overdueOver90))}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-rose-300">
                    {formatCurrency(Number(agingReport.payables.total))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">Carregando relatório de Aging schedule...</p>
      )}
    </div>
  );
}
