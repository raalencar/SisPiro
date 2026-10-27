"use client";

import { useEffect, useState, type FormEvent } from "react";
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

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação financeira.";
}

export function useFinanceState() {
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

  return {
    tab,
    setTab,
    entries,
    cashFlow,
    agingReport,
    customers,
    loading,
    error,
    actionSuccess,
    directionFilter,
    setDirectionFilter,
    statusFilter,
    setStatusFilter,
    entriesFrom,
    setEntriesFrom,
    entriesTo,
    setEntriesTo,
    cfFrom,
    setCfFrom,
    cfTo,
    setCfTo,
    agingAsOf,
    setAgingAsOf,
    isNewEntryOpen,
    setIsNewEntryOpen,
    newDirection,
    setNewDirection,
    newCategory,
    setNewCategory,
    newCounterpart,
    setNewCounterpart,
    newAmount,
    setNewAmount,
    newDueDate,
    setNewDueDate,
    newCustomerId,
    setNewCustomerId,
    newIsInstallment,
    setNewIsInstallment,
    newInstallmentsCount,
    setNewInstallmentsCount,
    newIntervalDays,
    setNewIntervalDays,
    newEntrySubmitting,
    newEntryError,
    payingEntry,
    setPayingEntry,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    setPaymentMethod,
    paymentDate,
    setPaymentDate,
    paymentNotes,
    setPaymentNotes,
    paymentSubmitting,
    paymentError,
    isPixOpen,
    setIsPixOpen,
    pixData,
    pixLoading,
    isOfxOpen,
    setIsOfxOpen,
    handleGeneratePix,
    handleOpenNewEntry,
    handleOpenPayment,
    handleSaveNewEntry,
    handleConfirmPayment,
    handleCancelEntry,
    setReloadTrigger,
  };
}
