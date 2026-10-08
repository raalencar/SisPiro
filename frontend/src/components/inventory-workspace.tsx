"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  inventoryApi,
  type Magazine,
  type PageResult,
  type Product,
  type ProductLot,
  type ProductLotStatus,
  type SfpcMonthlyReport,
  type StockMovement,
  type StockReport,
} from "@/lib/api";
import { Icon } from "@/components/icon";
import {
  InventoryCreateForm,
  type InventoryFormType,
} from "@/components/inventory-create-form";
import { formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";

type Tab =
  | "overview"
  | "products"
  | "lots"
  | "magazines"
  | "movements"
  | "sfpc";

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
  { id: "sfpc", label: "Mapa SFPC (R-105)" },
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

  // Estados do Mapa SFPC
  const [sfpcReport, setSfpcReport] = useState<SfpcMonthlyReport | null>(null);
  const [sfpcYear, setSfpcYear] = useState(new Date().getFullYear());
  const [sfpcMonth, setSfpcMonth] = useState(new Date().getMonth() + 1);
  const [sfpcLoading, setSfpcLoading] = useState(false);

  // Estados para Mudança de Status do Lote
  const [lotForStatus, setLotForStatus] = useState<ProductLot | null>(null);
  const [newStatus, setNewStatus] = useState<ProductLotStatus>("QUARENTENA");
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Estados para Desmembramento de Lote (Split)
  const [lotForSplit, setLotForSplit] = useState<ProductLot | null>(null);
  const [splitMagazineId, setSplitMagazineId] = useState("");
  const [splitNewLotNumber, setSplitNewLotNumber] = useState("");
  const [splitQuantity, setSplitQuantity] = useState("");
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

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
      .then(
        ([
          reportResult,
          productsResult,
          lotsResult,
          magazinesResult,
          movementsResult,
        ]) => {
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
          const report =
            reportResult.status === "fulfilled" ? reportResult.value : null;
          setData({
            report,
            products: productsResult.value,
            lots: lotsResult.value,
            magazines: magazinesResult.value,
            movements: movementsResult.value,
          });
          if (reportResult.status === "rejected") {
            setError(
              `Resumo de estoque indisponível: ${errorMessage(
                reportResult.reason,
              )} As listas seguem disponíveis.`,
            );
          }
        },
      )
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [activeTab, page, appliedSearch, revision]);

  // Carregar dados SFPC quando a aba é selecionada ou ao mudar mês/ano
  useEffect(() => {
    if (activeTab === "sfpc") {
      let isCurrent = true;
      inventoryApi
        .getSfpcMonthlyMap(sfpcYear, sfpcMonth)
        .then((report) => {
          if (isCurrent) setSfpcReport(report);
        })
        .catch((err) => {
          if (isCurrent) setError(`Falha ao carregar Mapa SFPC: ${errorMessage(err)}`);
        })
        .finally(() => {
          if (isCurrent) setSfpcLoading(false);
        });

      return () => {
        isCurrent = false;
      };
    }
  }, [activeTab, sfpcYear, sfpcMonth, revision]);

  function changeTab(tab: Tab) {
    if (tab === activeTab) return;
    setLoading(true);
    if (tab === "sfpc") {
      setSfpcLoading(true);
    }
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
    setNotice(message);
    setRevision((current) => current + 1);
  }

  async function handleToggleMagazineStatus(magazine: Magazine) {
    try {
      const nextActive = !magazine.active;
      const updated = await inventoryApi.updateMagazineStatus(magazine.id, {
        active: nextActive,
      });
      setNotice(
        `Paiol "${updated.name}" ${
          updated.active ? "reativado" : "inativado"
        } com sucesso.`,
      );
      setRevision((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleUpdateLotStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForStatus) return;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      await inventoryApi.updateLotStatus(lotForStatus.id, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
      });
      setNotice(
        `Situação do lote "${lotForStatus.lotNumber}" atualizada para ${newStatus}.`,
      );
      setLotForStatus(null);
      setStatusReason("");
      setRevision((current) => current + 1);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function handleSplitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForSplit) return;
    setSplitSubmitting(true);
    setSplitError(null);
    try {
      const result = await inventoryApi.splitLot(lotForSplit.id, {
        destinationMagazineId: splitMagazineId,
        newLotNumber: splitNewLotNumber.trim(),
        quantity: Number(splitQuantity),
      });
      setNotice(
        `Lote "${lotForSplit.lotNumber}" desmembrado com sucesso gerando o lote "${result.childLot.lotNumber}".`,
      );
      setLotForSplit(null);
      setSplitNewLotNumber("");
      setSplitQuantity("");
      setSplitMagazineId("");
      setRevision((current) => current + 1);
    } catch (err) {
      setSplitError(errorMessage(err));
    } finally {
      setSplitSubmitting(false);
    }
  }

  const summary = data?.report;
  const expiredLotIds = new Set(summary?.expiredLots.map((lot) => lot.lotId) ?? []);
  const expiringLotIds = new Set(
    summary?.expiringLots.map((lot) => lot.lotId) ?? [],
  );
  const addForm = createFormByTab[activeTab];

  const totalNeqKg =
    summary?.byProduct.reduce(
      (sum, product) => sum + Number(product.neqKg),
      0,
    ) ?? 0;

  return (
    <>
      <header className="page-heading">
        <div className="page-heading__content">
          <span className="page-heading__icon">
            <Icon name="warehouse" size={24} />
          </span>
          <div>
            <p className="eyebrow">Governança</p>
            <h1>Estoque e WMS</h1>
            <p className="page-heading__description">
              Produtos, rastreabilidade de lotes, quarentena, capacidade NEQ e conformidade SFPC/R-105.
            </p>
          </div>
        </div>
        <span className="status-pill status-pill--available">API conectada</span>
      </header>

      {error && (
        <div className="inventory-alert inventory-alert--error" role="alert">
          <span>{error}</span>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setRevision((value) => value + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {notice && (
        <div className="inventory-alert inventory-alert--success" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fechar confirmação"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {summary && (
        <section className="inventory-metrics" aria-label="Resumo do estoque">
          <MetricCard
            label="Lotes com saldo"
            value={formatNumber(summary.totals.lotCount, 0)}
            detail="Lotes com quantidade física ativa"
          />
          <MetricCard
            label="Massa NEQ total"
            value={`${formatNumber(totalNeqKg, 2)} kg`}
            detail="Calculada a partir dos produtos cadastrados"
          />
          <MetricCard
            label="Em Quarentena / Bloqueio"
            value={formatNumber(
              Number(summary.totals.quarantinedQuantity) +
                Number(summary.totals.blockedQuantity),
              2,
            )}
            detail="Estoque retido sem autorização de saída"
            tone={
              Number(summary.totals.quarantinedQuantity) +
                Number(summary.totals.blockedQuantity) >
              0
                ? "warning"
                : "neutral"
            }
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
            detail="Bloqueados para saídas e reservas"
            tone={summary.expiredLots.length ? "danger" : "neutral"}
          />
        </section>
      )}

      <section
        className="inventory-panel panel"
        aria-labelledby="inventory-section-title"
      >
        <div className="inventory-toolbar">
          <div
            className="inventory-tabs"
            role="tablist"
            aria-label="Seções de estoque"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`inventory-tab ${
                  activeTab === tab.id ? "inventory-tab--active" : ""
                }`}
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
              <span aria-hidden="true">+</span>{" "}
              {addForm === "lot"
                ? "Receber lote"
                : addForm === "movement"
                  ? "Movimentar estoque"
                  : addForm === "product"
                    ? "Novo produto"
                    : "Novo paiol"}
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
                  onClick={() => changeTab("products")}
                >
                  Ver produtos
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => changeTab("lots")}
                >
                  Ver lotes
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => changeTab("movements")}
                >
                  Histórico de movimentações
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => changeTab("sfpc")}
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
                      onClick={() => changeTab("lots")}
                    >
                      Conferir lotes
                    </button>
                  </div>
                )}
            </section>
          )}

          {activeTab === "sfpc" && (
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
                      onChange={(e) => setSfpcYear(Number(e.target.value))}
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
                      onChange={(e) => setSfpcMonth(Number(e.target.value))}
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
                    onClick={() => setRevision((r) => r + 1)}
                  >
                    {sfpcLoading ? "Carregando..." : "Atualizar"}
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
                                <span title={`Compras: ${item.inflowBreakdown.purchases} | Devoluções: ${item.inflowBreakdown.returns} | Ajustes: ${item.inflowBreakdown.adjustments}`}>
                                  {formatNumber(Number(item.inflowBreakdown.total))}
                                </span>
                              </td>
                              <td>
                                <span title={`Vendas: ${item.outflowBreakdown.sales} | OS: ${item.outflowBreakdown.serviceOrders} | Ajustes: ${item.outflowBreakdown.adjustments}`}>
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
          )}

          {activeTab !== "overview" && activeTab !== "sfpc" && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Estoque e WMS</p>
                  <h2 id="inventory-section-title">
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                  </h2>
                </div>
                <span className="section-count">
                  {data
                    ? `${data[activeTab].meta.total} registros`
                    : "Carregando..."}
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
                      placeholder={`Buscar ${
                        activeTab === "products"
                          ? "por SKU ou nome"
                          : activeTab === "lots"
                            ? "por lote, fabricante ou produto"
                            : "por referência ou lote"
                      }`}
                      maxLength={100}
                    />
                  </label>
                  <button
                    className="button button--quiet"
                    type="submit"
                    disabled={loading}
                  >
                    Buscar
                  </button>
                  {loading && (
                    <span role="status" className="inventory-loading">
                      Atualizando...
                    </span>
                  )}
                </form>
              )}

              {!data ? (
                <p className="table-empty" role="status">
                  Carregando dados de estoque...
                </p>
              ) : activeTab === "products" ? (
                data.products.data.length === 0 ? (
                  <EmptyTable message="Nenhum produto corresponde à busca." />
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>SKU / produto</th>
                          <th>Tipo</th>
                          <th>PCE / classe</th>
                          <th>NEQ unitária</th>
                          <th>Unidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.products.data.map((product) => (
                          <tr key={product.id}>
                            <td>
                              <strong>{product.name}</strong>
                              <small>{product.sku}</small>
                            </td>
                            <td>{productTypeLabels[product.type]}</td>
                            <td>
                              {product.isPce
                                ? `PCE · ${product.riskClass}`
                                : "Não PCE"}
                            </td>
                            <td>
                              {product.isPce
                                ? `${formatNumber(
                                    Number(product.neqGrams),
                                    3,
                                  )} g`
                                : "—"}
                            </td>
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
                        <tr>
                          <th>Paiol</th>
                          <th>Situação</th>
                          <th>NEQ atual</th>
                          <th>Capacidade</th>
                          <th>Disponível</th>
                          <th>Licença até</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.magazines.data.map((magazine) => (
                          <tr key={magazine.id}>
                            <td>
                              <strong>{magazine.name}</strong>
                            </td>
                            <td>
                              {magazine.active ? (
                                <span className="stock-badge">Ativo</span>
                              ) : (
                                <span className="stock-badge stock-badge--danger">
                                  Inativo
                                </span>
                              )}
                            </td>
                            <td>
                              {formatNumber(Number(magazine.currentNeqKg))} kg
                            </td>
                            <td>
                              {formatNumber(Number(magazine.maxNeqCapacityKg))} kg
                            </td>
                            <td>
                              {formatNumber(Number(magazine.remainingNeqKg))} kg
                            </td>
                            <td>
                              {formatDateOnly(magazine.fireLicenseExpiresAt)}
                            </td>
                            <td>
                              <button
                                className="button button--quiet"
                                type="button"
                                onClick={() =>
                                  handleToggleMagazineStatus(magazine)
                                }
                              >
                                {magazine.active ? "Inativar" : "Reativar"}
                              </button>
                            </td>
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
                        {data.lots.data.map((lot) => (
                          <tr key={lot.id}>
                            <td>
                              <strong>{lot.lotNumber}</strong>
                              <small>
                                {lot.product.sku} · {lot.product.name}
                              </small>
                            </td>
                            <td>{lot.magazine.name}</td>
                            <td>
                              {formatNumber(Number(lot.quantity))}{" "}
                              {lot.product.unit}
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
                                  title={
                                    lot.statusReason ?? "Lote em quarentena"
                                  }
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
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.25rem",
                                }}
                              >
                                <button
                                  className="button button--quiet"
                                  type="button"
                                  onClick={() => {
                                    setLotForStatus(lot);
                                    setNewStatus(lot.status);
                                    setStatusReason(lot.statusReason ?? "");
                                    setStatusError(null);
                                  }}
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
                                  onClick={() => {
                                    setLotForSplit(lot);
                                    setSplitNewLotNumber(
                                      `${lot.lotNumber}-DESC`,
                                    );
                                    setSplitQuantity("");
                                    setSplitMagazineId("");
                                    setSplitError(null);
                                  }}
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
                )
              ) : (
                data.movements.data.length === 0 ? (
                  <EmptyTable message="Nenhuma movimentação corresponde à busca." />
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo</th>
                          <th>Lote / produto</th>
                          <th>Quantidade</th>
                          <th>Origem / destino</th>
                          <th>Referência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.movements.data.map((movement) => (
                          <tr key={movement.id}>
                            <td>{formatDateTime(movement.occurredAt)}</td>
                            <td>
                              <span className="stock-badge">
                                {movementLabels[movement.type]}
                              </span>
                            </td>
                            <td>
                              <strong>{movement.productLot.lotNumber}</strong>
                              <small>
                                {movement.productLot.product.name}
                              </small>
                            </td>
                            <td>
                              {formatNumber(Number(movement.quantity))}{" "}
                              {movement.productLot.product.unit}
                            </td>
                            <td>
                              {movement.sourceMagazine?.name ?? "—"}
                              {movement.destinationMagazine && (
                                <small>
                                  para {movement.destinationMagazine.name}
                                </small>
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

      {/* Modal para Mudança de Situação do Lote */}
      {lotForStatus && (
        <div
          className="form-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !statusSubmitting) {
              setLotForStatus(null);
            }
          }}
        >
          <section
            className="inventory-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lot-status-dialog-title"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Rastreabilidade e Quarentena</p>
                <h2 id="lot-status-dialog-title">
                  Situação do Lote: {lotForStatus.lotNumber}
                </h2>
              </div>
              <button
                className="button button--quiet"
                type="button"
                disabled={statusSubmitting}
                onClick={() => setLotForStatus(null)}
              >
                Fechar
              </button>
            </div>

            <form
              className="form-stack inventory-form"
              onSubmit={handleUpdateLotStatus}
            >
              {statusError && (
                <p className="form-error" role="alert">
                  {statusError}
                </p>
              )}
              <label className="field">
                <span>Situação Regulatória do Lote</span>
                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as ProductLotStatus)
                  }
                  required
                >
                  <option value="DISPONIVEL">Disponível (Liberado para saídas e reservas)</option>
                  <option value="QUARENTENA">Quarentena (Retido para conferência/análise)</option>
                  <option value="BLOQUEADO">Bloqueado (Interditado para saídas e entradas)</option>
                </select>
              </label>

              <label className="field">
                <span>Motivo da Situação {newStatus !== "DISPONIVEL" ? "(Obrigatório)" : "(Opcional)"}</span>
                <input
                  type="text"
                  maxLength={255}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Ex.: Laudo de inspeção, avaria física na caixa, retenção fiscal"
                  required={newStatus !== "DISPONIVEL"}
                />
              </label>

              <div className="form-actions">
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={statusSubmitting}
                  onClick={() => setLotForStatus(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={statusSubmitting}
                >
                  {statusSubmitting ? "Gravando..." : "Salvar Situação"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal para Desmembramento de Lote (Split) */}
      {lotForSplit && data && (
        <div
          className="form-scrim"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !splitSubmitting) {
              setLotForSplit(null);
            }
          }}
        >
          <section
            className="inventory-dialog panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lot-split-dialog-title"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Movimentação WMS</p>
                <h2 id="lot-split-dialog-title">
                  Desmembrar Lote: {lotForSplit.lotNumber}
                </h2>
              </div>
              <button
                className="button button--quiet"
                type="button"
                disabled={splitSubmitting}
                onClick={() => setLotForSplit(null)}
              >
                Fechar
              </button>
            </div>

            <form className="form-stack inventory-form" onSubmit={handleSplitLot}>
              {splitError && (
                <p className="form-error" role="alert">
                  {splitError}
                </p>
              )}
              <div style={{ padding: "0.5rem 0", fontSize: "0.9rem" }}>
                <span>Saldo atual do lote de origem: </span>
                <strong>
                  {formatNumber(Number(lotForSplit.quantity))} {lotForSplit.product.unit}
                </strong>
                <span> · Paiol atual: </span>
                <strong>{lotForSplit.magazine.name}</strong>
              </div>

              <label className="field">
                <span>Paiol de Destino do Novo Lote</span>
                <select
                  value={splitMagazineId}
                  onChange={(e) => setSplitMagazineId(e.target.value)}
                  required
                >
                  <option value="">Selecione o paiol de destino...</option>
                  {data.magazines.data
                    .filter((m) => m.active)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (Capacidade disp.: {formatNumber(Number(m.remainingNeqKg))} kg NEQ)
                      </option>
                    ))}
                </select>
              </label>

              <label className="field">
                <span>Identificador do Novo Lote Filho</span>
                <input
                  type="text"
                  maxLength={50}
                  value={splitNewLotNumber}
                  onChange={(e) => setSplitNewLotNumber(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span>Quantidade a Desmembrar ({lotForSplit.product.unit})</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(lotForSplit.quantity) - 0.01}
                  value={splitQuantity}
                  onChange={(e) => setSplitQuantity(e.target.value)}
                  placeholder={`Menor que ${lotForSplit.quantity}`}
                  required
                />
              </label>

              <div className="form-actions">
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={splitSubmitting}
                  onClick={() => setLotForSplit(null)}
                >
                  Cancelar
                </button>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={splitSubmitting}
                >
                  {splitSubmitting ? "Desmembrando..." : "Confirmar Desmembramento"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <p className="inventory-traceability-note">
        A API disponibiliza cadastro e movimentações com rastreabilidade integral SFPC.
        Edição ou exclusão direta de lotes e movimentações são bloqueadas para garantir
        conformidade regulatória e auditoria.
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
