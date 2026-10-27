"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import { PixModal } from "@/components/pix-modal";
import { OfxReconcileModal } from "@/components/ofx-reconcile-modal";
import {
  financeApi,
  customersApi,
  type AgingReport,
  type CashFlowSummary,
  type Customer,
  type FinancialDirection,
  type FinancialEntry,
  type FinancialStatus,
  type GeneratedPix,
  type PageResult,
} from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  EntriesTab,
  CashFlowTab,
  AgingTab,
  NewEntryModal,
  SettleEntryModal,
} from "./finance";

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

  // Modal de PIX Dinâmico (Frente 3)
  const [isPixOpen, setIsPixOpen] = useState(false);
  const [pixData, setPixData] = useState<GeneratedPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  // Modal de Conciliação Bancária OFX (Frente 3)
  const [isOfxOpen, setIsOfxOpen] = useState(false);

  async function handleGeneratePix(entryId: string) {
    setPixLoading(true);
    setError(null);
    try {
      const generated = await financeApi.generatePix(entryId);
      setPixData(generated);
      setIsPixOpen(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPixLoading(false);
    }
  }

  // Focus trap e escape para modais
  useEscapeToClose(isNewEntryOpen, () => setIsNewEntryOpen(false));
  useModalFocusTrap(isNewEntryOpen);
  useEscapeToClose(Boolean(payingEntry), () => setPayingEntry(null));
  useModalFocusTrap(Boolean(payingEntry));

  useEffect(() => {
    let current = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [entriesRes, cfRes, agingRes, customersRes] = await Promise.all([
          financeApi.getEntries(
            1,
            directionFilter === "TODOS" ? undefined : directionFilter,
            statusFilter === "TODOS" ? undefined : statusFilter,
            entriesFrom || undefined,
            entriesTo || undefined,
          ),
          financeApi.getCashFlow(cfFrom, cfTo),
          financeApi.getAgingReport(agingAsOf),
          customersApi.getCustomers(1),
        ]);

        if (current) {
          setEntries(entriesRes);
          setCashFlow(cfRes);
          setAgingReport(agingRes);
          setCustomers(customersRes.data);
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

  function handleOpenPayment(entry: FinancialEntry) {
    setPayingEntry(entry);
    setPaymentAmount(Number(entry.outstanding));
    setPaymentMethod("PIX");
    setPaymentDate(currentDate);
    setPaymentNotes("");
    setPaymentError(null);
  }

  async function handleSaveNewEntry(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newAmount <= 0) {
      setNewEntryError("O valor deve ser maior que zero.");
      return;
    }
    setNewEntrySubmitting(true);
    setNewEntryError(null);
    try {
      await financeApi.createEntry({
        direction: newDirection,
        category: newCategory,
        counterpart: newCounterpart,
        amount: newAmount,
        dueDate: newDueDate,
        customerId: newCustomerId || undefined,
        installmentsCount: newIsInstallment ? newInstallmentsCount : undefined,
        intervalDays: newIsInstallment ? newIntervalDays : undefined,
      });
      if (newIsInstallment) {
        setActionSuccess(`Lançamento parcelado em ${newInstallmentsCount}x criado com sucesso!`);
      } else {
        setActionSuccess("Lançamento financeiro cadastrado com sucesso!");
      }
      setIsNewEntryOpen(false);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNewEntryError(errorMessage(err));
    } finally {
      setNewEntrySubmitting(false);
    }
  }

  async function handleConfirmPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payingEntry) return;
    if (paymentAmount <= 0) {
      setPaymentError("O valor da baixa deve ser maior que zero.");
      return;
    }
    if (paymentAmount > Number(payingEntry.outstanding)) {
      setPaymentError("O valor excede o saldo devedor do título.");
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      await financeApi.createPayment(payingEntry.id, {
        amount: paymentAmount,
        method: paymentMethod,
        paidAt: paymentDate,
        notes: paymentNotes || undefined,
      });
      setPayingEntry(null);
      setActionSuccess("Baixa registrada com sucesso!");
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setPaymentError(errorMessage(err));
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleCancelEntry(id: string) {
    if (!confirm("Deseja realmente cancelar este título financeiro?")) return;
    try {
      await financeApi.cancelEntry(id);
      setActionSuccess("Título cancelado com sucesso.");
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-neutral-900">
            <span className="text-teal-700 flex items-center">
              <Icon name="chart" />
            </span>
            Gestão Financeira & Fluxo de Caixa
          </h1>
          <p className="text-neutral-500 text-sm">
            Contas a pagar e receber, baixas de pagamentos, conciliação e relatório de Aging schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="button button--secondary flex items-center gap-1.5 border-neutral-300 text-neutral-800 bg-white hover:bg-neutral-100 shadow-sm font-medium"
            onClick={() => setIsOfxOpen(true)}
            title="Importar e conciliar extrato bancário padrão OFX"
          >
            <span>🏦</span>
            Conciliação OFX
          </button>
          {tab === "entries" && (
            <button
              type="button"
              className="button button--primary shadow-sm"
              onClick={handleOpenNewEntry}
            >
              + Novo Lançamento Manual
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-sm flex justify-between items-center">
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex border-b border-neutral-200 gap-2">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "entries"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("entries")}
        >
          Contas a Pagar & Receber
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "cash-flow"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("cash-flow")}
        >
          Fluxo de Caixa Realizado
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === "aging"
              ? "border-teal-700 text-teal-800"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("aging")}
        >
          Aging Schedule (Faixas de Vencimento)
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {tab === "entries" && (
        <EntriesTab
          entries={entries}
          loading={loading}
          directionFilter={directionFilter}
          statusFilter={statusFilter}
          entriesFrom={entriesFrom}
          entriesTo={entriesTo}
          pixLoading={pixLoading}
          onDirectionFilterChange={setDirectionFilter}
          onStatusFilterChange={setStatusFilter}
          onEntriesFromChange={setEntriesFrom}
          onEntriesToChange={setEntriesTo}
          onClearFilters={() => {
            setDirectionFilter("TODOS");
            setStatusFilter("TODOS");
            setEntriesFrom("");
            setEntriesTo("");
          }}
          onGeneratePix={handleGeneratePix}
          onOpenPayment={handleOpenPayment}
          onCancelEntry={handleCancelEntry}
        />
      )}

      {tab === "cash-flow" && (
        <CashFlowTab
          cashFlow={cashFlow}
          cfFrom={cfFrom}
          cfTo={cfTo}
          onCfFromChange={setCfFrom}
          onCfToChange={setCfTo}
        />
      )}

      {tab === "aging" && (
        <AgingTab
          agingReport={agingReport}
          agingAsOf={agingAsOf}
          onAgingAsOfChange={setAgingAsOf}
        />
      )}

      {/* Modais Financeiros */}
      <NewEntryModal
        isOpen={isNewEntryOpen}
        direction={newDirection}
        category={newCategory}
        counterpart={newCounterpart}
        amount={newAmount}
        dueDate={newDueDate}
        customerId={newCustomerId}
        isInstallment={newIsInstallment}
        installmentsCount={newInstallmentsCount}
        intervalDays={newIntervalDays}
        submitting={newEntrySubmitting}
        error={newEntryError}
        customers={customers}
        onDirectionChange={setNewDirection}
        onCategoryChange={setNewCategory}
        onCounterpartChange={setNewCounterpart}
        onAmountChange={setNewAmount}
        onDueDateChange={setNewDueDate}
        onCustomerIdChange={setNewCustomerId}
        onIsInstallmentChange={setNewIsInstallment}
        onInstallmentsCountChange={setNewInstallmentsCount}
        onIntervalDaysChange={setNewIntervalDays}
        onClose={() => setIsNewEntryOpen(false)}
        onSubmit={handleSaveNewEntry}
      />

      <SettleEntryModal
        entry={payingEntry}
        amount={paymentAmount}
        method={paymentMethod}
        date={paymentDate}
        notes={paymentNotes}
        submitting={paymentSubmitting}
        error={paymentError}
        onAmountChange={setPaymentAmount}
        onMethodChange={setPaymentMethod}
        onDateChange={setPaymentDate}
        onNotesChange={setPaymentNotes}
        onClose={() => setPayingEntry(null)}
        onSubmit={handleConfirmPayment}
      />

      {/* Modal de Cobrança PIX com QR Code Dinâmico (Frente 3) */}
      <PixModal
        isOpen={isPixOpen}
        pixData={pixData}
        onClose={() => setIsPixOpen(false)}
        onPaymentConfirmed={() => {
          setActionSuccess("Cobrança PIX liquidada com sucesso!");
          setReloadTrigger((prev) => prev + 1);
        }}
      />

      {/* Modal de Conciliação Bancária OFX (Frente 3) */}
      <OfxReconcileModal
        isOpen={isOfxOpen}
        onClose={() => setIsOfxOpen(false)}
        onSuccess={() => {
          setActionSuccess("Extrato OFX conciliado e auditado com sucesso!");
          setReloadTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}
