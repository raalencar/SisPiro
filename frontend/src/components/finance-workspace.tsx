"use client";

import { Icon } from "@/components/icon";
import { PixModal } from "@/components/pix-modal";
import { OfxReconcileModal } from "@/components/ofx-reconcile-modal";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  EntriesTab,
  CashFlowTab,
  AgingTab,
  NewEntryModal,
  SettleEntryModal,
  useFinanceState,
} from "./finance";

export function FinanceWorkspace() {
  const {
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
  } = useFinanceState();

  // Focus trap e escape para modais
  useEscapeToClose(isNewEntryOpen, () => setIsNewEntryOpen(false));
  useModalFocusTrap(isNewEntryOpen);
  useEscapeToClose(Boolean(payingEntry), () => setPayingEntry(null));
  useModalFocusTrap(Boolean(payingEntry));

  return (
    <div className="workspace space-y-6">
      {/* Header com Ações Rápidas */}
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão Financeira & Tesouraria</p>
          <h1 className="text-2xl font-bold">Contas a Pagar, Receber e Fluxo</h1>
          <p className="text-sm text-neutral-400">
            Controle de liquidez, conciliação bancária OFX, cobrança PIX e risco de crédito.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="button button--secondary flex items-center gap-2"
            onClick={() => setIsOfxOpen(true)}
          >
            <Icon name="receipt" size={18} />
            Conciliação OFX
          </button>
          <button
            type="button"
            className="button button--primary flex items-center gap-2"
            onClick={handleOpenNewEntry}
          >
            <Icon name="chart" size={18} />
            Novo Lançamento
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 gap-4">
        <button
          type="button"
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "entries"
              ? "border-teal-700 text-teal-800 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("entries")}
        >
          Lançamentos (Pagar / Receber)
        </button>
        <button
          type="button"
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "cash-flow"
              ? "border-teal-700 text-teal-800 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("cash-flow")}
        >
          Fluxo de Caixa
        </button>
        <button
          type="button"
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "aging"
              ? "border-teal-700 text-teal-800 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
          onClick={() => setTab("aging")}
        >
          Aging Schedule (Inadimplência)
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {actionSuccess && <p className="form-success" role="status">{actionSuccess}</p>}

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
          onOpenPayment={handleOpenPayment}
          onGeneratePix={handleGeneratePix}
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

      {/* Modal de Novo Lançamento */}
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
        customers={customers}
        submitting={newEntrySubmitting}
        error={newEntryError}
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

      {/* Modal de Pagamento / Baixa */}
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

      {/* Modal de PIX Dinâmico (Frente 3) */}
      <PixModal
        isOpen={isPixOpen}
        pixData={pixData}
        onClose={() => setIsPixOpen(false)}
        onPaymentConfirmed={() => {
          setIsPixOpen(false);
          setReloadTrigger((v) => v + 1);
        }}
      />

      {/* Modal de Conciliação Bancária OFX (Frente 3) */}
      <OfxReconcileModal
        isOpen={isOfxOpen}
        onClose={() => setIsOfxOpen(false)}
        onSuccess={() => {
          setReloadTrigger((v) => v + 1);
        }}
      />
    </div>
  );
}
