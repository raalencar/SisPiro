"use client";

import { Icon } from "@/components/icon";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  FiscalTable,
  EmitNfeModal,
  EmitNfceModal,
  EmitNfseModal,
  CancelFiscalModal,
  DanfeViewModal,
  useFiscalState,
} from "./fiscal";

export function FiscalWorkspace() {
  const {
    documents,
    loading,
    error,
    actionSuccess,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    searchTerm,
    setSearchTerm,
    sales,
    serviceOrders,
    isNFeModalOpen,
    setIsNFeModalOpen,
    nfeSaleId,
    setNfeSaleId,
    nfeNature,
    setNfeNature,
    nfeNotes,
    setNfeNotes,
    nfeSubmitting,
    nfeError,
    isNFCeModalOpen,
    setIsNFCeModalOpen,
    nfceSaleId,
    setNfceSaleId,
    nfceSubmitting,
    nfceError,
    isNFSeModalOpen,
    setIsNFSeModalOpen,
    nfseOrderId,
    setNfseOrderId,
    nfseDescription,
    setNfseDescription,
    nfseSubmitting,
    nfseError,
    cancelDoc,
    setCancelDoc,
    cancelReason,
    setCancelReason,
    cancelSubmitting,
    cancelError,
    viewDanfeDoc,
    setViewDanfeDoc,
    copiedKey,
    copyAccessKey,
    handleEmitNFe,
    handleEmitNFCe,
    handleEmitNFSe,
    handleCancelDocument,
  } = useFiscalState();

  useEscapeToClose(isNFeModalOpen, () => !nfeSubmitting && setIsNFeModalOpen(false));
  useModalFocusTrap(isNFeModalOpen);

  useEscapeToClose(isNFCeModalOpen, () => !nfceSubmitting && setIsNFCeModalOpen(false));
  useModalFocusTrap(isNFCeModalOpen);

  useEscapeToClose(isNFSeModalOpen, () => !nfseSubmitting && setIsNFSeModalOpen(false));
  useModalFocusTrap(isNFSeModalOpen);

  useEscapeToClose(Boolean(cancelDoc), () => !cancelSubmitting && setCancelDoc(null));
  useModalFocusTrap(Boolean(cancelDoc));

  useEscapeToClose(Boolean(viewDanfeDoc), () => setViewDanfeDoc(null));
  useModalFocusTrap(Boolean(viewDanfeDoc));

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Módulo Fiscal & Faturamento</p>
          <h1 className="text-2xl font-bold">Documentos Fiscais Eletrônicos</h1>
          <p className="text-sm text-neutral-400">
            Emissão de NF-e (Modelo 55), NFC-e (Modelo 65) e NFS-e de Serviços
            Pirotécnicos com integração SEFAZ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="button button--secondary flex items-center gap-2"
            onClick={() => setIsNFCeModalOpen(true)}
          >
            <Icon name="receipt" size={18} />
            Emitir NFC-e (Balcão)
          </button>
          <button
            type="button"
            className="button button--secondary flex items-center gap-2"
            onClick={() => setIsNFSeModalOpen(true)}
          >
            <Icon name="spark" size={18} />
            Emitir NFS-e (Serviços)
          </button>
          <button
            type="button"
            className="button button--primary flex items-center gap-2"
            onClick={() => setIsNFeModalOpen(true)}
          >
            <Icon name="receipt" size={18} />
            Emitir NF-e (Modelo 55)
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
          <label htmlFor="search-fiscal-input" className="sr-only">
            Buscar Documento
          </label>
          <input
            id="search-fiscal-input"
            type="search"
            placeholder="Buscar por número, chave SEFAZ ou cliente..."
            className="form-input"
            style={{ width: "320px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <label htmlFor="filter-type-select" className="sr-only">
            Filtrar por Tipo
          </label>
          <select
            id="filter-type-select"
            className="form-input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Todos os modelos</option>
            <option value="NFE">NF-e (Mod. 55)</option>
            <option value="NFCE">NFC-e (Mod. 65)</option>
            <option value="NFSE">NFS-e (Serviços)</option>
          </select>

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
            <option value="AUTORIZADO">Autorizado</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="REJEITADO">Rejeitado</option>
          </select>
        </div>
      </div>

      {/* Tabela de Documentos Fiscais */}
      <FiscalTable
        documents={documents.data}
        loading={loading}
        copiedKey={copiedKey}
        onCopyKey={copyAccessKey}
        onViewDanfe={(doc) => setViewDanfeDoc(doc)}
        onOpenCancelModal={(doc) => {
          setCancelDoc(doc);
          setCancelReason("");
        }}
      />

      {/* Modal Emissão NF-e */}
      <EmitNfeModal
        isOpen={isNFeModalOpen}
        sales={sales}
        saleId={nfeSaleId}
        nature={nfeNature}
        notes={nfeNotes}
        submitting={nfeSubmitting}
        error={nfeError}
        onSaleIdChange={setNfeSaleId}
        onNatureChange={setNfeNature}
        onNotesChange={setNfeNotes}
        onClose={() => !nfeSubmitting && setIsNFeModalOpen(false)}
        onSubmit={handleEmitNFe}
      />

      {/* Modal Emissão NFC-e */}
      <EmitNfceModal
        isOpen={isNFCeModalOpen}
        sales={sales}
        saleId={nfceSaleId}
        submitting={nfceSubmitting}
        error={nfceError}
        onSaleIdChange={setNfceSaleId}
        onClose={() => !nfceSubmitting && setIsNFCeModalOpen(false)}
        onSubmit={handleEmitNFCe}
      />

      {/* Modal Emissão NFS-e */}
      <EmitNfseModal
        isOpen={isNFSeModalOpen}
        serviceOrders={serviceOrders}
        orderId={nfseOrderId}
        description={nfseDescription}
        submitting={nfseSubmitting}
        error={nfseError}
        onOrderIdChange={setNfseOrderId}
        onDescriptionChange={setNfseDescription}
        onClose={() => !nfseSubmitting && setIsNFSeModalOpen(false)}
        onSubmit={handleEmitNFSe}
      />

      {/* Modal Cancelamento Fiscal */}
      <CancelFiscalModal
        doc={cancelDoc}
        reason={cancelReason}
        submitting={cancelSubmitting}
        error={cancelError}
        onReasonChange={setCancelReason}
        onClose={() => !cancelSubmitting && setCancelDoc(null)}
        onSubmit={handleCancelDocument}
      />

      {/* Modal Visualização DANFE Simplificada */}
      <DanfeViewModal
        doc={viewDanfeDoc}
        onClose={() => setViewDanfeDoc(null)}
      />
    </div>
  );
}
