"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
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
  formatCurrency,
  formatDateOnly,
  formatDateTime,
  formatNumber,
} from "@/lib/format";

type OrderAction = "create" | "edit" | "approve" | "start" | "cancel" | "close";
type OrderDraftItem = { lotId: string; quantity: string };

function isUsableLot(lot: OperationalLot): boolean {
  const today = localDate(0);
  return (
    lot.product.type !== "SERVICO" &&
    Number(lot.quantity) > 0 &&
    lot.expiresAt.slice(0, 10) >= today &&
    lot.magazine.active &&
    lot.magazine.fireLicenseExpiresAt.slice(0, 10) >= today
  );
}

const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  ORCAMENTO: "Orçamento",
  APROVADO: "Aprovada",
  EM_MONTAGEM: "Em montagem",
  CONCLUIDO: "Concluída",
  CANCELADO: "Cancelada",
};

const STATUS_TONES: Record<ServiceOrderStatus, string> = {
  ORCAMENTO: "neutral",
  APROVADO: "available",
  EM_MONTAGEM: "warning",
  CONCLUIDO: "available",
  CANCELADO: "error",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

function localDateTime(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function localDate(daysAhead = 0): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    to: localDate(
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
        now.getDate(),
    ),
  };
}

function StatusPill({ status }: { status: ServiceOrderStatus }) {
  return (
    <span className={`status-pill status-pill--${STATUS_TONES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
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
    results.push(...(await Promise.all(pages.map(fetchPage))));
  }
  return results.flatMap((result) => result.data);
}

export function OperationsWorkspace() {
  const initialRange = monthRange();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [report, setReport] = useState<ServiceOrderReport | null>(null);
  const [selected, setSelected] = useState<ServiceOrder | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | "">("");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<OrderAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<OperationalCustomer[]>([]);
  const [blasters, setBlasters] = useState<OperationalBlaster[]>([]);
  const [lots, setLots] = useState<OperationalLot[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [eventAt, setEventAt] = useState(localDateTime(7));
  const [eventLocation, setEventLocation] = useState("");
  const [contractedAmount, setContractedAmount] = useState("");
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

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setRevision((current) => current + 1);
  }, []);

  useEffect(() => {
    let current = true;
    const requests: [
      Promise<PageResult<ServiceOrder>>,
      Promise<ServiceOrderReport>,
    ] = [
      operationsApi.getOrders(page, search, statusFilter || undefined),
      operationsApi.getReport(from, to),
    ];
    void Promise.allSettled(requests)
      .then(([ordersResult, reportResult]) => {
        if (!current) return;
        if (ordersResult.status === "rejected") {
          setError(errorMessage(ordersResult.reason));
          setOrders([]);
          setTotalPages(1);
        } else {
          setOrders(ordersResult.value.data);
          setTotalPages(ordersResult.value.meta.totalPages);
        }
        if (reportResult.status === "fulfilled") {
          setReport(reportResult.value);
        } else {
          setReport(null);
          if (ordersResult.status === "fulfilled") {
            setError(
              `Resumo do período indisponível: ${errorMessage(reportResult.reason)}`,
            );
          }
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [page, search, statusFilter, from, to, revision]);

  useEffect(() => {
    if (!selectedId) return;
    let current = true;
    void operationsApi
      .getOrder(selectedId)
      .then((order) => {
        if (current) setSelected(order);
      })
      .catch((reason: unknown) => {
        if (current) setError(errorMessage(reason));
      });
    return () => {
      current = false;
    };
  }, [selectedId, revision]);

  const loadReferences = useCallback(async () => {
    if (referencesLoaded) return;
    setReferencesLoading(true);
    setActionError(null);
    try {
      const [customerOptions, blasterOptions, lotOptions] = await Promise.all([
        loadAllPages(operationsApi.getCustomers),
        loadAllPages(operationsApi.getBlasters),
        loadAllPages(operationsApi.getLots),
      ]);
      setCustomers(customerOptions);
      setBlasters(blasterOptions);
      setLots(lotOptions);
      setReferencesLoaded(true);
    } catch (reason) {
      setActionError(errorMessage(reason));
      throw reason;
    } finally {
      setReferencesLoading(false);
    }
  }, [referencesLoaded]);

  async function openAction(nextAction: OrderAction) {
    setActionError(null);
    setNotice(null);
    setAction(nextAction);
    if (nextAction === "create" || nextAction === "edit" || nextAction === "approve") {
      try {
        await loadReferences();
      } catch {
        return;
      }
    }
  }

  async function openEditOrder(order: ServiceOrder) {
    setActionError(null);
    setNotice(null);
    setCustomerId(order.customerId);
    setContractedAmount(String(order.contractedAmount));
    const evDate = new Date(order.eventAt);
    evDate.setMinutes(evDate.getMinutes() - evDate.getTimezoneOffset());
    setEventAt(evDate.toISOString().slice(0, 16));
    setEventLocation(order.eventLocation);
    setDraftItems(
      order.items.map((it) => ({
        lotId: it.productLotId,
        quantity: String(it.plannedQuantity),
      })),
    );
    setAction("edit");
    try {
      await loadReferences();
    } catch {
      return;
    }
  }

  function closeAction() {
    setAction(null);
    setActionError(null);
  }

  async function completeAction(message: string) {
    setAction(null);
    setActionError(null);
    setNotice(message);
    reload();
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const items = draftItems.map((item) => {
        const lot = lots.find((entry) => entry.id === item.lotId);
        if (!lot) throw new Error("Selecione um lote válido para cada item.");
        return {
          productId: lot.productId,
          productLotId: lot.id,
          plannedQuantity: Number(item.quantity),
        };
      });
      const created = await operationsApi.createOrder({
        customerId,
        contractedAmount: Number(contractedAmount),
        eventAt: new Date(eventAt).toISOString(),
        eventLocation,
        items,
      });
      setSelected(null);
      setSelectedId(created.id);
      await completeAction(
        `Orçamento #${created.code} criado. O estoque ainda não foi reservado.`,
      );
      setCustomerId("");
      setEventAt(localDateTime(7));
      setEventLocation("");
      setContractedAmount("");
      setDraftItems([newOrderItem()]);
    } catch (reason) {
      setActionError(errorMessage(reason));
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
      const items = draftItems.map((item) => {
        const lot = lots.find((entry) => entry.id === item.lotId);
        if (!lot) throw new Error("Selecione um lote válido para cada item.");
        return {
          productId: lot.productId,
          productLotId: lot.id,
          plannedQuantity: Number(item.quantity),
        };
      });
      const updated = await operationsApi.updateOrder(selected.id, {
        customerId,
        contractedAmount: Number(contractedAmount),
        eventAt: new Date(eventAt).toISOString(),
        eventLocation,
        items,
      });
      setSelected(updated);
      setSelectedId(updated.id);
      await completeAction(
        `Orçamento #${updated.code} atualizado com sucesso.`,
      );
    } catch (reason) {
      setActionError(errorMessage(reason));
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
      await operationsApi.approveOrder(selected.id, {
        responsibleBlasterId: blasterId,
        ...(artNumber.trim() ? { artNumber: artNumber.trim() } : {}),
      });
      await completeAction(
        `Ordem #${selected.code} aprovada e estoque reservado.`,
      );
      setBlasterId("");
      setArtNumber("");
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setActionError(null);
    try {
      if (action === "start") {
        await operationsApi.startOrder(selected.id);
        await completeAction(`Montagem da ordem #${selected.code} iniciada.`);
      } else if (action === "cancel") {
        await operationsApi.cancelOrder(selected.id);
        await completeAction(`Ordem #${selected.code} cancelada.`);
      } else if (action === "close") {
        await operationsApi.closeOrder(selected.id, {
          dueDate,
          ...(reportNotes.trim() ? { reportNotes: reportNotes.trim() } : {}),
          items: selected.items.map((item) => ({
            itemId: item.id,
            firedQuantity: Number(
              firedQuantities[item.id] ?? item.plannedQuantity,
            ),
          })),
        });
        await completeAction(
          `Ordem #${selected.code} concluída e consumo registrado.`,
        );
      }
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setSubmitting(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function changeSelected(order: ServiceOrder) {
    setAction(null);
    setActionError(null);
    setSelected(null);
    setSelectedId(order.id);
  }

  const selectedLotIds = draftItems.map((item) => item.lotId).filter(Boolean);
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );

  return (
    <div className="operations-workspace">
      <header className="page-heading">
        <div className="page-heading__identity">
          <span className="page-heading__icon">
            <Icon name="spark" size={24} />
          </span>
          <div>
            <p className="eyebrow">Operações</p>
            <h1>Ordens de serviço</h1>
            <p className="page-heading__description">
              Orçamentos, reservas de estoque, execução e fechamento de eventos.
            </p>
          </div>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={() => void openAction("create")}
        >
          <span aria-hidden="true">+</span> Nova ordem
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
      {notice && (
        <div className="inventory-alert inventory-alert--success" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            type="button"
            aria-label="Fechar confirmação"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {report && (
        <section
          className="inventory-metrics"
          aria-label="Resumo de ordens de serviço"
        >
          <Metric
            label="Ordens no período"
            value={formatNumber(report.totals.orderCount, 0)}
            detail="Data considerada: evento"
          />
          <Metric
            label="Valor contratado"
            value={formatCurrency(Number(report.totals.contractedAmount))}
            detail="Soma de todas as situações"
          />
          <Metric
            label="Orçamentos"
            value={formatNumber(
              report.byStatus.find((row) => row.status === "ORCAMENTO")
                ?.orderCount ?? 0,
              0,
            )}
            detail="Aguardando aprovação"
          />
          <Metric
            label="Em execução"
            value={formatNumber(
              report.byStatus.find((row) => row.status === "EM_MONTAGEM")
                ?.orderCount ?? 0,
              0,
            )}
            detail="Montagem iniciada"
          />
        </section>
      )}

      <section
        className="operations-panel panel"
        aria-labelledby="orders-heading"
      >
        <div className="operations-toolbar">
          <div>
            <p className="eyebrow">Gestão operacional</p>
            <h2 id="orders-heading">Ordens cadastradas</h2>
          </div>
          <form
            className="operations-period"
            onSubmit={(event) => event.preventDefault()}
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
        <form className="operations-filters" onSubmit={applyFilters}>
          <label className="operations-search">
            <span>Buscar ordem</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Código, cliente ou local"
            />
          </label>
          <label>
            <span>Situação</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as ServiceOrderStatus | "");
                setPage(1);
              }}
            >
              <option value="">Todas as situações</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button button--quiet" type="submit">
            Filtrar
          </button>
          <button
            className="button button--quiet"
            type="button"
            onClick={reload}
            aria-label="Atualizar ordens"
          >
            <Icon name="refresh" size={16} /> Atualizar
          </button>
        </form>

        {loading && orders.length === 0 ? (
          <p className="table-empty" role="status">
            Carregando ordens de serviço...
          </p>
        ) : orders.length === 0 ? (
          <p className="table-empty">
            Nenhuma ordem de serviço encontrada para os filtros informados.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table operations-table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Cliente</th>
                  <th>Evento</th>
                  <th>Valor contratado</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={
                      selectedId === order.id ? "operations-row--selected" : ""
                    }
                  >
                    <td>
                      <strong>#{order.code}</strong>
                      <small>{order.eventLocation}</small>
                    </td>
                    <td>{order.customer.legalName}</td>
                    <td>{formatDateTime(order.eventAt)}</td>
                    <td>{formatCurrency(Number(order.contractedAmount))}</td>
                    <td>
                      <StatusPill status={order.status} />
                    </td>
                    <td>
                      <button
                        className="button button--quiet"
                        type="button"
                        onClick={() => changeSelected(order)}
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(totalPages > 1 || page > 1) && (
          <nav className="table-pagination" aria-label="Paginação de ordens">
            <button
              className="button button--quiet"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              className="button button--quiet"
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </section>

      {selected && (
        <section
          className="operations-panel panel operations-detail"
          aria-labelledby="order-detail-heading"
        >
          <div className="operations-toolbar">
            <div>
              <p className="eyebrow">Detalhes da ordem</p>
              <h2 id="order-detail-heading">Ordem #{selected.code}</h2>
            </div>
            <div className="operations-detail__actions">
              <StatusPill status={selected.status} />
              {selected.status === "ORCAMENTO" && (
                <>
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => void openEditOrder(selected)}
                  >
                    Editar orçamento
                  </button>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() => void openAction("approve")}
                  >
                    Aprovar orçamento
                  </button>
                </>
              )}
              {selected.status === "APROVADO" && (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void openAction("start")}
                >
                  Iniciar montagem
                </button>
              )}
              {(selected.status === "ORCAMENTO" ||
                selected.status === "APROVADO" ||
                selected.status === "EM_MONTAGEM") && (
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() => void openAction("cancel")}
                >
                  Cancelar
                </button>
              )}
              {selected.status === "EM_MONTAGEM" && (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => {
                    setFiredQuantities(
                      Object.fromEntries(
                        selected.items.map((item) => [
                          item.id,
                          item.plannedQuantity,
                        ]),
                      ),
                    );
                    void openAction("close");
                  }}
                >
                  Concluir ordem
                </button>
              )}
            </div>
          </div>
          <dl className="operations-detail__facts">
            <div>
              <dt>Cliente</dt>
              <dd>{selected.customer.legalName}</dd>
            </div>
            <div>
              <dt>Evento</dt>
              <dd>{formatDateTime(selected.eventAt)}</dd>
            </div>
            <div>
              <dt>Local</dt>
              <dd>{selected.eventLocation}</dd>
            </div>
            <div>
              <dt>Valor contratado</dt>
              <dd>{formatCurrency(Number(selected.contractedAmount))}</dd>
            </div>
            <div>
              <dt>Blaster responsável</dt>
              <dd>
                {selected.responsibleBlaster?.name ?? "Ainda não definido"}
              </dd>
            </div>
            <div>
              <dt>CR do cliente</dt>
              <dd>
                {selected.customer.hasCr
                  ? `Cadastrado · validade ${
                      selected.customer.crExpiresAt
                        ? formatDateOnly(selected.customer.crExpiresAt)
                        : "não informada"
                    }`
                  : "Não cadastrado"}
              </dd>
            </div>
            {(selected.customer.authorizedPceClasses?.length ?? 0) > 0 && (
              <div>
                <dt>Classes PCE autorizadas</dt>
                <dd>{selected.customer.authorizedPceClasses.join(", ")}</dd>
              </div>
            )}
            <div>
              <dt>Reserva NEQ</dt>
              <dd>
                {formatNumber(Number(selected.reservedNeqKg))} kg{" "}
                {selected.reservationActive ? "· ativa" : "· inativa"}
              </dd>
            </div>
            {selected.artNumber && (
              <div>
                <dt>ART</dt>
                <dd>{selected.artNumber}</dd>
              </div>
            )}
            {selected.dueDate && (
              <div>
                <dt>Vencimento</dt>
                <dd>{formatDateOnly(selected.dueDate)}</dd>
              </div>
            )}
          </dl>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto / lote</th>
                  <th>Paiol</th>
                  <th>Planejado</th>
                  <th>Disparado</th>
                  <th>NEQ</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product.name}</strong>
                      <small>Lote {item.productLot.lotNumber}</small>
                    </td>
                    <td>{item.productLot.magazine.name}</td>
                    <td>
                      {formatNumber(Number(item.plannedQuantity))}{" "}
                      {item.product.unit}
                    </td>
                    <td>
                      {item.firedQuantity === null
                        ? "—"
                        : `${formatNumber(Number(item.firedQuantity))} ${item.product.unit}`}
                    </td>
                    <td>{formatNumber(Number(item.neqKg))} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected.reportNotes && (
            <p className="operations-notes">
              <strong>Notas de encerramento:</strong> {selected.reportNotes}
            </p>
          )}
        </section>
      )}

      {action && (
        <section
          className="operations-action panel"
          aria-labelledby="operations-action-heading"
        >
          <div className="operations-toolbar">
            <div>
              <p className="eyebrow">Ação da ordem</p>
              <h2 id="operations-action-heading">
                {action === "create"
                  ? "Criar orçamento de serviço"
                  : action === "edit"
                    ? `Editar orçamento #${selected?.code}`
                    : action === "approve"
                      ? `Aprovar ordem #${selected?.code}`
                      : action === "start"
                        ? `Iniciar montagem da ordem #${selected?.code}`
                        : action === "cancel"
                          ? `Cancelar ordem #${selected?.code}`
                          : `Concluir ordem #${selected?.code}`}
              </h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Fechar formulário"
              onClick={closeAction}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {referencesLoading && (
            <p className="table-empty" role="status">
              Carregando clientes, blasters e lotes...
            </p>
          )}
          {actionError && (
            <div
              className="inventory-alert inventory-alert--error"
              role="alert"
            >
              <span>{actionError}</span>
              {(action === "create" || action === "edit" || action === "approve") && (
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void loadReferences()}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
          {(action === "create" || action === "edit") && !referencesLoading && (
            <form
              className="operations-form"
              onSubmit={(event) => void (action === "edit" ? submitEdit(event) : submitCreate(event))}
            >
              <div className="operations-form__grid">
                <label className="operations-form__wide">
                  Cliente
                  <select
                    required
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                  >
                    <option value="">Selecione um cliente ativo</option>
                    {customers
                      .filter((customer) => customer.active)
                      .map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.legalName}
                          {customer.hasCr ? " · CR cadastrado" : " · sem CR"}
                        </option>
                      ))}
                  </select>
                </label>
                {selectedCustomer && (
                  <p className="operations-form__wide operations-form__hint">
                    {selectedCustomer.hasCr
                      ? `CR cadastrado${
                          selectedCustomer.crExpiresAt
                            ? ` · válido até ${formatDateOnly(
                                selectedCustomer.crExpiresAt,
                              )}`
                            : ""
                        }. Classes autorizadas: ${
                          selectedCustomer.authorizedPceClasses.join(", ") ||
                          "não informadas"
                        }.`
                      : "Cliente sem CR cadastrado; o backend validará a elegibilidade antes de reservar itens PCE."}
                  </p>
                )}
                <label>
                  Valor contratado (R$)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={contractedAmount}
                    onChange={(event) =>
                      setContractedAmount(event.target.value)
                    }
                  />
                </label>
                <label>
                  Data e hora do evento
                  <input
                    type="datetime-local"
                    required
                    min={localDateTime(0)}
                    value={eventAt}
                    onChange={(event) => setEventAt(event.target.value)}
                  />
                </label>
                <label className="operations-form__wide">
                  Local do evento
                  <input
                    maxLength={500}
                    required
                    value={eventLocation}
                    onChange={(event) => setEventLocation(event.target.value)}
                  />
                </label>
              </div>
              <div className="operations-form__section">
                <div className="operations-toolbar">
                  <h3>Produtos e lotes</h3>
                  <button
                    className="button button--quiet"
                    type="button"
                    onClick={() =>
                      setDraftItems((current) => [...current, newOrderItem()])
                    }
                  >
                    Adicionar item
                  </button>
                </div>
                {draftItems.map((item, index) => {
                  const lot = lots.find((entry) => entry.id === item.lotId);
                  return (
                    <div
                      className="operations-item-form"
                      key={`draft-${index}`}
                    >
                      <label>
                        Lote
                        <select
                          required
                          value={item.lotId}
                          onChange={(event) =>
                            setDraftItems((current) =>
                              current.map((line, row) =>
                                row === index
                                  ? { ...line, lotId: event.target.value }
                                  : line,
                              ),
                            )
                          }
                        >
                          <option value="">Selecione um lote</option>
                          {lots
                            .filter(
                              (candidate) =>
                                isUsableLot(candidate) &&
                                (candidate.id === item.lotId ||
                                  !selectedLotIds.includes(candidate.id)),
                            )
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.product.name} · {candidate.lotNumber}{" "}
                                · {candidate.magazine.name} · físico{" "}
                                {formatNumber(Number(candidate.quantity))}{" "}
                                {candidate.product.unit}
                              </option>
                            ))}
                        </select>
                        {lot && (
                          <small>
                            Quantidade física do lote. A aprovação validará o
                            saldo realmente reservável e a validade.
                          </small>
                        )}
                      </label>
                      <label>
                        Quantidade planejada
                        <input
                          type="number"
                          min="0.01"
                          max={lot?.quantity}
                          step="0.01"
                          required
                          value={item.quantity}
                          onChange={(event) =>
                            setDraftItems((current) =>
                              current.map((line, row) =>
                                row === index
                                  ? { ...line, quantity: event.target.value }
                                  : line,
                              ),
                            )
                          }
                        />
                      </label>
                      {draftItems.length > 1 && (
                        <button
                          className="button button--quiet"
                          type="button"
                          aria-label={`Remover item ${index + 1}`}
                          onClick={() =>
                            setDraftItems((current) =>
                              current.filter((_, row) => row !== index),
                            )
                          }
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="operations-form__footer">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={closeAction}
                >
                  Fechar
                </button>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={submitting || referencesLoading}
                >
                  {submitting
                    ? "Salvando..."
                    : action === "edit"
                      ? "Salvar alterações"
                      : "Criar orçamento"}
                </button>
              </div>
            </form>
          )}
          {action === "approve" && selected && !referencesLoading && (
            <form
              className="operations-form"
              onSubmit={(event) => void submitApprove(event)}
            >
              <p>
                A aprovação verifica elegibilidade do cliente e do blaster e
                reserva os lotes de forma atômica.
              </p>
              <div className="operations-form__grid">
                <label className="operations-form__wide">
                  Blaster responsável
                  <select
                    required
                    value={blasterId}
                    onChange={(event) => setBlasterId(event.target.value)}
                  >
                    <option value="">Selecione um blaster ativo</option>
                    {blasters
                      .filter((blaster) => blaster.active)
                      .map((blaster) => (
                        <option key={blaster.id} value={blaster.id}>
                          {blaster.name} · licença até{" "}
                          {formatDateOnly(blaster.licenseExpiresAt)}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="operations-form__wide">
                  Número da ART (opcional)
                  <input
                    maxLength={50}
                    value={artNumber}
                    onChange={(event) => setArtNumber(event.target.value)}
                  />
                </label>
              </div>
              <div className="operations-form__footer">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={closeAction}
                >
                  Fechar
                </button>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Validando..." : "Aprovar e reservar"}
                </button>
              </div>
            </form>
          )}
          {(action === "start" || action === "cancel") && selected && (
            <form
              className="operations-form"
              onSubmit={(event) => void submitTransition(event)}
            >
              <p>
                {action === "start"
                  ? "A OS passará para montagem e manterá a reserva de estoque."
                  : "A ordem será cancelada e, se houver reserva, o estoque será liberado."}
              </p>
              <div className="operations-form__footer">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={closeAction}
                >
                  Voltar
                </button>
                <button
                  className={
                    action === "cancel"
                      ? "button button--danger"
                      : "button button--primary"
                  }
                  type="submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Processando..."
                    : action === "start"
                      ? "Confirmar início"
                      : "Confirmar cancelamento"}
                </button>
              </div>
            </form>
          )}
          {action === "close" && selected && (
            <form
              className="operations-form"
              onSubmit={(event) => void submitTransition(event)}
            >
              <p>
                Informe a quantidade efetivamente disparada. O backend baixa o
                consumo real, libera sobras e cria uma conta a receber pelo
                valor contratado.
              </p>
              <div className="operations-form__grid">
                <label>
                  Vencimento da conta a receber
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
                <label className="operations-form__wide">
                  Notas do relatório
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={reportNotes}
                    onChange={(event) => setReportNotes(event.target.value)}
                  />
                </label>
              </div>
              <div className="operations-form__section">
                <h3>Quantidades disparadas</h3>
                {selected.items.map((item) => (
                  <label className="operations-close-item" key={item.id}>
                    <span>
                      <strong>{item.product.name}</strong>
                      <small>
                        Planejado: {formatNumber(Number(item.plannedQuantity))}{" "}
                        {item.product.unit}
                      </small>
                    </span>
                    <span>
                      {item.product.unit}
                      <input
                        type="number"
                        min="0"
                        max={item.plannedQuantity}
                        step="0.01"
                        required
                        value={firedQuantities[item.id] ?? item.plannedQuantity}
                        onChange={(event) =>
                          setFiredQuantities((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="operations-form__footer">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={closeAction}
                >
                  Fechar
                </button>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Concluindo..."
                    : "Concluir e registrar consumo"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
