"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  inventoryApi,
  type Magazine,
  type ProductLot,
  type ProductLotStatus,
  type SfpcMonthlyReport,
} from "@/lib/api";
import { Icon } from "@/components/icon";
import {
  InventoryCreateForm,
  type InventoryFormType,
} from "@/components/inventory-create-form";
import { formatNumber } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  createFormByTab,
  errorMessage,
  LotsTab,
  LotSplitModal,
  LotStatusModal,
  MagazinesTab,
  MetricCard,
  MovementsTab,
  OverviewTab,
  PaginationNav,
  ProductsTab,
  SfpcOfficialModal,
  SfpcTab,
  tabs,
  type InventoryData,
  type Tab,
} from "./inventory";

type Props = {
  initialTab?: Tab;
};

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
  const [showSfpcOfficialModal, setShowSfpcOfficialModal] = useState(false);

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

  const hasAnyModalOpen =
    Boolean(form) ||
    Boolean(lotForStatus) ||
    Boolean(lotForSplit) ||
    showSfpcOfficialModal;

  useEscapeToClose(hasAnyModalOpen, () => {
    setForm(null);
    setLotForStatus(null);
    setLotForSplit(null);
    setShowSfpcOfficialModal(false);
  });
  useModalFocusTrap(hasAnyModalOpen);

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
            <OverviewTab
              summary={summary ?? null}
              loading={loading}
              onChangeTab={changeTab}
            />
          )}

          {activeTab === "sfpc" && (
            <SfpcTab
              sfpcReport={sfpcReport}
              sfpcYear={sfpcYear}
              sfpcMonth={sfpcMonth}
              sfpcLoading={sfpcLoading}
              onYearChange={setSfpcYear}
              onMonthChange={setSfpcMonth}
              onRefresh={() => setRevision((r) => r + 1)}
              onOpenOfficialModal={() => setShowSfpcOfficialModal(true)}
            />
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

              <form
                className="inventory-search"
                role="search"
                aria-label={`Filtrar ${tabs.find((t) => t.id === activeTab)?.label}`}
                onSubmit={applySearch}
              >
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    activeTab === "products"
                      ? "Buscar por nome ou SKU..."
                      : activeTab === "lots"
                        ? "Buscar por número do lote, fabricante ou produto..."
                        : activeTab === "magazines"
                          ? "Buscar por nome do paiol..."
                          : "Buscar por documento ou número de lote..."
                  }
                />
                <button className="button button--quiet" type="submit">
                  Buscar
                </button>
                {appliedSearch && (
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setAppliedSearch("");
                      setPage(1);
                      setLoading(true);
                    }}
                  >
                    Limpar
                  </button>
                )}
              </form>

              {!data ? (
                <p className="table-empty" role="status">
                  Carregando dados de estoque...
                </p>
              ) : activeTab === "products" ? (
                <ProductsTab products={data.products.data} />
              ) : activeTab === "magazines" ? (
                <MagazinesTab
                  magazines={data.magazines.data}
                  onToggleStatus={handleToggleMagazineStatus}
                />
              ) : activeTab === "lots" ? (
                <LotsTab
                  lots={data.lots.data}
                  expiredLotIds={expiredLotIds}
                  expiringLotIds={expiringLotIds}
                  onOpenStatusModal={(lot) => {
                    setLotForStatus(lot);
                    setNewStatus(lot.status);
                    setStatusReason(lot.statusReason ?? "");
                    setStatusError(null);
                  }}
                  onOpenSplitModal={(lot) => {
                    setLotForSplit(lot);
                    setSplitNewLotNumber(`${lot.lotNumber}-DESC`);
                    setSplitQuantity("");
                    setSplitMagazineId("");
                    setSplitError(null);
                  }}
                />
              ) : (
                <MovementsTab movements={data.movements.data} />
              )}

              {data && (
                <PaginationNav
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
      <LotStatusModal
        lot={lotForStatus}
        newStatus={newStatus}
        statusReason={statusReason}
        statusSubmitting={statusSubmitting}
        statusError={statusError}
        onNewStatusChange={setNewStatus}
        onStatusReasonChange={setStatusReason}
        onClose={() => setLotForStatus(null)}
        onSubmit={handleUpdateLotStatus}
      />

      {/* Modal para Desmembramento de Lote (Split) */}
      {data && (
        <LotSplitModal
          lot={lotForSplit}
          magazines={data.magazines.data}
          splitMagazineId={splitMagazineId}
          splitNewLotNumber={splitNewLotNumber}
          splitQuantity={splitQuantity}
          splitSubmitting={splitSubmitting}
          splitError={splitError}
          onSplitMagazineIdChange={setSplitMagazineId}
          onSplitNewLotNumberChange={setSplitNewLotNumber}
          onSplitQuantityChange={setSplitQuantity}
          onClose={() => setLotForSplit(null)}
          onSubmit={handleSplitLot}
        />
      )}

      <p className="inventory-traceability-note">
        A API disponibiliza cadastro e movimentações com rastreabilidade integral SFPC.
        Edição ou exclusão direta de lotes e movimentações são bloqueadas para garantir
        conformidade regulatória e auditoria.
      </p>

      {/* Modal do Espelho Oficial Militar do Mapa SFPC (R-105) */}
      <SfpcOfficialModal
        isOpen={showSfpcOfficialModal}
        sfpcReport={sfpcReport}
        sfpcMonth={sfpcMonth}
        sfpcYear={sfpcYear}
        onClose={() => setShowSfpcOfficialModal(false)}
      />

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
