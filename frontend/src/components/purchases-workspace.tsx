"use client";

import { Icon } from "@/components/icon";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  OrdersTab,
  SuppliersTab,
  SupplierModal,
  CreateOrderModal,
  ReceiveOrderModal,
  usePurchasesState,
} from "./purchases";

export function PurchasesWorkspace() {
  const {
    tab,
    setTab,
    purchases,
    suppliers,
    products,
    magazines,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    setPage,
    error,
    isSupplierModalOpen,
    setIsSupplierModalOpen,
    supLegalName,
    setSupLegalName,
    supTaxId,
    setSupTaxId,
    supHasCr,
    setSupHasCr,
    supCrNumber,
    setSupCrNumber,
    supCrExpiresAt,
    setSupCrExpiresAt,
    supAuthorizedClasses,
    setSupAuthorizedClasses,
    supSubmitting,
    supError,
    handleOpenNewSupplier,
    handleCreateSupplierSubmit,
    isOrderModalOpen,
    setIsOrderModalOpen,
    selectedSupplierId,
    setSelectedSupplierId,
    orderNotes,
    setOrderNotes,
    orderItems,
    setOrderItems,
    orderSubmitting,
    orderError,
    handleOpenNewOrder,
    handleCreateOrderSubmit,
    receivingPurchase,
    setReceivingPurchase,
    receiveDueDate,
    setReceiveDueDate,
    receiveInvoiceRef,
    setReceiveInvoiceRef,
    receiveBatches,
    setReceiveBatches,
    receiveSubmitting,
    receiveError,
    handleOpenReceive,
    handleReceiveSubmit,
    handleCancelOrder,
  } = usePurchasesState();

  useEscapeToClose(isSupplierModalOpen, () => setIsSupplierModalOpen(false));
  useModalFocusTrap(isSupplierModalOpen);
  useEscapeToClose(isOrderModalOpen, () => setIsOrderModalOpen(false));
  useModalFocusTrap(isOrderModalOpen);
  useEscapeToClose(Boolean(receivingPurchase), () => setReceivingPurchase(null));
  useModalFocusTrap(Boolean(receivingPurchase));

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão de Suprimentos</p>
          <h1 className="text-2xl font-bold">Compras e Fornecedores</h1>
          <p className="text-sm text-neutral-400">
            Pedidos de compra de insumos e mercadorias, fornecedores auditados e recebimento físico em paióis.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "purchases" ? (
            <button
              type="button"
              className="button button--primary flex items-center gap-2"
              onClick={handleOpenNewOrder}
            >
              <Icon name="briefcase" size={18} />
              Novo pedido de compra
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary flex items-center gap-2"
              onClick={handleOpenNewSupplier}
            >
              <Icon name="users" size={18} />
              Novo fornecedor
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 gap-4">
        <button
          type="button"
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "purchases"
              ? "border-teal-700 text-teal-800 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("purchases")}
        >
          Pedidos de Compra
        </button>
        <button
          type="button"
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "suppliers"
              ? "border-teal-700 text-teal-800 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("suppliers")}
        >
          Fornecedores
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {tab === "purchases" ? (
        <OrdersTab
          purchases={purchases}
          loading={loading}
          statusFilter={statusFilter}
          onStatusFilterChange={(status) => {
            setStatusFilter(status);
            setPage(1);
          }}
          onOpenReceive={handleOpenReceive}
          onCancelOrder={handleCancelOrder}
        />
      ) : (
        <SuppliersTab
          suppliers={suppliers}
          search={search}
          onSearchChange={setSearch}
        />
      )}

      {/* Modais */}
      <SupplierModal
        isOpen={isSupplierModalOpen}
        legalName={supLegalName}
        taxId={supTaxId}
        hasCr={supHasCr}
        crNumber={supCrNumber}
        crExpiresAt={supCrExpiresAt}
        authorizedClasses={supAuthorizedClasses}
        submitting={supSubmitting}
        error={supError}
        onLegalNameChange={setSupLegalName}
        onTaxIdChange={setSupTaxId}
        onHasCrChange={setSupHasCr}
        onCrNumberChange={setSupCrNumber}
        onCrExpiresAtChange={setSupCrExpiresAt}
        onToggleClass={(cls) =>
          setSupAuthorizedClasses((prev) =>
            prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
          )
        }
        onClose={() => setIsSupplierModalOpen(false)}
        onSubmit={handleCreateSupplierSubmit}
      />

      <CreateOrderModal
        isOpen={isOrderModalOpen}
        suppliers={suppliers}
        products={products}
        selectedSupplierId={selectedSupplierId}
        orderNotes={orderNotes}
        orderItems={orderItems}
        submitting={orderSubmitting}
        error={orderError}
        onSupplierChange={setSelectedSupplierId}
        onNotesChange={setOrderNotes}
        onAddItem={() =>
          setOrderItems((prev) => [...prev, { productId: "", quantity: 1, unitCost: 0 }])
        }
        onRemoveItem={(index) =>
          setOrderItems((prev) => prev.filter((_, idx) => idx !== index))
        }
        onUpdateItem={(index, updates) =>
          setOrderItems((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)),
          )
        }
        onClose={() => setIsOrderModalOpen(false)}
        onSubmit={handleCreateOrderSubmit}
      />

      <ReceiveOrderModal
        purchase={receivingPurchase}
        products={products}
        magazines={magazines}
        invoiceRef={receiveInvoiceRef}
        dueDate={receiveDueDate}
        batches={receiveBatches}
        submitting={receiveSubmitting}
        error={receiveError}
        onInvoiceRefChange={setReceiveInvoiceRef}
        onDueDateChange={setReceiveDueDate}
        onUpdateBatch={(index, updates) =>
          setReceiveBatches((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)),
          )
        }
        onClose={() => setReceivingPurchase(null)}
        onSubmit={handleReceiveSubmit}
      />
    </div>
  );
}
