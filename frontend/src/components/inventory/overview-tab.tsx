"use client";

import { Icon } from "@/components/icon";
import type { StockReport } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { EmptyTable, type Tab } from "./types";

interface OverviewTabProps {
  summary: StockReport | null;
  loading: boolean;
  onChangeTab: (tab: Tab) => void;
}

export function OverviewTab({
  summary,
  loading,
  onChangeTab,
}: OverviewTabProps) {
  return (
    <section role="tabpanel" aria-labelledby="inventory-section-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Posição de estoque</p>
          <h2 id="inventory-section-title">Saldo por produto</h2>
        </div>
        {summary && (
          <span className="section-count">
            Atualizado {formatDateTime(summary.asOf)}
          </span>
        )}
      </div>

      {loading && !summary ? (
        <p className="table-empty" role="status">
          Carregando posição de estoque...
        </p>
      ) : !summary ? (
        <EmptyTable message="O resumo de saldo não está disponível. Use as listas de produtos e lotes para consultar os registros." />
      ) : summary.byProduct.length === 0 ? (
        <EmptyTable message="Ainda não há saldo de estoque para exibir." />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Lotes</th>
                <th>Físico</th>
                <th>Reservado</th>
                <th>Disponível</th>
                <th>Quarentena / Bloqueio</th>
                <th>NEQ</th>
              </tr>
            </thead>
            <tbody>
              {summary.byProduct.map((product) => (
                <tr key={product.productId}>
                  <td>
                    <strong>{product.productName}</strong>
                    <small>{product.sku}</small>
                  </td>
                  <td>{product.lotCount}</td>
                  <td>
                    {formatNumber(Number(product.physicalQuantity))}{" "}
                    {product.unit}
                  </td>
                  <td>
                    {formatNumber(Number(product.reservedQuantity))}{" "}
                    {product.unit}
                  </td>
                  <td>
                    {formatNumber(Number(product.availableQuantity))}{" "}
                    {product.unit}
                  </td>
                  <td>
                    {Number(product.quarantinedQuantity) +
                      Number(product.blockedQuantity) >
                    0 ? (
                      <span className="stock-badge stock-badge--warning">
                        {formatNumber(
                          Number(product.quarantinedQuantity) +
                            Number(product.blockedQuantity),
                        )}{" "}
                        {product.unit}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatNumber(Number(product.neqKg))} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="inventory-quick-links">
        <button
          className="button button--quiet"
          type="button"
          onClick={() => onChangeTab("products")}
        >
          Ver produtos
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => onChangeTab("lots")}
        >
          Ver lotes
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => onChangeTab("movements")}
        >
          Histórico de movimentações
        </button>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => onChangeTab("sfpc")}
        >
          Mapa SFPC (R-105)
        </button>
      </div>

      {summary &&
        (summary.expiringLots.length > 0 ||
          summary.expiredLots.length > 0) && (
          <div className="expiry-notice">
            <Icon name="warning" size={17} />
            <span>
              Há {summary.expiredLots.length} lote(s) vencido(s) e{" "}
              {summary.expiringLots.length} próximo(s) do vencimento.
              Confira a lista de lotes antes de movimentar.
            </span>
            <button
              className="button button--quiet"
              type="button"
              onClick={() => onChangeTab("lots")}
            >
              Conferir lotes
            </button>
          </div>
        )}
    </section>
  );
}
