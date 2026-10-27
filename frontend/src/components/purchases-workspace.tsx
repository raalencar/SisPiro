"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  inventoryApi,
  procurementApi,
  type Magazine,
  type PageResult,
  type Product,
  type Purchase,
  type PurchaseStatus,
  type Supplier,
} from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  OrdersTab,
  SuppliersTab,
  SupplierModal,
  CreateOrderModal,
  ReceiveOrderModal,
  type ReceiveBatchItem,
  errorMessage,
  receivedQuantity,
} from "./purchases";

export function PurchasesWorkspace() {
  const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");

  // Dados de Compras
  const [purchases, setPurchases] = useState<PageResult<Purchase> | null>(null);
  const [suppliers, setSuppliers] = useState<PageResult<Supplier> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Modal Novo Fornecedor
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supLegalName, setSupLegalName] = useState("");
  const [supTaxId, setSupTaxId] = useState("");
  const [supHasCr, setSupHasCr] = useState(false);
  const [supCrNumber, setSupCrNumber] = useState("");
  const [supCrExpiresAt, setSupCrExpiresAt] = useState("");
  const [supAuthorizedClasses, setSupAuthorizedClasses] = useState<string[]>([]);
  const [supSubmitting, setSupSubmitting] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);

  // Modal Novo Pedido de Compra
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: string; quantity: number; unitCost: number }>
  >([{ productId: "", quantity: 1, unitCost: 0 }]);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Modal de Recebimento de Compra
  const [receivingPurchase, setReceivingPurchase] = useState<Purchase | null>(null);
  const [receiveDueDate, setReceiveDueDate] = useState("");
  const [receiveInvoiceRef, setReceiveInvoiceRef] = useState("");
  const [receiveBatches, setReceiveBatches] = useState<ReceiveBatchItem[]>([]);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [purchasesRes, suppliersRes, productsRes, magazinesRes] =
          await Promise.all([
            procurementApi.getPurchases(page, statusFilter || undefined),
            procurementApi.getSuppliers(1, search.trim() || undefined),
            inventoryApi.getProducts(1),
            inventoryApi.getMagazines(),
          ]);

        if (current) {
          setPurchases(purchasesRes);
          setSuppliers(suppliersRes);
          setProducts(productsRes.data);
          setMagazines(magazinesRes.data);
        }
      } catch (err) {
        if (current) {
          setError(errorMessage(err));
        }
      } finally {
        if (current) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      current = false;
    };
  }, [page, statusFilter, search, reloadTrigger]);

  function handleOpenNewSupplier() {
    setSupLegalName("");
    setSupTaxId("");
    setSupHasCr(false);
    setSupCrNumber("");
    setSupCrExpiresAt("");
    setSupAuthorizedClasses([]);
    setSupError(null);
    setIsSupplierModalOpen(true);
  }

  async function handleSaveSupplier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSupSubmitting(true);
    setSupError(null);
    try {
      await procurementApi.createSupplier({
        legalName: supLegalName.trim(),
        taxId: supTaxId.replace(/\D/g, ""),
        hasCr: supHasCr,
        crNumber: supHasCr ? supCrNumber.trim() : undefined,
        crExpiresAt: supHasCr && supCrExpiresAt ? supCrExpiresAt : undefined,
        authorizedPceClasses: supHasCr ? supAuthorizedClasses : [],
      });
      setIsSupplierModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setSupError(errorMessage(err));
    } finally {
      setSupSubmitting(false);
    }
  }

  function handleOpenNewOrder() {
    setSelectedSupplierId(suppliers?.data[0]?.id || "");
    setOrderNotes("");
    setOrderItems([
      { productId: products[0]?.id || "", quantity: 1, unitCost: 0 },
    ]);
    setOrderError(null);
    setIsOrderModalOpen(true);
  }

  async function handleSaveOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSupplierId) {
      setOrderError("Selecione um fornecedor.");
      return;
    }
    if (orderItems.some((item) => !item.productId || item.quantity <= 0)) {
      setOrderError("Todos os itens devem ter um produto válido e quantidade maior que zero.");
      return;
    }
    setOrderSubmitting(true);
    setOrderError(null);
    try {
      await procurementApi.createPurchase({
        supplierId: selectedSupplierId,
        reference: orderNotes.trim() || undefined,
        items: orderItems.map((item) => ({
          productId: item.productId,
          orderedQuantity: item.quantity,
          unitCost: item.unitCost,
        })),
      });
      setIsOrderModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setOrderError(errorMessage(err));
    } finally {
      setOrderSubmitting(false);
    }
  }

  function handleOpenReceive(p: Purchase) {
    setReceivingPurchase(p);
    const today = new Date().toISOString().slice(0, 10);
    setReceiveDueDate(today);
    setReceiveInvoiceRef("");
    // Sugere recebimento para os itens que faltam receber
    const defaultBatches: ReceiveBatchItem[] = p.items
      .filter((item) => Number(item.orderedQuantity) > receivedQuantity(item))
      .map((item) => ({
        purchaseItemId: item.id,
        productId: item.productId,
        magazineId: magazines[0]?.id || "",
        lotNumber: `LOTE-${Date.now().toString().slice(-6)}`,
        quantity: Number(item.orderedQuantity) - receivedQuantity(item),
        manufacturedAt: today,
        expiresAt: today,
        manufacturerOrImporter: p.supplier?.legalName || "Fabricante",
      }));
    setReceiveBatches(defaultBatches);
    setReceiveError(null);
  }

  async function handleConfirmReceive(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!receivingPurchase || receiveBatches.length === 0) return;
    setReceiveSubmitting(true);
    setReceiveError(null);
    try {
      await procurementApi.receivePurchase(receivingPurchase.id, {
        dueDate: receiveDueDate,
        invoiceReference: receiveInvoiceRef.trim(),
        items: receiveBatches.map((batch) => ({
          purchaseItemId: batch.purchaseItemId,
          magazineId: batch.magazineId,
          lotNumber: batch.lotNumber,
          quantity: batch.quantity,
          manufacturedAt: batch.manufacturedAt,
          expiresAt: batch.expiresAt,
          manufacturerOrImporter: batch.manufacturerOrImporter,
        })),
      });
      setReceivingPurchase(null);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setReceiveError(errorMessage(err));
    } finally {
      setReceiveSubmitting(false);
    }
  }

  async function handleCancelOrder(id: string) {
    if (!window.confirm("Deseja realmente cancelar este pedido de compra?")) return;
    try {
      await procurementApi.cancelPurchase(id);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

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
        onSubmit={handleSaveSupplier}
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
          setOrderItems((prev) => [
            ...prev,
            { productId: products[0]?.id || "", quantity: 1, unitCost: 0 },
          ])
        }
        onRemoveItem={(index) =>
          setOrderItems((prev) => prev.filter((_, idx) => idx !== index))
        }
        onUpdateItem={(index, updates) =>
          setOrderItems((prev) =>
            prev.map((it, idx) => (idx === index ? { ...it, ...updates } : it)),
          )
        }
        onClose={() => setIsOrderModalOpen(false)}
        onSubmit={handleSaveOrder}
      />

      <ReceiveOrderModal
        purchase={receivingPurchase}
        products={products}
        magazines={magazines}
        dueDate={receiveDueDate}
        invoiceRef={receiveInvoiceRef}
        batches={receiveBatches}
        submitting={receiveSubmitting}
        error={receiveError}
        onDueDateChange={setReceiveDueDate}
        onInvoiceRefChange={setReceiveInvoiceRef}
        onUpdateBatch={(index, updates) =>
          setReceiveBatches((prev) =>
            prev.map((b, idx) => (idx === index ? { ...b, ...updates } : b)),
          )
        }
        onClose={() => setReceivingPurchase(null)}
        onSubmit={handleConfirmReceive}
      />
    </div>
  );
}
