"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  financeApi,
  customersApi,
  type AgingReport,
  type CashFlowSummary,
  type Customer,
  type FinancialDirection,
  type FinancialEntry,
  type FinancialStatus,
  type PageResult,
} from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação financeira.";
}

export function FinanceWorkspace() {
  const [tab, setTab] = useState<"entries" | "cash-flow" | "aging">("entries");

  // Dados
  const [entries, setEntries] = useState<PageResult<FinancialEntry> | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Datas de referência estáveis
  const [currentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });

  // Filtros de Lançamentos
  const [directionFilter, setDirectionFilter] = useState<FinancialDirection | "TODOS">("TODOS");
  const [statusFilter, setStatusFilter] = useState<FinancialStatus | "TODOS">("TODOS");
  const [entriesFrom, setEntriesFrom] = useState("");
  const [entriesTo, setEntriesTo] = useState("");

  // Filtros de Fluxo de Caixa
  const [cfFrom, setCfFrom] = useState(monthStart);
  const [cfTo, setCfTo] = useState(currentDate);

  // Filtros de Aging Schedule
  const [agingAsOf, setAgingAsOf] = useState(currentDate);

  // Modal Novo Lançamento
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [newDirection, setNewDirection] = useState<FinancialDirection>("PAGAR");
  const [newCategory, setNewCategory] = useState("DESPESA_OPERACIONAL");
  const [newCounterpart, setNewCounterpart] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDueDate, setNewDueDate] = useState(currentDate);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newIsInstallment, setNewIsInstallment] = useState(false);
  const [newInstallmentsCount, setNewInstallmentsCount] = useState<number>(2);
  const [newIntervalDays, setNewIntervalDays] = useState<number>(30);
  const [newEntrySubmitting, setNewEntrySubmitting] = useState(false);
  const [newEntryError, setNewEntryError] = useState<string | null>(null);

  // Modal de Baixa / Pagamento
  const [payingEntry, setPayingEntry] = useState<FinancialEntry | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentDate, setPaymentDate] = useState(currentDate);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Carga inicial e reloads
  useEffect(() => {
    let current = true;

    const dirParam = directionFilter === "TODOS" ? undefined : directionFilter;
    const statParam = statusFilter === "TODOS" ? undefined : statusFilter;
    const fromParam = entriesFrom || undefined;
    const toParam = entriesTo || undefined;

    const reqs = [
      financeApi.getEntries(1, dirParam, statParam, fromParam, toParam),
      financeApi.getCashFlow(cfFrom, cfTo),
      financeApi.getAgingReport(agingAsOf),
      customersApi.getCustomers(1),
    ] as const;

    void Promise.allSettled(reqs)
      .then(([entriesRes, cfRes, agingRes, custRes]) => {
        if (!current) return;
        if (entriesRes.status === "fulfilled") setEntries(entriesRes.value);
        if (cfRes.status === "fulfilled") setCashFlow(cfRes.value);
        if (agingRes.status === "fulfilled") setAgingReport(agingRes.value);
        if (custRes.status === "fulfilled") setCustomers(custRes.value.data);
      })
      .catch((err: unknown) => {
        if (current) setError(errorMessage(err));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [
    directionFilter,
    statusFilter,
    entriesFrom,
    entriesTo,
    cfFrom,
    cfTo,
    agingAsOf,
    reloadTrigger,
  ]);

  // Ações
  function handleOpenPayment(entry: FinancialEntry) {
    setPayingEntry(entry);
    setPaymentAmount(Number(entry.outstanding));
    setPaymentMethod("PIX");
    setPaymentDate(currentDate);
    setPaymentNotes("");
    setPaymentError(null);
  }

  async function handleConfirmPayment(e: FormEvent) {
    e.preventDefault();
    if (!payingEntry || paymentAmount <= 0) return;
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      await financeApi.createPayment(payingEntry.id, {
        amount: paymentAmount,
        method: paymentMethod,
        paidAt: paymentDate,
        notes: paymentNotes.trim() || undefined,
      });
      setPayingEntry(null);
      setActionSuccess("Pagamento/Baixa registrado com sucesso.");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setPaymentError(errorMessage(err));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleCancelEntry(id: string) {
    if (!window.confirm("Deseja realmente cancelar este título financeiro?")) return;
    try {
      await financeApi.cancelEntry(id);
      setActionSuccess("Título cancelado com sucesso.");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function handleOpenNewEntry() {
    setNewDirection("PAGAR");
    setNewCategory("DESPESA_OPERACIONAL");
    setNewCounterpart("");
    setNewAmount(0);
    setNewDueDate(currentDate);
    setNewCustomerId("");
    setNewIsInstallment(false);
    setNewInstallmentsCount(2);
    setNewIntervalDays(30);
    setNewEntryError(null);
    setIsNewEntryOpen(true);
  }

  async function handleSaveNewEntry(e: FormEvent) {
    e.preventDefault();
    if (!newCounterpart.trim() || newAmount <= 0) return;
    setNewEntrySubmitting(true);
    setNewEntryError(null);
    try {
      await financeApi.createEntry({
        direction: newDirection,
        category: newCategory.trim(),
        counterpart: newCounterpart.trim(),
        amount: newAmount,
        dueDate: newDueDate,
        customerId: newCustomerId || undefined,
        installmentsCount: newIsInstallment ? newInstallmentsCount : undefined,
        intervalDays: newIsInstallment ? newIntervalDays : undefined,
      });
      setIsNewEntryOpen(false);
      setActionSuccess(
        newIsInstallment
          ? `Lançamento parcelado em ${newInstallmentsCount}x cadastrado com sucesso.`
          : "Lançamento financeiro cadastrado com sucesso.",
      );
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setNewEntryError(errorMessage(err));
    } finally {
      setNewEntrySubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-primary-500 flex items-center">
              <Icon name="chart" />
            </span>
            Gestão Financeira & Fluxo de Caixa
          </h1>
          <p className="text-neutral-400 text-sm">
            Contas a pagar e receber, baixas de pagamentos, conciliação e relatório de Aging schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "entries" && (
            <button className="button button--primary" onClick={handleOpenNewEntry}>
              + Novo Lançamento Manual
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-sm flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-neutral-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-neutral-800 gap-2">
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "entries"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
          onClick={() => setTab("entries")}
        >
          Contas a Pagar & Receber
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "cash-flow"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
          onClick={() => setTab("cash-flow")}
        >
          Fluxo de Caixa Realizado
        </button>
        <button
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "aging"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
          onClick={() => setTab("aging")}
        >
          Aging Schedule (Faixas de Vencimento)
        </button>
      </div>

      {/* ABA 1: CONTAS A PAGAR & RECEBER */}
      {tab === "entries" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="panel p-4 flex flex-wrap gap-4 items-end bg-neutral-900/60 border border-neutral-800">
            <label className="field w-36">
              <span className="text-xs">Direção</span>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as FinancialDirection | "TODOS")}
                className="input text-xs"
              >
                <option value="TODOS">Todos</option>
                <option value="RECEBER">A Receber</option>
                <option value="PAGAR">A Pagar</option>
              </select>
            </label>

            <label className="field w-40">
              <span className="text-xs">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FinancialStatus | "TODOS")}
                className="input text-xs"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ABERTO">Em Aberto</option>
                <option value="PARCIAL">Parcialmente Pago</option>
                <option value="PAGO">Liquidado / Pago</option>
                <option value="COMPENSADO">Compensado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </label>

            <label className="field w-36">
              <span className="text-xs">Vencimento De</span>
              <input
                type="date"
                value={entriesFrom}
                onChange={(e) => setEntriesFrom(e.target.value)}
                className="input text-xs"
              />
            </label>

            <label className="field w-36">
              <span className="text-xs">Vencimento Até</span>
              <input
                type="date"
                value={entriesTo}
                onChange={(e) => setEntriesTo(e.target.value)}
                className="input text-xs"
              />
            </label>

            <button
              className="button button--ghost text-xs py-2"
              onClick={() => {
                setDirectionFilter("TODOS");
                setStatusFilter("TODOS");
                setEntriesFrom("");
                setEntriesTo("");
              }}
            >
              Limpar Filtros
            </button>
          </div>

          {/* Tabela de Títulos */}
          <div className="panel p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-neutral-400">Carregando títulos financeiros...</div>
            ) : !entries || entries.data.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">Nenhum título encontrado com os filtros aplicados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Contraparte / Categoria</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-right">Amortizado</th>
                      <th className="p-3 text-right">Saldo Devedor</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {entries.data.map((en) => {
                      const isPayable = en.direction === "PAGAR";
                      return (
                        <tr key={en.id} className="hover:bg-neutral-800/30">
                          <td className="p-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                isPayable
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {isPayable ? "A Pagar" : "A Receber"}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-neutral-100">{en.counterpart || en.counterparty}</span>
                              {en.installmentCount && en.installmentCount > 1 && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-800 text-primary-400 border border-primary-500/30"
                                  title={`Grupo de Parcelas: ${en.installmentGroup ?? ""}`}
                                >
                                  Parcela {en.installmentNumber}/{en.installmentCount}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-400 flex items-center gap-2">
                              <span>Categoria: {en.category}</span>
                              {en.saleId && <span className="text-neutral-500">• Venda vinculada</span>}
                              {en.purchaseId && <span className="text-neutral-500">• Pedido de compra</span>}
                              {en.serviceOrderId && <span className="text-neutral-500">• OS vinculada</span>}
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            <div className={en.overdue ? "text-rose-400 font-bold" : "text-neutral-300"}>
                              {formatDateOnly(en.dueDate)}
                            </div>
                            {en.overdue && en.status !== "PAGO" && en.status !== "CANCELADO" && (
                              <span className="status-pill status-pill--critical text-[10px] mt-0.5">
                                Vencido
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-neutral-200">
                            {formatCurrency(Number(en.amount))}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-400">
                            {formatCurrency(Number(en.paid))}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-neutral-100">
                            {formatCurrency(Number(en.outstanding))}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`status-pill ${
                                en.status === "PAGO" || en.status === "COMPENSADO"
                                  ? "status-pill--available"
                                  : en.status === "PARCIAL"
                                  ? "status-pill--reserved"
                                  : en.status === "CANCELADO"
                                  ? "status-pill--neutral"
                                  : en.overdue
                                  ? "status-pill--critical"
                                  : "status-pill--reserved"
                              }`}
                            >
                              {en.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {(en.status === "ABERTO" || en.status === "PARCIAL") && (
                                <button
                                  className="button button--primary text-xs py-1 px-2"
                                  onClick={() => handleOpenPayment(en)}
                                >
                                  {isPayable ? "Pagar" : "Baixar"}
                                </button>
                              )}
                              {en.status !== "PAGO" && en.status !== "CANCELADO" && (
                                <button
                                  className="button button--ghost text-xs py-1 px-2 text-rose-400"
                                  onClick={() => handleCancelEntry(en.id)}
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: FLUXO DE CAIXA REALIZADO */}
      {tab === "cash-flow" && (
        <div className="space-y-6">
          {/* Filtro de Período */}
          <div className="panel p-4 flex flex-wrap gap-4 items-end bg-neutral-900/60 border border-neutral-800">
            <label className="field w-40">
              <span className="text-xs">Período De</span>
              <input
                type="date"
                value={cfFrom}
                onChange={(e) => setCfFrom(e.target.value)}
                className="input text-xs"
              />
            </label>
            <label className="field w-40">
              <span className="text-xs">Período Até</span>
              <input
                type="date"
                value={cfTo}
                onChange={(e) => setCfTo(e.target.value)}
                className="input text-xs"
              />
            </label>
          </div>

          {/* Cards de Resumo */}
          {cashFlow ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="panel bg-emerald-950/20 border border-emerald-900/50 p-4 space-y-1">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">
                  Entradas Realizadas
                </span>
                <div className="text-2xl font-bold font-mono text-emerald-300">
                  {formatCurrency(Number(cashFlow.totals.totalInflow))}
                </div>
                <p className="text-xs text-neutral-400">Total recebido no período</p>
              </div>

              <div className="panel bg-rose-950/20 border border-rose-900/50 p-4 space-y-1">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wide">
                  Saídas Realizadas
                </span>
                <div className="text-2xl font-bold font-mono text-rose-300">
                  {formatCurrency(Number(cashFlow.totals.totalOutflow))}
                </div>
                <p className="text-xs text-neutral-400">Total pago no período</p>
              </div>

              <div className="panel bg-neutral-900 border border-neutral-800 p-4 space-y-1">
                <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
                  Saldo Líquido Realizado
                </span>
                <div
                  className={`text-2xl font-bold font-mono ${
                    Number(cashFlow.totals.netCashFlow) >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(Number(cashFlow.totals.netCashFlow))}
                </div>
                <p className="text-xs text-neutral-400">Resultado de caixa no período</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Calculando fluxo de caixa realizado...</p>
          )}

          {/* Tabela Diária */}
          {cashFlow && cashFlow.daily.length > 0 && (
            <div className="panel p-0 overflow-hidden">
              <div className="p-4 border-b border-neutral-800 font-bold text-sm">
                Movimentação Diária de Caixa
              </div>
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3 text-right">Entradas (R$)</th>
                      <th className="p-3 text-right">Saídas (R$)</th>
                      <th className="p-3 text-right">Saldo do Dia (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {cashFlow.daily.map((d) => (
                      <tr key={d.date} className="hover:bg-neutral-800/30">
                        <td className="p-3 text-xs text-neutral-300 font-mono">{formatDateOnly(d.date)}</td>
                        <td className="p-3 text-right font-mono text-emerald-400">
                          {formatCurrency(Number(d.inflow))}
                        </td>
                        <td className="p-3 text-right font-mono text-rose-400">
                          {formatCurrency(Number(d.outflow))}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            Number(d.net) >= 0 ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {formatCurrency(Number(d.net))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: AGING SCHEDULE */}
      {tab === "aging" && (
        <div className="space-y-6">
          {/* Filtro Data Base */}
          <div className="panel p-4 flex flex-wrap gap-4 items-end bg-neutral-900/60 border border-neutral-800">
            <label className="field w-40">
              <span className="text-xs">Data de Corte (asOf)</span>
              <input
                type="date"
                value={agingAsOf}
                onChange={(e) => setAgingAsOf(e.target.value)}
                className="input text-xs"
              />
            </label>
          </div>

          {/* Card de Exposição Líquida */}
          {agingReport && (
            <div className="panel bg-neutral-900 border border-neutral-800 p-4 space-y-1">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                Exposição Líquida Total (Recebíveis - A Pagar)
              </span>
              <div
                className={`text-2xl font-bold font-mono ${
                  Number(agingReport.netExposure) >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {formatCurrency(Number(agingReport.netExposure))}
              </div>
              <p className="text-xs text-neutral-400">
                Posição calculada com base na data de corte {formatDateOnly(agingReport.asOf)}.
              </p>
            </div>
          )}

          {/* Tabela com os 5 Buckets de Vencimento */}
          {agingReport ? (
            <div className="panel p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Carteira</th>
                      <th className="p-3 text-right">A Vencer (Em dia)</th>
                      <th className="p-3 text-right">1 a 30 dias</th>
                      <th className="p-3 text-right">31 a 60 dias</th>
                      <th className="p-3 text-right">61 a 90 dias</th>
                      <th className="p-3 text-right">&gt; 90 dias</th>
                      <th className="p-3 text-right font-bold">Total Aberto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {/* Recebíveis */}
                    <tr className="hover:bg-neutral-800/30">
                      <td className="p-3 font-semibold text-emerald-400">Contas a Receber</td>
                      <td className="p-3 text-right font-mono text-neutral-200">
                        {formatCurrency(Number(agingReport.receivables.current))}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-400">
                        {formatCurrency(Number(agingReport.receivables.overdue1to30))}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-500">
                        {formatCurrency(Number(agingReport.receivables.overdue31to60))}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-400">
                        {formatCurrency(Number(agingReport.receivables.overdue61to90))}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-500 font-bold">
                        {formatCurrency(Number(agingReport.receivables.overdueOver90))}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-300">
                        {formatCurrency(Number(agingReport.receivables.total))}
                      </td>
                    </tr>

                    {/* A Pagar */}
                    <tr className="hover:bg-neutral-800/30">
                      <td className="p-3 font-semibold text-rose-400">Contas a Pagar</td>
                      <td className="p-3 text-right font-mono text-neutral-200">
                        {formatCurrency(Number(agingReport.payables.current))}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-400">
                        {formatCurrency(Number(agingReport.payables.overdue1to30))}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-500">
                        {formatCurrency(Number(agingReport.payables.overdue31to60))}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-400">
                        {formatCurrency(Number(agingReport.payables.overdue61to90))}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-500 font-bold">
                        {formatCurrency(Number(agingReport.payables.overdueOver90))}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-300">
                        {formatCurrency(Number(agingReport.payables.total))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Carregando relatório de Aging schedule...</p>
          )}
        </div>
      )}

      {/* MODAL NOVO LANÇAMENTO MANUAL */}
      {isNewEntryOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full space-y-4">
            <h2 className="text-xl font-bold">Novo Lançamento Financeiro</h2>
            <form className="form-stack space-y-4" onSubmit={handleSaveNewEntry}>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Direção *</span>
                  <select
                    value={newDirection}
                    onChange={(e) => setNewDirection(e.target.value as FinancialDirection)}
                  >
                    <option value="PAGAR">Conta a Pagar (Saída)</option>
                    <option value="RECEBER">Conta a Receber (Entrada)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Categoria *</span>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ENERGIA, ALUGUEL, FRETE"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>Contraparte (Favorecido ou Pagador) *</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Distribuidora de Energia S.A."
                  value={newCounterpart}
                  onChange={(e) => setNewCounterpart(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Valor (R$) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newAmount || ""}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  <span>Data de Vencimento *</span>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </label>
              </div>

              {newDirection === "RECEBER" && customers.length > 0 && (
                <label className="field">
                  <span>Cliente Vinculado (Opcional)</span>
                  <select
                    value={newCustomerId}
                    onChange={(e) => setNewCustomerId(e.target.value)}
                  >
                    <option value="">Nenhum / Não vinculado</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.legalName} ({c.taxId})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* Opções de Parcelamento */}
              <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-lg space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-200">
                  <input
                    type="checkbox"
                    checked={newIsInstallment}
                    onChange={(e) => setNewIsInstallment(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span>Parcelar este lançamento (gerar múltiplos títulos)</span>
                </label>

                {newIsInstallment && (
                  <div className="space-y-3 pt-2 border-t border-neutral-800">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="field">
                        <span>Quantidade de Parcelas *</span>
                        <input
                          type="number"
                          min="2"
                          max="60"
                          required
                          value={newInstallmentsCount}
                          onChange={(e) =>
                            setNewInstallmentsCount(Math.max(2, Math.min(60, Number(e.target.value) || 2)))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Intervalo (dias) *</span>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          required
                          value={newIntervalDays}
                          onChange={(e) =>
                            setNewIntervalDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))
                          }
                        />
                      </label>
                    </div>

                    {newAmount > 0 && (
                      <p className="text-xs text-neutral-400">
                        Serão gerados <span className="font-semibold text-neutral-200">{newInstallmentsCount}</span> títulos de aproximadamente{" "}
                        <span className="font-semibold text-emerald-400">
                          {formatCurrency(newAmount / newInstallmentsCount)}
                        </span>{" "}
                        a cada <span className="font-semibold text-neutral-200">{newIntervalDays} dias</span>.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {newEntryError && <p className="form-error text-xs" role="alert">{newEntryError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsNewEntryOpen(false)}
                  disabled={newEntrySubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={newEntrySubmitting}>
                  {newEntrySubmitting ? "Cadastrando..." : "Cadastrar Título"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BAIXA / PAGAMENTO */}
      {payingEntry && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full space-y-4">
            <h2 className="text-xl font-bold">
              {payingEntry.direction === "PAGAR" ? "Registrar Pagamento" : "Registrar Recebimento"}
            </h2>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded text-xs space-y-1">
              <div>
                <span className="text-neutral-400">Título:</span>{" "}
                <span className="font-semibold text-neutral-100">{payingEntry.counterpart || payingEntry.counterparty}</span>
              </div>
              <div>
                <span className="text-neutral-400">Saldo Restante:</span>{" "}
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(Number(payingEntry.outstanding))}
                </span>
              </div>
            </div>

            <form className="form-stack space-y-4" onSubmit={handleConfirmPayment}>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Valor do Pagamento (R$) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(payingEntry.outstanding)}
                    required
                    value={paymentAmount || ""}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  <span>Forma de Pagamento *</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro em Espécie</option>
                    <option value="BOLETO">Boleto Bancário</option>
                    <option value="TRANSFERENCIA">Transferência / TED</option>
                    <option value="CARTAO">Cartão de Crédito/Débito</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>Data do Pagamento *</span>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Observações / Comprovante (Opcional)</span>
                <input
                  type="text"
                  placeholder="Ex: Transação bancária autenticada"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </label>

              {paymentError && <p className="form-error text-xs" role="alert">{paymentError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setPayingEntry(null)}
                  disabled={paymentSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={paymentSubmitting}>
                  {paymentSubmitting ? "Processando..." : "Confirmar Baixa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
