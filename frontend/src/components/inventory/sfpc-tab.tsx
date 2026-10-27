"use client";

import { Icon } from "@/components/icon";
import type { SfpcMonthlyReport } from "@/lib/api";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { EmptyTable, MetricCard } from "./types";

interface SfpcTabProps {
  sfpcReport: SfpcMonthlyReport | null;
  sfpcYear: number;
  sfpcMonth: number;
  sfpcLoading: boolean;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onRefresh: () => void;
  onOpenOfficialModal: () => void;
}

export function SfpcTab({
  sfpcReport,
  sfpcYear,
  sfpcMonth,
  sfpcLoading,
  onYearChange,
  onMonthChange,
  onRefresh,
  onOpenOfficialModal,
}: SfpcTabProps) {
  return (
    <section role="tabpanel" aria-labelledby="inventory-section-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Fiscalização Militar / SFPC / R-105</p>
          <h2 id="inventory-section-title">
            Mapa Mensal de Movimentação de PCE
          </h2>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="sr-only">Ano</span>
            <select
              value={sfpcYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="sr-only">Mês</span>
            <select
              value={sfpcMonth}
              onChange={(e) => onMonthChange(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Mês {m.toString().padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button--quiet"
            type="button"
            disabled={sfpcLoading}
            onClick={onRefresh}
          >
            {sfpcLoading ? "Carregando..." : "Atualizar"}
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={!sfpcReport || sfpcLoading}
            onClick={onOpenOfficialModal}
          >
            <Icon name="boxes" size={14} />
            Emitir Espelho Oficial SFPC
          </button>
        </div>
      </div>

      {sfpcReport && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <MetricCard
              label="Saldo Inicial (Abertura)"
              value={`${formatNumber(
                Number(sfpcReport.totals.initialBalanceNeqKg),
                2,
              )} kg`}
              detail={`Período iniciado em ${formatDateOnly(
                sfpcReport.periodStart,
              )}`}
            />
            <MetricCard
              label="Entradas no Mês"
              value={`${formatNumber(
                Number(sfpcReport.totals.inflowNeqKg),
                2,
              )} kg`}
              detail="Compras, devoluções e ajustes positivos"
            />
            <MetricCard
              label="Saídas no Mês"
              value={`${formatNumber(
                Number(sfpcReport.totals.outflowNeqKg),
                2,
              )} kg`}
              detail="Vendas, queimas em OS e ajustes negativos"
            />
            <MetricCard
              label="Saldo Final (Fechamento)"
              value={`${formatNumber(
                Number(sfpcReport.totals.finalBalanceNeqKg),
                2,
              )} kg`}
              detail={`${sfpcReport.totals.productCount} produtos controlados`}
              tone="neutral"
            />
          </div>

          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            Consolidação por Classe de Risco (Exército Brasileiro)
          </h3>
          <div className="table-scroll" style={{ marginBottom: "1.5rem" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Classe de Risco</th>
                  <th>Produtos</th>
                  <th>Saldo Inicial</th>
                  <th>Entradas</th>
                  <th>Saídas</th>
                  <th>Saldo Final</th>
                  <th>NEQ Final (kg)</th>
                </tr>
              </thead>
              <tbody>
                {sfpcReport.byRiskClass.map((rc) => (
                  <tr key={rc.riskClass}>
                    <td>
                      <strong>{rc.riskClass}</strong>
                    </td>
                    <td>{rc.productCount}</td>
                    <td>{formatNumber(Number(rc.initialQuantity))}</td>
                    <td>{formatNumber(Number(rc.inflowQuantity))}</td>
                    <td>{formatNumber(Number(rc.outflowQuantity))}</td>
                    <td>
                      <strong>{formatNumber(Number(rc.finalQuantity))}</strong>
                    </td>
                    <td>{formatNumber(Number(rc.finalNeqKg))} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
            Detalhamento de Movimentação por Produto PCE
          </h3>
          {sfpcReport.items.length === 0 ? (
            <EmptyTable message="Nenhum produto controlado registrado no catálogo." />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU / Produto</th>
                    <th>Classe</th>
                    <th>Unidade</th>
                    <th>Saldo Inicial</th>
                    <th>Entradas</th>
                    <th>Saídas</th>
                    <th>Saldo Final</th>
                    <th>NEQ Final</th>
                  </tr>
                </thead>
                <tbody>
                  {sfpcReport.items.map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <strong>{item.productName}</strong>
                        <small>{item.sku}</small>
                      </td>
                      <td>{item.riskClass}</td>
                      <td>{item.unit}</td>
                      <td>{formatNumber(Number(item.initialQuantity))}</td>
                      <td>
                        <span
                          title={`Compras: ${item.inflowBreakdown.purchases} | Devoluções: ${item.inflowBreakdown.returns} | Ajustes: ${item.inflowBreakdown.adjustments}`}
                        >
                          {formatNumber(Number(item.inflowBreakdown.total))}
                        </span>
                      </td>
                      <td>
                        <span
                          title={`Vendas: ${item.outflowBreakdown.sales} | OS: ${item.outflowBreakdown.serviceOrders} | Ajustes: ${item.outflowBreakdown.adjustments}`}
                        >
                          {formatNumber(Number(item.outflowBreakdown.total))}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {formatNumber(Number(item.finalQuantity))}
                        </strong>
                      </td>
                      <td>{formatNumber(Number(item.finalNeqKg))} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
