"use client";

import type { QuotesConversionReport, SalesReportSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

interface ReportsTabProps {
  quotesReport: QuotesConversionReport | null;
  salesReport: SalesReportSummary | null;
}

export function ReportsTab({ quotesReport, salesReport }: ReportsTabProps) {
  return (
    <div className="space-y-6">
      {/* Relatório de Conversão de Orçamentos */}
      <div className="panel space-y-4">
        <h2 className="text-lg font-bold text-neutral-900">Taxa de Conversão de Orçamentos Comerciais</h2>
        {quotesReport ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-metric">
              <span className="card-metric__label">Total Emitido</span>
              <span className="card-metric__value">{quotesReport.totals.quotesCount}</span>
            </div>
            <div className="card-metric">
              <span className="card-metric__label">Convertidos em Venda</span>
              <span className="card-metric__value text-emerald-700">
                {quotesReport.totals.convertedCount}
              </span>
            </div>
            <div className="card-metric">
              <span className="card-metric__label">Taxa de Conversão</span>
              <span className="card-metric__value text-teal-700">
                {quotesReport.totals.conversionRatePercent.toFixed(1)}%
              </span>
            </div>
            <div className="card-metric">
              <span className="card-metric__label">Ticket Médio</span>
              <span className="card-metric__value text-neutral-900">
                {formatCurrency(Number(quotesReport.totals.averageTicket))}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Carregando métricas de conversão...</p>
        )}
      </div>

      {/* Resumo de Vendas */}
      {salesReport && (
        <div className="panel space-y-4">
          <h2 className="text-lg font-bold text-neutral-900">Resumo Financeiro de Vendas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-metric">
              <span className="card-metric__label">Vendas Brutas</span>
              <span className="card-metric__value text-emerald-700">
                {formatCurrency(Number(salesReport.totals.grossSales))}
              </span>
            </div>
            <div className="card-metric">
              <span className="card-metric__label">Devoluções</span>
              <span className="card-metric__value text-rose-700">
                {formatCurrency(Number(salesReport.totals.returned))}
              </span>
            </div>
            <div className="card-metric">
              <span className="card-metric__label">Vendas Líquidas</span>
              <span className="card-metric__value text-teal-700">
                {formatCurrency(Number(salesReport.totals.netSales))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
