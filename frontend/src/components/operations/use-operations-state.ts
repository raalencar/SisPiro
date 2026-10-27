"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/toast-provider";
import {
  operationsApi,
  type OperationalBlaster,
  type OperationalCustomer,
  type OperationalLot,
  type PageResult,
  type ServiceOrder,
  type ServiceOrderReport,
  type ServiceOrderStatus,
} from "@/lib/api";
import {
  localDate,
  localDateTime,
  monthRange,
  type OrderAction,
  type OrderDraftItem,
} from "./types";
import { useOperationsModals } from "./use-operations-modals";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

function newOrderItem(): OrderDraftItem {
  return { lotId: "", quantity: "" };
}

async function loadAllPages<T>(
  fetchPage: (page: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const results = [first];
  for (let page = 2; page <= first.meta.totalPages; page += 5) {
    const pages = Array.from(
      { length: Math.min(5, first.meta.totalPages - page + 1) },
      (_, index) => page + index,
    );
    const chunk = await Promise.all(pages.map(fetchPage));
    results.push(...chunk);
  }
  return results.flatMap((entry) => entry.data);
}

export function useOperationsState() {
  const toast = useToast();
  const defaultRange = monthRange();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [report, setReport] = useState<ServiceOrderReport | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<OrderAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<OperationalCustomer[]>([]);
  const [blasters, setBlasters] = useState<OperationalBlaster[]>([]);
  const [lots, setLots] = useState<OperationalLot[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState("");
  const [contractedAmount, setContractedAmount] = useState("");
  const [eventAt, setEventAt] = useState(localDateTime(7));
  const [eventLocation, setEventLocation] = useState("");
  const [draftItems, setDraftItems] = useState<OrderDraftItem[]>([
    newOrderItem(),
  ]);
  const [blasterId, setBlasterId] = useState("");
  const [artNumber, setArtNumber] = useState("");
  const [dueDate, setDueDate] = useState(localDate(30));
  const [reportNotes, setReportNotes] = useState("");
  const [firedQuantities, setFiredQuantities] = useState<
    Record<string, string>
  >({});

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  const loadReferences = useCallback(async () => {
    setReferencesLoading(true);
    setActionError(null);
    try {
      const [nextCustomers, nextBlasters, nextLots] = await Promise.all([
        loadAllPages(operationsApi.getCustomers),
        loadAllPages(operationsApi.getBlasters),
        loadAllPages(operationsApi.getLots),
      ]);
      setCustomers(nextCustomers);
      setBlasters(nextBlasters);
      setLots(nextLots);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setReferencesLoading(false);
    }
  }, []);

  const [reloadTrigger, setReloadTrigger] = useState(0);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadTrigger((v) => v + 1);
  }, []);

  useEffect(() => {
    let current = true;
    void Promise.all([
      operationsApi.getOrders(page, search || undefined, statusFilter || undefined),
      operationsApi.getReport(from, to),
    ])
      .then(([ordersResult, reportResult]) => {
        if (!current) return;
        setOrders(ordersResult.data);
        setTotalPages(ordersResult.meta.totalPages);
        setReport(reportResult);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (current) setError(errorMessage(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [page, statusFilter, search, from, to, reloadTrigger]);

  function changeSelected(order: ServiceOrder) {
    setSelectedId(order.id);
    setAction(null);
    setActionError(null);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function openAction(nextAction: OrderAction) {
    setAction(nextAction);
    setActionError(null);
    if (nextAction === "create") {
      setCustomerId("");
      setContractedAmount("");
      setEventAt(localDateTime(7));
      setEventLocation("");
      setDraftItems([newOrderItem()]);
      void loadReferences();
    }
    if (nextAction === "approve") {
      setBlasterId(selected?.responsibleBlasterId ?? "");
      setArtNumber(selected?.artNumber ?? "");
      void loadReferences();
    }
    if (nextAction === "close") {
      setDueDate(localDate(30));
      setReportNotes(selected?.reportNotes ?? "");
    }
  }

  function openEditOrder(order: ServiceOrder) {
    setSelectedId(order.id);
    setAction("edit");
    setActionError(null);
    setCustomerId(order.customerId);
    setContractedAmount(order.contractedAmount);
    const date = new Date(order.eventAt);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setEventAt(date.toISOString().slice(0, 16));
    setEventLocation(order.eventLocation);
    setDraftItems(
      order.items.map((it) => ({
        lotId: it.productLotId,
        quantity: it.plannedQuantity,
      })),
    );
    void loadReferences();
  }

  function closeAction() {
    setAction(null);
    setActionError(null);
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const created = await operationsApi.createOrder({
        customerId,
        contractedAmount: Number(contractedAmount),
        eventAt: new Date(eventAt).toISOString(),
        eventLocation: eventLocation.trim(),
        items: draftItems.map((item) => {
          const lot = lots.find((candidate) => candidate.id === item.lotId);
          return {
            productId: lot?.product.id ?? "",
            productLotId: item.lotId,
            plannedQuantity: Number(item.quantity),
          };
        }),
      });
      closeAction();
      reload();
      setSelectedId(created.id);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await operationsApi.updateOrder(selected.id, {
        customerId,
        contractedAmount: Number(contractedAmount),
        eventAt: new Date(eventAt).toISOString(),
        eventLocation: eventLocation.trim(),
        items: draftItems.map((item) => {
          const lot = lots.find((candidate) => candidate.id === item.lotId);
          return {
            productId: lot?.product.id ?? "",
            productLotId: item.lotId,
            plannedQuantity: Number(item.quantity),
          };
        }),
      });
      closeAction();
      reload();
      setSelectedId(updated.id);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const approved = await operationsApi.approveOrder(selected.id, {
        responsibleBlasterId: blasterId,
        artNumber: artNumber.trim() || undefined,
      });
      closeAction();
      reload();
      setSelectedId(approved.id);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !action) return;
    setSubmitting(true);
    setActionError(null);
    try {
      let transitioned: ServiceOrder;
      if (action === "start") {
        transitioned = await operationsApi.startOrder(selected.id);
      } else if (action === "cancel") {
        transitioned = await operationsApi.cancelOrder(selected.id);
      } else {
        transitioned = await operationsApi.closeOrder(selected.id, {
          dueDate,
          reportNotes: reportNotes.trim() || undefined,
          items: selected.items.map((item) => ({
            itemId: item.id,
            firedQuantity: Number(
              firedQuantities[item.id] ?? item.plannedQuantity,
            ),
          })),
        });
      }
      closeAction();
      reload();
      setSelectedId(transitioned.id);
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  const modals = useOperationsModals(selected, reload);

  const selectedLotIds = draftItems
    .map((item) => item.lotId)
    .filter((lotId) => lotId.length > 0);

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  return {
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
    ...modals,
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
    toast,
  };
}
