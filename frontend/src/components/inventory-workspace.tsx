"use client";

import { Icon } from "@/components/icon";
import {
  InventoryCreateForm,
} from "@/components/inventory-create-form";
import { formatNumber } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
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
  type Tab,
  useInventoryState,
} from "./inventory";

type Props = {
  initialTab?: Tab;
};

export function InventoryWorkspace({ initialTab = "overview" }: Props) {
  const {
    activeTab,
    setPage,
    searchInput,
    setSearchInput,
    data,
    loading,
    setLoading,
    error,
    setError,
    notice,
    setNotice,
    form,
    setForm,
    sfpcReport,
    sfpcYear,
    setSfpcYear,
    sfpcMonth,
    setSfpcMonth,
    sfpcLoading,
    showSfpcOfficialModal,
    setShowSfpcOfficialModal,
    lotForStatus,
    setLotForStatus,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    statusSubmitting,
    statusError,
    lotForSplit,
    setLotForSplit,
    splitMagazineId,
    setSplitMagazineId,
    splitNewLotNumber,
    setSplitNewLotNumber,
    splitQuantity,
    setSplitQuantity,
    splitSubmitting,
    splitError,
    changeTab,
    applySearch,
    created,
    handleToggleMagazineStatus,
    handleUpdateLotStatus,
    handleSplitLot,
    summary,
    expiredLotIds,
    expiringLotIds,
    addForm,
    totalNeqKg,
    setRevision,
  } = useInventoryState(initialTab);

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
            aria-label="Dispensar aviso"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <section className="metric-strip" aria-label="Métricas do inventário">
        <MetricCard
          label="Lotes com saldo"
          value={formatNumber(summary?.totals.lotCount ?? 0, 0)}
          detail="Lotes com quantidade física ativa"
        />
        <MetricCard
          label="Massa NEQ em estoque"
          value={`${formatNumber(totalNeqKg, 2)} kg`}
          detail="Calculada a partir dos produtos cadastrados"
        />
        <MetricCard
          label="Em Quarentena / Bloqueio"
          value={formatNumber(
            Number(summary?.totals.quarantinedQuantity ?? 0) +
              Number(summary?.totals.blockedQuantity ?? 0),
            2,
          )}
          detail="Estoque retido sem autorização de saída"
          tone={
            Number(summary?.totals.quarantinedQuantity ?? 0) +
              Number(summary?.totals.blockedQuantity ?? 0) >
            0
              ? "warning"
              : "neutral"
          }
        />
        <MetricCard
          label={`Vencem em ${summary?.expiryWindowDays ?? 30} dias`}
          value={formatNumber(summary?.expiringLots.length ?? 0, 0)}
          detail="Lotes dentro da janela de validade"
          tone={(summary?.expiringLots.length ?? 0) > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Lotes vencidos"
          value={formatNumber(summary?.expiredLots.length ?? 0, 0)}
          detail="Bloqueados para saídas e reservas"
          tone={(summary?.expiredLots.length ?? 0) > 0 ? "danger" : "neutral"}
        />
      </section>

      <nav className="tab-strip" aria-label="Seções do inventário">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-strip__item ${
              activeTab === tab.id ? "tab-strip__item--active" : ""
            }`}
            onClick={() => changeTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {activeTab !== "overview" && activeTab !== "sfpc" && (
        <div className="inventory-toolbar">
          <form className="inventory-search" onSubmit={applySearch}>
            <input
              type="search"
              aria-label={`Buscar em ${activeTab}`}
              placeholder="Digite e pressione Enter..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <button className="button button--quiet" type="submit">
              Buscar
            </button>
          </form>
          {addForm && (
            <button
              className="button button--primary"
              type="button"
              onClick={() => setForm(addForm)}
            >
              Novo registro
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-state" role="status">
          <p>Carregando dados de estoque...</p>
        </div>
      ) : activeTab === "overview" ? (
        <OverviewTab
          summary={summary ?? null}
          loading={loading}
          onChangeTab={changeTab}
        />
      ) : activeTab === "products" ? (
        <ProductsTab products={data?.products?.data || []} />
      ) : activeTab === "magazines" ? (
        <MagazinesTab
          magazines={data?.magazines?.data || []}
          onToggleStatus={handleToggleMagazineStatus}
        />
      ) : activeTab === "lots" ? (
        <LotsTab
          lots={data?.lots?.data || []}
          expiredLotIds={expiredLotIds}
          expiringLotIds={expiringLotIds}
          onOpenStatusModal={(lot) => {
            setLotForStatus(lot);
            setNewStatus(lot.status);
            setStatusReason("");
          }}
          onOpenSplitModal={(lot) => {
            setLotForSplit(lot);
            setSplitMagazineId(lot.magazine.id);
            setSplitNewLotNumber(`${lot.lotNumber}-SPLIT`);
            setSplitQuantity("");
          }}
        />
      ) : activeTab === "movements" ? (
        <MovementsTab movements={data?.movements?.data || []} />
      ) : activeTab === "sfpc" ? (
        <SfpcTab
          sfpcReport={sfpcReport}
          sfpcYear={sfpcYear}
          sfpcMonth={sfpcMonth}
          sfpcLoading={sfpcLoading}
          onYearChange={setSfpcYear}
          onMonthChange={setSfpcMonth}
          onRefresh={() => setRevision((v) => v + 1)}
          onOpenOfficialModal={() => setShowSfpcOfficialModal(true)}
        />
      ) : null}

      {activeTab !== "overview" &&
        activeTab !== "sfpc" &&
        data?.[activeTab]?.meta && (
          <PaginationNav
            result={data[activeTab]!}
            onChange={(nextPage) => {
              setLoading(true);
              setPage(nextPage);
            }}
          />
        )}

      {/* Modal de Criação */}
      {form && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-modal-title"
        >
          <div className="modal-content">
            <h2 id="inventory-modal-title" className="sr-only">
              Criar registro em estoque
            </h2>
            <InventoryCreateForm
              type={form}
              products={data?.products?.data || []}
              magazines={data?.magazines?.data || []}
              lots={data?.lots?.data || []}
              onClose={() => setForm(null)}
              onCreated={created}
            />
          </div>
        </div>
      )}

      {/* Modal de Alteração de Situação/Quarentena */}
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

      {/* Modal de Desmembramento de Lote (Split) */}
      <LotSplitModal
        lot={lotForSplit}
        magazines={data?.magazines?.data || []}
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

      {/* Modal Espelho Oficial Militar SFPC (R-105) */}
      <SfpcOfficialModal
        isOpen={showSfpcOfficialModal}
        sfpcReport={sfpcReport}
        sfpcYear={sfpcYear}
        sfpcMonth={sfpcMonth}
        onClose={() => setShowSfpcOfficialModal(false)}
      />
    </>
  );
}
