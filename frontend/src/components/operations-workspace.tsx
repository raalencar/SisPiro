"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { PixModal } from "@/components/pix-modal";
import {
  complianceApi,
  fiscalApi,
  financeApi,
  operationsApi,
  type FiscalDocument,
  type GeneratedPix,
  type OperationalBlaster,
  type OperationalCustomer,
  type OperationalLot,
  type PageResult,
  type ServiceOrder,
  type ServiceOrderReport,
  type ServiceOrderStatus,
} from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { useToast } from "@/components/toast-provider";
import {
  BurningDossierModal,
  GtModal,
  localDate,
  localDateTime,
  monthRange,
  NfseModal,
  OrderActionCard,
  OrderDetailsPane,
  OrdersTable,
  type OrderAction,
  type OrderDraftItem,
} from "./operations/index";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

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

export function OperationsWorkspace() {
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

  // Estados de Modais Auxiliares
  const [isGtModalOpen, setIsGtModalOpen] = useState(false);
  const [gtOriginCity, setGtOriginCity] = useState("Fortaleza");
  const [gtOriginState, setGtOriginState] = useState("CE");
  const [gtDestCity, setGtDestCity] = useState("");
  const [gtDestState, setGtDestState] = useState("CE");
  const [gtPlate, setGtPlate] = useState("POX-9A12");
  const [gtPlateState, setGtPlateState] = useState("CE");
  const [gtDriverName, setGtDriverName] = useState("Raimundo Nonato Arruda");
  const [gtDriverCpf, setGtDriverCpf] = useState("123.456.789-00");
  const [gtDriverLicense, setGtDriverLicense] = useState("987654321-CE");
  const [gtRoute, setGtRoute] = useState("Partida Paiol Central -> BR-116 -> Destino");
  const [gtSubmitting, setGtSubmitting] = useState(false);
  const [gtError, setGtError] = useState<string | null>(null);

  const [isNfseModalOpen, setIsNfseModalOpen] = useState(false);
  const [nfseSubmitting, setNfseSubmitting] = useState(false);
  const [nfseError, setNfseError] = useState<string | null>(null);
  const [nfseSuccess, setNfseSuccess] = useState<FiscalDocument | null>(null);

  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<GeneratedPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  const [isBurningOrderModalOpen, setIsBurningOrderModalOpen] = useState(false);

  function handleOpenGtModal() {
    if (!selected) return;
    setGtError(null);
    setGtRoute(`Transporte de PCE para espetáculo em ${selected.eventLocation}`);
    setIsGtModalOpen(true);
  }

  async function handleSubmitGt(e: FormEvent) {
    e.preventDefault();
    if (!selected || selected.items.length === 0) return;
    setGtSubmitting(true);
    setGtError(null);
    try {
      const firstMagazineId = selected.items[0]?.productLot.magazineId;
      if (!firstMagazineId) {
        throw new Error("Lote sem paiol vinculado.");
      }
      const gt = await complianceApi.createTrafficGuide({
        serviceOrderId: selected.id,
        sourceMagazineId: firstMagazineId,
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
        originCity: gtOriginCity,
        originState: gtOriginState,
        destinationCity: gtDestCity,
        destinationState: gtDestState,
        routeDescription: gtRoute,
        vehiclePlate: gtPlate,
        vehiclePlateState: gtPlateState,
        driverName: gtDriverName,
        driverCpf: gtDriverCpf,
        driverLicense: gtDriverLicense,
        hasMopp: true,
        blasterId: selected.responsibleBlasterId ?? undefined,
        items: selected.items.map((i) => ({
          productId: i.productId,
          productLotId: i.productLotId,
          quantity: Number(i.plannedQuantity),
        })),
      });

      setIsGtModalOpen(false);
      toast.success(`Guia de Tráfego #${gt.number} emitida com sucesso para o transporte militar!`);
      reload();
    } catch (err) {
      setGtError(errorMessage(err));
    } finally {
      setGtSubmitting(false);
    }
  }

  function handleOpenNfseModal() {
    if (!selected) return;
    setNfseError(null);
    setNfseSuccess(null);
    setIsNfseModalOpen(true);
  }

  async function handleSubmitNfse(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setNfseSubmitting(true);
    setNfseError(null);
    try {
      const doc = await fiscalApi.emitNFSe({
        serviceOrderId: selected.id,
        serviceDescription: `Espetáculo Pirotécnico em ${selected.eventLocation}. Blaster: ${selected.responsibleBlaster?.name ?? "Técnico"} - ART: ${selected.artNumber ?? "S/N"}.`,
      });
      setNfseSuccess(doc);
      toast.success(`NFS-e #${doc.number} emitida e autorizada com sucesso na Prefeitura!`);
      reload();
      setTimeout(() => setIsNfseModalOpen(false), 2000);
    } catch (err) {
      setNfseError(errorMessage(err));
    } finally {
      setNfseSubmitting(false);
    }
  }

  async function handleOpenPix() {
    if (!selected) return;
    setPixLoading(true);
    try {
      const entriesRes = await financeApi.getEntries(1, "RECEBER");
      const entry = entriesRes.data.find((e) => e.serviceOrderId === selected.id);
      if (!entry) {
        throw new Error("Título a receber ainda não localizado para esta OS. Verifique no Financeiro.");
      }
      const generated = await financeApi.generatePix(entry.id);
      setPixData(generated);
      setIsPixModalOpen(true);
    } catch (err) {
      toast.error(`Aviso financeiro: ${errorMessage(err)}`);
    } finally {
      setPixLoading(false);
    }
  }

  const selectedLotIds = draftItems
    .map((item) => item.lotId)
    .filter((lotId) => lotId.length > 0);

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

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
