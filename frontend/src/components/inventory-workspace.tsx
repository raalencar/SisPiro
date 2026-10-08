"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  inventoryApi,
  type Magazine,
  type PageResult,
  type Product,
  type ProductLot,
  type StockMovement,
  type StockReport,
} from "@/lib/api";
import { Icon } from "@/components/icon";
import {
  InventoryCreateForm,
  type InventoryFormType,
} from "@/components/inventory-create-form";
import { formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";

type Tab = "overview" | "products" | "lots" | "magazines" | "movements";

type InventoryData = {
  report: StockReport | null;
  products: PageResult<Product>;
  lots: PageResult<ProductLot>;
  magazines: PageResult<Magazine>;
  movements: PageResult<StockMovement>;
};

type Props = {
  initialTab?: Tab;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Resumo" },
  { id: "products", label: "Produtos" },
  { id: "lots", label: "Lotes" },
  { id: "magazines", label: "Paióis" },
  { id: "movements", label: "Movimentações" },
];

const createFormByTab: Partial<Record<Tab, InventoryFormType>> = {
  products: "product",
  lots: "lot",
  magazines: "magazine",
  movements: "movement",
};

const productTypeLabels = {
  MERCADORIA: "Mercadoria",
  INSUMO: "Insumo",
  SERVICO: "Serviço",
};

const movementLabels = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  TRANSFERENCIA: "Transferência",
  AJUSTE: "Ajuste",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar o estoque.";
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <article className={`inventory-metric inventory-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyTable({ message }: { message: string }) {
  return <p className="table-empty">{message}</p>;
}

function Pagination({
  result,
  onChange,
}: {
  result: PageResult<unknown>;
  onChange: (page: number) => void;
}) {
  if (result.meta.totalPages <= 1) return null;
  return (
    <nav className="table-pagination" aria-label="Paginação">
      <button
        className="button button--quiet"
        type="button"
        disabled={result.meta.page <= 1}
        onClick={() => onChange(result.meta.page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {result.meta.page} de {result.meta.totalPages} · {result.meta.total} registros
      </span>
      <button
        className="button button--quiet"
        type="button"
        disabled={result.meta.page >= result.meta.totalPages}
        onClick={() => onChange(result.meta.page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}

export function InventoryWorkspace({ initialTab = "overview" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryFormType | null>(null);

  useEffect(() => {
    let current = true;
    const pageFor = (tab: Tab) => (activeTab === tab ? page : 1);
    const searchFor = (tab: Tab) =>
      activeTab === tab && appliedSearch ? appliedSearch : undefined;

    void Promise.allSettled([
      inventoryApi.getStockReport(),
      inventoryApi.getProducts(pageFor("products"), searchFor("products")),
      inventoryApi.getLots(pageFor("lots"), searchFor("lots")),
      inventoryApi.getMagazines(pageFor("magazines"), searchFor("magazines")),
      inventoryApi.getMovements(pageFor("movements"), searchFor("movements")),
    ])
      .then(([reportResult, productsResult, lotsResult, magazinesResult, movementsResult]) => {
        if (!current) return;
        const listResults = [
          productsResult,
          lotsResult,
          magazinesResult,
          movementsResult,
        ];
        const listFailures = listResults.filter(
          (result) => result.status === "rejected",
        );
        if (listFailures.length > 0) {
          const messages = listFailures.map((result) =>
            result.status === "rejected" ? errorMessage(result.reason) : "",
          );
          setError(messages.join(" "));
          setData(null);
          return;
        }
        if (
          productsResult.status !== "fulfilled" ||
          lotsResult.status !== "fulfilled" ||
          magazinesResult.status !== "fulfilled" ||
          movementsResult.status !== "fulfilled"
        ) {
          setError("A API retornou listas de estoque em formato inesperado.");
          setData(null);
          return;
        }
        const report = reportResult.status === "fulfilled" ? reportResult.value : null;
        setData({
          report,
          products: productsResult.value,
          lots: lotsResult.value,
          magazines: magazinesResult.value,
          movements: movementsResult.value,
        });
        if (reportResult.status === "rejected") {
          setError(
            `Resumo de estoque indisponível: ${errorMessage(reportResult.reason)} As listas seguem disponíveis.`,
          );
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [activeTab, page, appliedSearch, revision]);

  function changeTab(tab: Tab) {
    if (tab === activeTab) return;
    setLoading(true);
    setError(null);
    setActiveTab(tab);
    setPage(1);
    setSearchInput("");
    setAppliedSearch("");
    setNotice(null);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchInput.trim();
    if (query === appliedSearch && page === 1) {
      setLoading(true);
      setError(null);
      setRevision((current) => current + 1);
      return;
    }
    setLoading(true);
    setError(null);
    setPage(1);
    setAppliedSearch(query);
  }

  function created(message: string) {
    setForm(null);
    setLoading(true);
    setError(null);
    setNotice(message);
    setPage(1);
    setSearchInput("");
    setAppliedSearch("");
    setRevision((current) => current + 1);
  }

  const addForm = createFormByTab[activeTab];
  const summary = data?.report ?? null;
  const totalNeqKg =
    summary?.byProduct.reduce((total, product) => total + Number(product.neqKg), 0) ?? 0;
  const expiringLotIds = new Set(summary?.expiringLots.map((lot) => lot.lotId) ?? []);
  const expiredLotIds = new Set(summary?.expiredLots.map((lot) => lot.lotId) ?? []);

  return (
    <>
      <header className="page-heading">
        <div className="page-heading__identity">
          <span className="page-heading__icon"><Icon name="warehouse" size={24} /></span>
          <div>
            <p className="eyebrow">Governança</p>
            <h1>Estoque e WMS</h1>
            <p className="page-heading__description">
              Produtos, rastreabilidade de lotes, capacidade NEQ e movimentações.
            </p>
          </div>
        </div>
        <span className="status-pill status-pill--available">API conectada</span>
      </header>

      {error && (
        <div className="inventory-alert inventory-alert--error" role="alert">
          <span>{error}</span>
          <button className="button button--quiet" type="button" onClick={() => {
            setLoading(true);
            setError(null);
            setRevision((value) => value + 1);
          }}>
            Tentar novamente
          </button>
        </div>
      )}
      {notice && (
        <div className="inventory-alert inventory-alert--success" role="status">
          <span>{notice}</span>
          <button className="icon-button" type="button" onClick={() => setNotice(null)} aria-label="Fechar confirmação">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {summary && (
        <section className="inventory-metrics" aria-label="Resumo do estoque">
          <MetricCard
            label="Lotes com saldo"
            value={formatNumber(summary.totals.lotCount, 0)}
            detail="Lotes com quantidade física disponível"
          />
          <MetricCard
            label="Massa NEQ total"
            value={`${formatNumber(totalNeqKg, 2)} kg`}
            detail="Calculada a partir dos produtos cadastrados"
          />
          <MetricCard
            label={`Vencem em ${summary.expiryWindowDays} dias`}
            value={formatNumber(summary.expiringLots.length, 0)}
            detail="Lotes dentro da janela de validade"
            tone={summary.expiringLots.length ? "warning" : "neutral"}
          />
          <MetricCard
            label="Lotes vencidos"
            value={formatNumber(summary.expiredLots.length, 0)}
            detail="Exigem atenção operacional"
            tone={summary.expiredLots.length ? "danger" : "neutral"}
          />
        </section>
      )}

      <section className="inventory-panel panel" aria-labelledby="inventory-section-title">
        <div className="inventory-toolbar">
          <div className="inventory-tabs" role="tablist" aria-label="Seções de estoque">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`inventory-tab ${activeTab === tab.id ? "inventory-tab--active" : ""}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => changeTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {addForm && (
            <button
              className="button button--primary"
              type="button"
              onClick={() => setForm(addForm)}
            >
              <span aria-hidden="true">+</span> {addForm === "lot" ? "Receber lote" : addForm === "movement" ? "Movimentar estoque" : addForm === "product" ? "Novo produto" : "Novo paiol"}
            </button>
          )}
        </div>

        <div className="inventory-content">
          {activeTab === "overview" && (
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
                <p className="table-empty" role="status">Carregando posição de estoque...</p>
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
                          <td>{formatNumber(Number(product.physicalQuantity))} {product.unit}</td>
                          <td>{formatNumber(Number(product.reservedQuantity))} {product.unit}</td>
                          <td>{formatNumber(Number(product.availableQuantity))} {product.unit}</td>
                          <td>{formatNumber(Number(product.neqKg))} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="inventory-quick-links">
                <button className="button button--quiet" type="button" onClick={() => changeTab("products")}>
                  Ver produtos
                </button>
                <button className="button button--quiet" type="button" onClick={() => changeTab("lots")}>
                  Ver lotes
                </button>
                <button className="button button--quiet" type="button" onClick={() => changeTab("movements")}>
                  Histórico de movimentações
                </button>
              </div>
              {summary && (summary.expiringLots.length > 0 || summary.expiredLots.length > 0) && (
                <div className="expiry-notice">
                  <Icon name="warning" size={17} />
                  <span>
                    Há {summary.expiredLots.length} lote(s) vencido(s) e{" "}
                    {summary.expiringLots.length} próximo(s) do vencimento. Confira
                    a lista de lotes antes de movimentar.
                  </span>
                  <button className="button button--quiet" type="button" onClick={() => changeTab("lots")}>
                    Conferir lotes
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab !== "overview" && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Estoque e WMS</p>
                  <h2 id="inventory-section-title">
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                  </h2>
                </div>
                <span className="section-count">
                  {data ? `${data[activeTab].meta.total} registros` : "Carregando..."}
                </span>
              </div>
              {activeTab !== "magazines" && (
                <form className="inventory-search" onSubmit={applySearch}>
                  <label className="field">
                    <span className="sr-only">Buscar nesta lista</span>
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder={`Buscar ${activeTab === "products" ? "por SKU ou nome" : activeTab === "lots" ? "por lote, fabricante ou produto" : "por referência ou lote"}`}
                      maxLength={100}
                    />
                  </label>
                  <button className="button button--quiet" type="submit" disabled={loading}>
                    Buscar
                  </button>
                  {loading && <span role="status" className="inventory-loading">Atualizando...</span>}
                </form>
              )}

              {!data ? (
                <p className="table-empty" role="status">Carregando dados de estoque...</p>
              ) : activeTab === "products" ? (
                data.products.data.length === 0 ? (
                  <EmptyTable message="Nenhum produto corresponde à busca." />
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr><th>SKU / produto</th><th>Tipo</th><th>PCE / classe</th><th>NEQ unitária</th><th>Unidade</th></tr>
                      </thead>
                      <tbody>
                        {data.products.data.map((product) => (
                          <tr key={product.id}>
                            <td><strong>{product.name}</strong><small>{product.sku}</small></td>
                            <td>{productTypeLabels[product.type]}</td>
                            <td>{product.isPce ? `PCE · ${product.riskClass}` : "Não PCE"}</td>
                            <td>{product.isPce ? `${formatNumber(Number(product.neqGrams), 3)} g` : "—"}</td>
                            <td>{product.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : activeTab === "magazines" ? (
                data.magazines.data.length === 0 ? (
                  <EmptyTable message="Nenhum paiol corresponde à busca." />
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr><th>Paiol</th><th>NEQ atual</th><th>Capacidade</th><th>Disponível</th><th>Licença até</th></tr>
                      </thead>
                      <tbody>
                        {data.magazines.data.map((magazine) => (
                          <tr key={magazine.id}>
                            <td><strong>{magazine.name}</strong></td>
                            <td>{formatNumber(Number(magazine.currentNeqKg))} kg</td>
                            <td>{formatNumber(Number(magazine.maxNeqCapacityKg))} kg</td>
                            <td>{formatNumber(Number(magazine.remainingNeqKg))} kg</td>
                            <td>{formatDateOnly(magazine.fireLicenseExpiresAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : activeTab === "lots" ? (
                data.lots.data.length === 0 ? (
                  <EmptyTable message="Nenhum lote corresponde à busca." />
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr><th>Lote / produto</th><th>Paiol</th><th>Saldo</th><th>NEQ</th><th>Validade</th><th>Situação</th></tr>
                      </thead>
                      <tbody>
                        {data.lots.data.map((lot) => (
                          <tr key={lot.id}>
                            <td><strong>{lot.lotNumber}</strong><small>{lot.product.sku} · {lot.product.name}</small></td>
                            <td>{lot.magazine.name}</td>
                            <td>{formatNumber(Number(lot.quantity))} {lot.product.unit}</td>
                            <td>{formatNumber(Number(lot.neqKg))} kg</td>
                            <td>{formatDateOnly(lot.expiresAt)}</td>
                            <td>
                              {expiredLotIds.has(lot.id) ? (
                                <span className="stock-badge stock-badge--danger">Vencido</span>
                              ) : expiringLotIds.has(lot.id) ? (
                                <span className="stock-badge stock-badge--warning">Vence em breve</span>
                              ) : (
                                <span className="stock-badge">Regular</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                data.movements.data.length === 0 ? (
                  <EmptyTable message="Nenhuma movimentação corresponde à busca." />
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr><th>Data</th><th>Tipo</th><th>Lote / produto</th><th>Quantidade</th><th>Origem / destino</th><th>Referência</th></tr>
                      </thead>
                      <tbody>
                        {data.movements.data.map((movement) => (
                          <tr key={movement.id}>
                            <td>{formatDateTime(movement.occurredAt)}</td>
                            <td><span className="stock-badge">{movementLabels[movement.type]}</span></td>
                            <td><strong>{movement.productLot.lotNumber}</strong><small>{movement.productLot.product.name}</small></td>
                            <td>{formatNumber(Number(movement.quantity))} {movement.productLot.product.unit}</td>
                            <td>
                              {movement.sourceMagazine?.name ?? "—"}
                              {movement.destinationMagazine && (
                                <small>para {movement.destinationMagazine.name}</small>
                              )}
                            </td>
                            <td>{movement.reference ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {data && (
                <Pagination
                  result={data[activeTab]}
                  onChange={(nextPage) => {
                    setLoading(true);
                    setError(null);
                    setPage(nextPage);
                  }}
                />
              )}
            </>
          )}
        </div>
      </section>

      <p className="inventory-traceability-note">
        A API disponibiliza cadastro e movimentações; edição ou exclusão de
        produtos, paióis, lotes e movimentos não estão implementadas. Lotes e
        movimentos permanecem rastreáveis no histórico.
      </p>

      {form && data && (
        <InventoryCreateForm
          type={form}
          products={data.products.data}
          magazines={data.magazines.data}
          lots={data.lots.data}
          onClose={() => setForm(null)}
          onCreated={created}
        />
      )}
    </>
  );
}
