"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import {
  errorMessage,
  receivedQuantity,
} from "./types";
import { type ReceiveBatchItem } from "./receive-order-modal";

export function usePurchasesState() {
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

  async function handleCreateSupplierSubmit(e: FormEvent) {
    e.preventDefault();
    setSupSubmitting(true);
    setSupError(null);

    try {
      await procurementApi.createSupplier({
        legalName: supLegalName.trim(),
        taxId: supTaxId.trim(),
        hasCr: supHasCr,
        crNumber: supHasCr ? supCrNumber.trim() || undefined : undefined,
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
    setOrderItems([{ productId: products[0]?.id || "", quantity: 1, unitCost: 0 }]);
    setOrderError(null);
    setIsOrderModalOpen(true);
  }

  async function handleCreateOrderSubmit(e: FormEvent) {
    e.preventDefault();
    setOrderSubmitting(true);
    setOrderError(null);

    try {
      const validItems = orderItems
        .filter((it) => it.productId && it.quantity > 0)
        .map((it) => ({
          productId: it.productId,
          orderedQuantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
        }));

      if (validItems.length === 0) {
        setOrderError("Adicione pelo menos um item válido ao pedido.");
        setOrderSubmitting(false);
        return;
      }

      await procurementApi.createPurchase({
        supplierId: selectedSupplierId,
        reference: orderNotes.trim() || undefined,
        items: validItems,
      });

      setIsOrderModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setOrderError(errorMessage(err));
    } finally {
      setOrderSubmitting(false);
    }
  }

  function handleOpenReceive(purchase: Purchase) {
    setReceivingPurchase(purchase);
    setReceiveDueDate("");
    setReceiveInvoiceRef("");
    setReceiveError(null);

    const initialBatches: ReceiveBatchItem[] = [];
    for (const item of purchase.items) {
      const pending = Number(item.orderedQuantity) - receivedQuantity(item);
      if (pending > 0) {
        initialBatches.push({
          purchaseItemId: item.id,
          productId: item.productId,
          magazineId: magazines[0]?.id || "",
          lotNumber: `LOTE-${Date.now().toString().slice(-4)}`,
          quantity: pending,
          manufacturedAt: new Date().toISOString().split("T")[0],
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          manufacturerOrImporter: purchase.supplier?.legalName || "Fabricante",
        });
      }
    }
    setReceiveBatches(initialBatches);
  }

  async function handleReceiveSubmit(e: FormEvent) {
    e.preventDefault();
    if (!receivingPurchase) return;
    setReceiveSubmitting(true);
    setReceiveError(null);

    try {
      await procurementApi.receivePurchase(receivingPurchase.id, {
        invoiceReference: receiveInvoiceRef.trim(),
        dueDate: receiveDueDate || new Date().toISOString().split("T")[0],
        items: receiveBatches.map((b) => ({
          purchaseItemId: b.purchaseItemId,
          magazineId: b.magazineId,
          lotNumber: b.lotNumber.trim(),
          quantity: Number(b.quantity),
          manufacturedAt: b.manufacturedAt,
          expiresAt: b.expiresAt,
          manufacturerOrImporter: b.manufacturerOrImporter.trim(),
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
    if (!window.confirm("Tem certeza que deseja cancelar este pedido de compra?")) {
      return;
    }
    try {
      await procurementApi.cancelPurchase(id);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return {
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
    page,
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
  };
}
