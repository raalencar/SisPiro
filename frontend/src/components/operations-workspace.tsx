"use client";

import { Icon } from "@/components/icon";
import { PixModal } from "@/components/pix-modal";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import {
  BurningDossierModal,
  GtModal,
  NfseModal,
  OrderActionCard,
  OrderDetailsPane,
  OrdersTable,
  useOperationsState,
} from "./operations";

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="inventory-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function OperationsWorkspace() {
  const {
    orders,
    report,
    selectedId,
    selected,
    page,
    setPage,
    totalPages,
    statusFilter,
    setStatusFilter,
    searchInput,
    setSearchInput,
    from,
    setFrom,
    to,
    setTo,
    loading,
    error,
    action,
    actionError,
    submitting,
    customers,
    blasters,
    lots,
    referencesLoading,
    customerId,
    setCustomerId,
    contractedAmount,
    setContractedAmount,
    eventAt,
    setEventAt,
    eventLocation,
    setEventLocation,
    draftItems,
    setDraftItems,
    blasterId,
    setBlasterId,
    artNumber,
    setArtNumber,
    dueDate,
    setDueDate,
    reportNotes,
    setReportNotes,
    firedQuantities,
    setFiredQuantities,
    selectedLotIds,
    selectedCustomer,
    // Modais e Auxiliares
    isGtModalOpen,
    setIsGtModalOpen,
    gtOriginCity,
    setGtOriginCity,
    gtOriginState,
    setGtOriginState,
    gtDestCity,
    setGtDestCity,
    gtDestState,
    setGtDestState,
    gtPlate,
    setGtPlate,
    gtPlateState,
    setGtPlateState,
    gtDriverName,
    setGtDriverName,
    gtDriverCpf,
    setGtDriverCpf,
    gtDriverLicense,
    setGtDriverLicense,
    gtRoute,
    setGtRoute,
    gtSubmitting,
    gtError,
    isNfseModalOpen,
    setIsNfseModalOpen,
    nfseSubmitting,
    nfseError,
    nfseSuccess,
    isPixModalOpen,
    setIsPixModalOpen,
    pixData,
    pixLoading,
    isBurningOrderModalOpen,
    setIsBurningOrderModalOpen,
    // Ações
    reload,
    loadReferences,
    changeSelected,
    applyFilters,
    openAction,
    openEditOrder,
    closeAction,
    submitCreate,
    submitEdit,
    submitApprove,
    submitTransition,
    handleOpenGtModal,
    handleSubmitGt,
    handleOpenNfseModal,
    handleSubmitNfse,
    handleOpenPix,
    toast,
  } = useOperationsState();

  return (
    <div className="workspace operations-workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Operações · Shows e serviços pirotécnicos</p>
          <h1>Ordens de serviço</h1>
          <p>
            Ciclo de vida regulamentado: orçamento, aprovação com reserva
            atômica, montagem e encerramento com apuração de consumo real e
            sobras.
          </p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => openAction("create")}
        >
          <Icon name="spark" size={18} /> Novo orçamento
        </button>
      </header>

      {error && (
        <div className="inventory-alert inventory-alert--error" role="alert">
          <span>{error}</span>
          <button
            className="button button--quiet"
            type="button"
            onClick={reload}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {report && (
        <section
          className="operations-summary"
          aria-labelledby="operations-summary-heading"
        >
          <div className="operations-summary__heading">
            <h2 id="operations-summary-heading">Indicadores do período</h2>
            <p className="operations-summary__period">
              De {formatDateOnly(report.period.from)} a{" "}
              {formatDateOnly(report.period.to)} (base: data do evento)
            </p>
          </div>
          <div className="operations-metrics">
            <Metric
              detail="Total registrado"
              label="Ordens"
              value={String(report.totals.orderCount)}
            />
            <Metric
              detail="Receita contratada"
              label="Contratado"
              value={formatCurrency(Number(report.totals.contractedAmount))}
            />
            <Metric
              detail="Pendentes de precificação"
              label="Sem valor"
              value={String(report.totals.ordersWithoutContractedAmount)}
            />
          </div>
        </section>
      )}

      <section
        className="operations-panel panel"
        aria-labelledby="orders-list-heading"
      >
        <div className="operations-toolbar">
          <div>
            <p className="eyebrow">Listagem</p>
            <h2 id="orders-list-heading">Ordens cadastradas</h2>
          </div>
          <form
            className="operations-period"
            onSubmit={(event) => {
              event.preventDefault();
              reload();
            }}
          >
            <label>
              De
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </form>
        </div>

        <OrdersTable
          orders={orders}
          selectedId={selectedId}
          loading={loading}
          page={page}
          totalPages={totalPages}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onPageChange={setPage}
          onApplyFilters={applyFilters}
          onReload={reload}
          onChangeSelected={changeSelected}
        />
      </section>

      {selected && (
        <OrderDetailsPane
          order={selected}
          pixLoading={pixLoading}
          onOpenEditOrder={openEditOrder}
          onOpenAction={openAction}
          onOpenGtModal={handleOpenGtModal}
          onOpenNfseModal={handleOpenNfseModal}
          onOpenPixModal={handleOpenPix}
          onOpenBurningOrderModal={() => setIsBurningOrderModalOpen(true)}
          onSetFiredQuantities={setFiredQuantities}
        />
      )}

      <OrderActionCard
        action={action}
        selected={selected}
        onClose={closeAction}
        referencesLoading={referencesLoading}
        actionError={actionError}
        onReloadReferences={loadReferences}
        customerId={customerId}
        onCustomerIdChange={setCustomerId}
        selectedCustomer={selectedCustomer}
        customers={customers}
        contractedAmount={contractedAmount}
        onContractedAmountChange={setContractedAmount}
        eventAt={eventAt}
        onEventAtChange={setEventAt}
        eventLocation={eventLocation}
        onEventLocationChange={setEventLocation}
        draftItems={draftItems}
        onDraftItemsChange={setDraftItems}
        lots={lots}
        selectedLotIds={selectedLotIds}
        onSubmitCreate={submitCreate}
        onSubmitEdit={submitEdit}
        blasterId={blasterId}
        onBlasterIdChange={setBlasterId}
        blasters={blasters}
        artNumber={artNumber}
        onArtNumberChange={setArtNumber}
        onSubmitApprove={submitApprove}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        reportNotes={reportNotes}
        onReportNotesChange={setReportNotes}
        firedQuantities={firedQuantities}
        onFiredQuantitiesChange={setFiredQuantities}
        onSubmitTransition={submitTransition}
        submitting={submitting}
      />

      <GtModal
        isOpen={isGtModalOpen}
        onClose={() => setIsGtModalOpen(false)}
        order={selected}
        originCity={gtOriginCity}
        onOriginCityChange={setGtOriginCity}
        originState={gtOriginState}
        onOriginStateChange={setGtOriginState}
        destCity={gtDestCity}
        onDestCityChange={setGtDestCity}
        destState={gtDestState}
        onDestStateChange={setGtDestState}
        plate={gtPlate}
        onPlateChange={setGtPlate}
        plateState={gtPlateState}
        onPlateStateChange={setGtPlateState}
        driverCpf={gtDriverCpf}
        onDriverCpfChange={setGtDriverCpf}
        driverLicense={gtDriverLicense}
        onDriverLicenseChange={setGtDriverLicense}
        driverName={gtDriverName}
        onDriverNameChange={setGtDriverName}
        route={gtRoute}
        onRouteChange={setGtRoute}
        submitting={gtSubmitting}
        error={gtError}
        onSubmit={handleSubmitGt}
      />

      <NfseModal
        isOpen={isNfseModalOpen}
        onClose={() => setIsNfseModalOpen(false)}
        order={selected}
        submitting={nfseSubmitting}
        error={nfseError}
        success={nfseSuccess}
        onSubmit={handleSubmitNfse}
      />

      <PixModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        pixData={pixData}
        onPaymentConfirmed={() => {
          setIsPixModalOpen(false);
          toast.success("Pagamento da OS liquidado com sucesso via PIX!");
          reload();
        }}
      />

      <BurningDossierModal
        isOpen={isBurningOrderModalOpen}
        onClose={() => setIsBurningOrderModalOpen(false)}
        order={selected}
      />
    </div>
  );
}
