"use client";

import { Icon } from "@/components/icon";
import { PixModal } from "@/components/pix-modal";
import {
  ConvertQuoteModal,
  FiscalModal,
  PricingModal,
  PricingPromotionsTab,
  PromotionModal,
  QuoteModal,
  QuotePrintModal,
  QuotesTab,
  ReportsTab,
  ReturnModal,
  SaleModal,
  SaleReceiptModal,
  SalesTab,
  useCommercialState,
} from "./commercial";

export function CommercialWorkspace() {
  const {
    tab,
    setTab,
    customers,
    lots,
    products,
    pricingLists,
    quotes,
    sales,
    promotions,
    salesReport,
    quotesReport,
    loading,
    error,
    actionSuccess,
    currentDate,
    // Quote
    isQuoteModalOpen,
    setIsQuoteModalOpen,
    editingQuote,
    quoteCustomerId,
    setQuoteCustomerId,
    quotePricingListId,
    setQuotePricingListId,
    quoteItems,
    setQuoteItems,
    quoteSubmitting,
    quoteError,
    handleOpenCreateQuote,
    handleOpenEditQuote,
    handleSaveQuote,
    handleSendQuote,
    handleCancelQuote,
    // Convert Quote
    convertingQuote,
    setConvertingQuote,
    convertDestination,
    setConvertDestination,
    convertEventLocation,
    setConvertEventLocation,
    convertEventAt,
    setConvertEventAt,
    convertCondition,
    setConvertCondition,
    convertPaymentMethod,
    setConvertPaymentMethod,
    convertDueDate,
    setConvertDueDate,
    convertSubmitting,
    convertError,
    handleOpenConvertQuote,
    handleConfirmConvertQuote,
    // Sale
    isSaleModalOpen,
    setIsSaleModalOpen,
    saleCustomerId,
    setSaleCustomerId,
    salePricingListId,
    setSalePricingListId,
    saleCondition,
    setSaleCondition,
    salePaymentMethod,
    setSalePaymentMethod,
    saleDueDate,
    setSaleDueDate,
    saleItems,
    setSaleItems,
    saleSubmitting,
    saleError,
    handleOpenCreateSale,
    handleSaveSale,
    // Return
    returningSale,
    setReturningSale,
    returnReason,
    setReturnReason,
    returnItems,
    setReturnItems,
    returnSubmitting,
    returnError,
    handleOpenReturn,
    handleConfirmReturn,
    // Pricing
    isPricingModalOpen,
    setIsPricingModalOpen,
    newPricingName,
    setNewPricingName,
    newPricingItems,
    setNewPricingItems,
    pricingSubmitting,
    pricingError,
    handleOpenPricingModal,
    handleSavePricingList,
    // Promo
    isPromoModalOpen,
    setIsPromoModalOpen,
    promoName,
    setPromoName,
    promoStartsAt,
    setPromoStartsAt,
    promoEndsAt,
    setPromoEndsAt,
    promoItems,
    setPromoItems,
    promoSubmitting,
    promoError,
    handleOpenPromoModal,
    handleSavePromotion,
    handleTogglePromotion,
    // Fiscal
    fiscalSale,
    setFiscalSale,
    fiscalType,
    setFiscalType,
    fiscalNature,
    setFiscalNature,
    fiscalSubmitting,
    fiscalError,
    fiscalSuccess,
    handleOpenFiscalModal,
    handleSubmitFiscal,
    // Pix
    isPixModalOpen,
    setIsPixModalOpen,
    pixData,
    pixLoading,
    handleOpenPixModal,
    // Print
    printQuote,
    setPrintQuote,
    printSaleReceipt,
    setPrintSaleReceipt,
    // Reload
    setReloadTrigger,
    setActionSuccess,
  } = useCommercialState();

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão Comercial & Vendas</p>
          <h1 className="text-2xl font-bold">Comercial, PDV e Orçamentos</h1>
          <p className="text-sm text-neutral-400">
            Orçamentos com reserva por 7 dias, checkout de balcão e a prazo, promoções de menor preço e relatórios de conversão.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="button button--secondary flex items-center gap-2" onClick={handleOpenCreateQuote}>
            <Icon name="spark" size={18} />
            Novo orçamento
          </button>
          <button className="button button--primary flex items-center gap-2" onClick={handleOpenCreateSale}>
            <Icon name="receipt" size={18} />
            Nova venda (PDV)
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 gap-4">
        {[
          { id: "quotes", label: "Orçamentos Comerciais" },
          { id: "sales", label: "Vendas Concluídas" },
          { id: "pricing", label: "Preços & Promoções" },
          { id: "reports", label: "Relatórios & Conversão" },
        ].map((t) => (
          <button
            key={t.id}
            className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary-500 text-primary-400"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
            onClick={() => setTab(t.id as typeof tab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {actionSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-700 text-emerald-300 text-xs rounded">
          {actionSuccess}
        </div>
      )}

      {/* Abas */}
      {tab === "quotes" && (
        <QuotesTab
          loading={loading}
          quotes={quotes}
          currentDate={currentDate}
          onPrintQuote={(q) => setPrintQuote(q)}
          onSendQuote={handleSendQuote}
          onEditQuote={handleOpenEditQuote}
          onConvertQuote={handleOpenConvertQuote}
          onCancelQuote={handleCancelQuote}
        />
      )}

      {tab === "sales" && (
        <SalesTab
          sales={sales}
          pixLoading={pixLoading}
          onOpenFiscalModal={handleOpenFiscalModal}
          onOpenPixModal={handleOpenPixModal}
          onPrintSaleReceipt={(s) => setPrintSaleReceipt(s)}
          onOpenReturn={handleOpenReturn}
        />
      )}

      {tab === "pricing" && (
        <PricingPromotionsTab
          pricingLists={pricingLists}
          promotions={promotions}
          onOpenPricingModal={handleOpenPricingModal}
          onOpenPromoModal={handleOpenPromoModal}
          onTogglePromotion={handleTogglePromotion}
        />
      )}

      {tab === "reports" && (
        <ReportsTab
          quotesReport={quotesReport}
          salesReport={salesReport}
        />
      )}

      {/* Modais */}
      <QuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        editingQuote={editingQuote}
        customerId={quoteCustomerId}
        onCustomerIdChange={setQuoteCustomerId}
        pricingListId={quotePricingListId}
        onPricingListIdChange={setQuotePricingListId}
        items={quoteItems}
        onItemsChange={setQuoteItems}
        customers={customers}
        pricingLists={pricingLists}
        products={products}
        lots={lots}
        submitting={quoteSubmitting}
        error={quoteError}
        onSubmit={handleSaveQuote}
      />

      <ConvertQuoteModal
        quote={convertingQuote}
        onClose={() => setConvertingQuote(null)}
        destination={convertDestination}
        onDestinationChange={setConvertDestination}
        eventLocation={convertEventLocation}
        onEventLocationChange={setConvertEventLocation}
        eventAt={convertEventAt}
        onEventAtChange={setConvertEventAt}
        condition={convertCondition}
        onConditionChange={setConvertCondition}
        paymentMethod={convertPaymentMethod}
        onPaymentMethodChange={setConvertPaymentMethod}
        dueDate={convertDueDate}
        onDueDateChange={setConvertDueDate}
        submitting={convertSubmitting}
        error={convertError}
        onSubmit={handleConfirmConvertQuote}
      />

      <SaleModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        customerId={saleCustomerId}
        onCustomerIdChange={setSaleCustomerId}
        pricingListId={salePricingListId}
        onPricingListIdChange={setSalePricingListId}
        condition={saleCondition}
        onConditionChange={setSaleCondition}
        paymentMethod={salePaymentMethod}
        onPaymentMethodChange={setSalePaymentMethod}
        dueDate={saleDueDate}
        onDueDateChange={setSaleDueDate}
        items={saleItems}
        onItemsChange={setSaleItems}
        customers={customers}
        pricingLists={pricingLists}
        products={products}
        lots={lots}
        submitting={saleSubmitting}
        error={saleError}
        onSubmit={handleSaveSale}
      />

      <ReturnModal
        sale={returningSale}
        onClose={() => setReturningSale(null)}
        reason={returnReason}
        onReasonChange={setReturnReason}
        items={returnItems}
        onItemsChange={setReturnItems}
        submitting={returnSubmitting}
        error={returnError}
        onSubmit={handleConfirmReturn}
      />

      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
        name={newPricingName}
        onNameChange={setNewPricingName}
        items={newPricingItems}
        onItemsChange={setNewPricingItems}
        products={products}
        submitting={pricingSubmitting}
        error={pricingError}
        onSubmit={handleSavePricingList}
      />

      <PromotionModal
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        name={promoName}
        onNameChange={setPromoName}
        startsAt={promoStartsAt}
        onStartsAtChange={setPromoStartsAt}
        endsAt={promoEndsAt}
        onEndsAtChange={setPromoEndsAt}
        items={promoItems}
        onItemsChange={setPromoItems}
        products={products}
        submitting={promoSubmitting}
        error={promoError}
        onSubmit={handleSavePromotion}
      />

      <FiscalModal
        sale={fiscalSale}
        onClose={() => setFiscalSale(null)}
        type={fiscalType}
        onTypeChange={setFiscalType}
        nature={fiscalNature}
        onNatureChange={setFiscalNature}
        submitting={fiscalSubmitting}
        error={fiscalError}
        success={fiscalSuccess}
        onSubmit={handleSubmitFiscal}
      />

      <PixModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        pixData={pixData}
        onPaymentConfirmed={() => {
          setIsPixModalOpen(false);
          setActionSuccess("Pagamento PIX liquidado e compensado com sucesso!");
          setReloadTrigger((prev) => prev + 1);
        }}
      />

      <QuotePrintModal
        quote={printQuote}
        onClose={() => setPrintQuote(null)}
      />

      <SaleReceiptModal
        sale={printSaleReceipt}
        onClose={() => setPrintSaleReceipt(null)}
      />
    </div>
  );
}
