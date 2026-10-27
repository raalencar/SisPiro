"use client";

import { Icon } from "@/components/icon";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  CreateGtModal,
  GtTable,
  PrintGtModal,
  UpdateGtStatusModal,
  useComplianceState,
} from "./compliance";

export function ComplianceWorkspace() {
  const {
    guides,
    loading,
    error,
    actionSuccess,
    filterStatus,
    setFilterStatus,
    searchTerm,
    setSearchTerm,
    magazines,
    blasters,
    fiscalDocs,
    serviceOrders,
    products,
    lots,
    isCreateModalOpen,
    setIsCreateModalOpen,
    sourceMagazineId,
    setSourceMagazineId,
    fiscalDocumentId,
    setFiscalDocumentId,
    serviceOrderId,
    setServiceOrderId,
    validFrom,
    setValidFrom,
    validUntil,
    setValidUntil,
    originCity,
    setOriginCity,
    originState,
    setOriginState,
    destinationCity,
    setDestinationCity,
    destinationState,
    setDestinationState,
    routeDescription,
    setRouteDescription,
    vehiclePlate,
    setVehiclePlate,
    vehiclePlateState,
    setVehiclePlateState,
    vehicleModel,
    setVehicleModel,
    driverName,
    setDriverName,
    driverCpf,
    setDriverCpf,
    driverLicense,
    setDriverLicense,
    hasMopp,
    setHasMopp,
    blasterId,
    setBlasterId,
    notes,
    setNotes,
    items,
    submitting,
    modalError,
    viewGuide,
    setViewGuide,
    statusDoc,
    setStatusDoc,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    statusSubmitting,
    statusError,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    estimatedNeqKg,
    handleCreateGuide,
    handleUpdateStatus,
  } = useComplianceState();

  // Acessibilidade
  useEscapeToClose(isCreateModalOpen, () => !submitting && setIsCreateModalOpen(false));
  useModalFocusTrap(isCreateModalOpen);

  useEscapeToClose(Boolean(viewGuide), () => setViewGuide(null));
  useModalFocusTrap(Boolean(viewGuide));

  useEscapeToClose(Boolean(statusDoc), () => !statusSubmitting && setStatusDoc(null));
  useModalFocusTrap(Boolean(statusDoc));

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Exército Brasileiro · R-105 / DFPC / SFPC</p>
          <h1 className="text-2xl font-bold">
            Compliance & Guias de Tráfego Militar
          </h1>
          <p className="text-sm text-neutral-400">
            Autorização e rastreio para transporte rodoviário de Produtos
            Controlados pelo Exército (PCE).
          </p>
        </div>
        <div>
          <button
            type="button"
            className="button button--primary flex items-center gap-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Icon name="shield" size={18} />
            Emitir Guia de Tráfego (GT)
          </button>
        </div>
      </header>

      {/* Alertas */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <p>{error}</p>
        </div>
      )}
      {actionSuccess && (
        <div className="alert alert-success" role="status">
          <p>{actionSuccess}</p>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="search-gt-input" className="sr-only">
            Buscar Guia
          </label>
          <input
            id="search-gt-input"
            type="search"
            placeholder="Buscar por nº da guia, destino ou motorista..."
            className="form-input"
            style={{ width: "320px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <label htmlFor="filter-status-select" className="sr-only">
            Filtrar por Status
          </label>
          <select
            id="filter-status-select"
            className="form-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="EM_TRANSITO">Em Trânsito</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Tabela de Guias de Tráfego */}
      <GtTable
        guides={guides.data}
        loading={loading}
        onViewGuide={(g) => setViewGuide(g)}
        onQuickDispatch={(g) => {
          setStatusDoc(g);
          setNewStatus("EM_TRANSITO");
          setStatusReason("");
        }}
        onOpenStatusModal={(g) => {
          setStatusDoc(g);
          setNewStatus(g.status === "EMITIDA" ? "CONCLUIDA" : "CANCELADA");
          setStatusReason("");
        }}
      />

      {/* Modal Emissão de GT */}
      <CreateGtModal
        isOpen={isCreateModalOpen}
        submitting={submitting}
        modalError={modalError}
        magazines={magazines}
        fiscalDocs={fiscalDocs}
        serviceOrders={serviceOrders}
        blasters={blasters}
        products={products}
        lots={lots}
        sourceMagazineId={sourceMagazineId}
        fiscalDocumentId={fiscalDocumentId}
        serviceOrderId={serviceOrderId}
        blasterId={blasterId}
        validFrom={validFrom}
        validUntil={validUntil}
        originCity={originCity}
        originState={originState}
        destinationCity={destinationCity}
        destinationState={destinationState}
        routeDescription={routeDescription}
        vehiclePlate={vehiclePlate}
        vehiclePlateState={vehiclePlateState}
        vehicleModel={vehicleModel}
        driverName={driverName}
        driverCpf={driverCpf}
        driverLicense={driverLicense}
        hasMopp={hasMopp}
        notes={notes}
        items={items}
        estimatedNeqKg={estimatedNeqKg}
        onSourceMagazineIdChange={setSourceMagazineId}
        onFiscalDocumentIdChange={setFiscalDocumentId}
        onServiceOrderIdChange={setServiceOrderId}
        onBlasterIdChange={setBlasterId}
        onValidFromChange={setValidFrom}
        onValidUntilChange={setValidUntil}
        onOriginCityChange={setOriginCity}
        onOriginStateChange={setOriginState}
        onDestinationCityChange={setDestinationCity}
        onDestinationStateChange={setDestinationState}
        onRouteChange={setRouteDescription}
        onVehiclePlateChange={setVehiclePlate}
        onVehiclePlateStateChange={setVehiclePlateState}
        onVehicleModelChange={setVehicleModel}
        onDriverNameChange={setDriverName}
        onDriverCpfChange={setDriverCpf}
        onDriverLicenseChange={setDriverLicense}
        onHasMoppChange={setHasMopp}
        onNotesChange={setNotes}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onItemChange={handleItemChange}
        onClose={() => !submitting && setIsCreateModalOpen(false)}
        onSubmit={handleCreateGuide}
      />

      {/* Modal de Impressão Oficial Militar */}
      <PrintGtModal
        guide={viewGuide}
        onClose={() => setViewGuide(null)}
      />

      {/* Modal Atualização de Status da GT */}
      <UpdateGtStatusModal
        guide={statusDoc}
        newStatus={newStatus}
        statusReason={statusReason}
        statusSubmitting={statusSubmitting}
        statusError={statusError}
        onNewStatusChange={setNewStatus}
        onStatusReasonChange={setStatusReason}
        onClose={() => !statusSubmitting && setStatusDoc(null)}
        onSubmit={handleUpdateStatus}
      />
    </div>
  );
}
