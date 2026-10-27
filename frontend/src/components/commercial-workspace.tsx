"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  commercialApi,
  financeApi,
  fiscalApi,
  inventoryApi,
  operationsApi,
  type FiscalDocument,
  type GeneratedPix,
  type OperationalCustomer,
  type OperationalLot,
  type PageResult,
  type PricingList,
  type Product,
  type ProductPromotion,
  type PromotionDiscountType,
  type QuotesConversionReport,
  type Sale,
  type SalesQuote,
  type SalesReportSummary,
} from "@/lib/api";
import { PixModal } from "@/components/pix-modal";
import { useToast } from "@/components/toast-provider";
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
} from "./commercial/index";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function CommercialWorkspace() {
  const toast = useToast();
  const [tab, setTab] = useState<"sales" | "quotes" | "pricing" | "reports">("quotes");

  // Dados globais de apoio
  const [customers, setCustomers] = useState<OperationalCustomer[]>([]);
  const [lots, setLots] = useState<OperationalLot[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricingLists, setPricingLists] = useState<PricingList[]>([]);

  // Estados de dados
  const [quotes, setQuotes] = useState<PageResult<SalesQuote> | null>(null);
  const [sales, setSales] = useState<PageResult<Sale> | null>(null);
  const [promotions, setPromotions] = useState<PageResult<ProductPromotion> | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReportSummary | null>(null);
  const [quotesReport, setQuotesReport] = useState<QuotesConversionReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [currentDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Filtros de relatórios
  const [reportFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [reportTo] = useState(() => new Date().toISOString().slice(0, 10));

  // Modal Novo Orçamento / Edição de Orçamento
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<SalesQuote | null>(null);
  const [quoteCustomerId, setQuoteCustomerId] = useState("");
  const [quotePricingListId, setQuotePricingListId] = useState("");
  const [quoteItems, setQuoteItems] = useState<
    Array<{ productId: string; productLotId: string; quantity: number }>
  >([{ productId: "", productLotId: "", quantity: 1 }]);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Modal Conversão de Orçamento (Dual: Venda ou Ordem de Serviço)
  const [convertingQuote, setConvertingQuote] = useState<SalesQuote | null>(null);
  const [convertDestination, setConvertDestination] = useState<"SALE" | "ORDER">("SALE");
  const [convertEventLocation, setConvertEventLocation] = useState("Local do Espetáculo");
  const [convertEventAt, setConvertEventAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 16);
  });
  const [convertCondition, setConvertCondition] = useState<"IMEDIATO" | "PRAZO">("IMEDIATO");
  const [convertPaymentMethod, setConvertPaymentMethod] = useState("PIX");
  const [convertDueDate, setConvertDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  // Modal Checkout Venda Direta
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleCustomerId, setSaleCustomerId] = useState<string>("");
  const [salePricingListId, setSalePricingListId] = useState("");
  const [saleCondition, setSaleCondition] = useState<"IMEDIATO" | "PRAZO">("IMEDIATO");
  const [salePaymentMethod, setSalePaymentMethod] = useState("PIX");
  const [saleDueDate, setSaleDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saleItems, setSaleItems] = useState<
    Array<{ productId: string; productLotId: string; quantity: number }>
  >([{ productId: "", productLotId: "", quantity: 1 }]);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  // Modal Devolução de Venda
  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnItems, setReturnItems] = useState<
    Array<{ saleItemId: string; quantity: number }>
  >([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Modal Nova Tabela de Preço
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [newPricingName, setNewPricingName] = useState("");
  const [newPricingItems, setNewPricingItems] = useState<
    Array<{ productId: string; unitPrice: number }>
  >([]);
  const [pricingSubmitting, setPricingSubmitting] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Modal Nova Promoção
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoName, setPromoName] = useState("");
  const [promoStartsAt, setPromoStartsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [promoEndsAt, setPromoEndsAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [promoItems, setPromoItems] = useState<
    Array<{
      productId: string;
      discountType: PromotionDiscountType;
      promotionalPrice?: number;
      discountPercent?: number;
    }>
  >([]);
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Estados de Emissão Fiscal da Venda
  const [fiscalSale, setFiscalSale] = useState<Sale | null>(null);
  const [fiscalType, setFiscalType] = useState<"NFE" | "NFCE">("NFE");
  const [fiscalNature, setFiscalNature] = useState("Venda de mercadoria");
  const [fiscalSubmitting, setFiscalSubmitting] = useState(false);
  const [fiscalError, setFiscalError] = useState<string | null>(null);
  const [fiscalSuccess, setFiscalSuccess] = useState<FiscalDocument | null>(null);

  // Estados de Cobrança PIX da Venda
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<GeneratedPix | null>(null);
  const [pixLoading, setPixLoading] = useState(false);

  // Estados para Impressão de Proposta Comercial e Comprovante de Balcão
  const [printQuote, setPrintQuote] = useState<SalesQuote | null>(null);
  const [printSaleReceipt, setPrintSaleReceipt] = useState<Sale | null>(null);

  // Carregamento de dados
  useEffect(() => {
    let current = true;
    const reqs: [
      Promise<PageResult<OperationalCustomer>>,
      Promise<PageResult<OperationalLot>>,
      Promise<PageResult<Product>>,
      Promise<PageResult<PricingList>>,
      Promise<PageResult<SalesQuote>>,
      Promise<PageResult<Sale>>,
      Promise<PageResult<ProductPromotion>>,
      Promise<SalesReportSummary>,
      Promise<QuotesConversionReport>,
    ] = [
      operationsApi.getCustomers(1),
      operationsApi.getLots(1),
      inventoryApi.getProducts(1),
      commercialApi.getPricingLists(1),
      commercialApi.getQuotes(1),
      commercialApi.getSales(1),
      commercialApi.getPromotions(1),
      commercialApi.getSalesReport(reportFrom, reportTo),
      commercialApi.getQuotesConversionReport(reportFrom, reportTo),
    ];

    void Promise.allSettled(reqs)
      .then(
        ([
          custRes,
          lotsRes,
          prodRes,
          pricingRes,
          quotesRes,
          salesRes,
          promoRes,
          salesRepRes,
          quotesRepRes,
        ]) => {
          if (!current) return;
          if (custRes.status === "fulfilled") setCustomers(custRes.value.data);
          if (lotsRes.status === "fulfilled") setLots(lotsRes.value.data);
          if (prodRes.status === "fulfilled") setProducts(prodRes.value.data);
          if (pricingRes.status === "fulfilled") setPricingLists(pricingRes.value.data);
          if (quotesRes.status === "fulfilled") setQuotes(quotesRes.value);
          if (salesRes.status === "fulfilled") setSales(salesRes.value);
          if (promoRes.status === "fulfilled") setPromotions(promoRes.value);
          if (salesRepRes.status === "fulfilled") setSalesReport(salesRepRes.value);
          if (quotesRepRes.status === "fulfilled") setQuotesReport(quotesRepRes.value);
        },
      )
      .catch((err: unknown) => {
        if (current) setError(errorMessage(err));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [reportFrom, reportTo, reloadTrigger]);

  function handleOpenCreateQuote() {
    setEditingQuote(null);
    setQuoteCustomerId(customers[0]?.id || "");
    setQuotePricingListId(pricingLists[0]?.id || "");
    setQuoteItems([{ productId: products[0]?.id || "", productLotId: lots[0]?.id || "", quantity: 1 }]);
    setQuoteError(null);
    setIsQuoteModalOpen(true);
  }

  function handleOpenEditQuote(q: SalesQuote) {
    setEditingQuote(q);
    setQuoteCustomerId(q.customerId || "");
    setQuotePricingListId(q.priceListId);
    setQuoteItems(
      q.items.map((it) => ({
        productId: it.productId,
        productLotId: it.productLotId,
        quantity: Number(it.quantity),
      })),
    );
    setQuoteError(null);
    setIsQuoteModalOpen(true);
  }

  async function handleSaveQuote(e: FormEvent) {
    e.preventDefault();
    setQuoteSubmitting(true);
    setQuoteError(null);
    try {
      const payload = {
        customerId: quoteCustomerId || undefined,
        priceListId: quotePricingListId,
        items: quoteItems.map((it) => ({
          productLotId: it.productLotId,
          quantity: Number(it.quantity),
        })),
      };

      if (editingQuote) {
        await commercialApi.updateQuote(editingQuote.id, payload);
        setActionSuccess("Orçamento atualizado e reserva recalculada com sucesso.");
      } else {
        await commercialApi.createQuote(payload);
        setActionSuccess("Orçamento emitido com sucesso com reserva ativa por 7 dias.");
      }

      setIsQuoteModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setQuoteError(errorMessage(err));
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function handleSendQuote(quoteId: string) {
    try {
      await commercialApi.sendQuote(quoteId);
      setActionSuccess("Envio do orçamento agendado com sucesso via BullMQ.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCancelQuote(quoteId: string) {
    if (!window.confirm("Deseja realmente cancelar este orçamento e liberar a reserva de estoque?")) return;
    try {
      await commercialApi.cancelQuote(quoteId);
      setActionSuccess("Orçamento cancelado e reserva liberada.");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function handleOpenConvertQuote(q: SalesQuote) {
    setConvertingQuote(q);
    setConvertDestination("SALE");
    setConvertEventLocation("Praça Central / Local do Espetáculo");
    const d = new Date(Date.now() + 7 * 86400000);
    setConvertEventAt(d.toISOString().slice(0, 16));
    setConvertCondition("IMEDIATO");
    setConvertPaymentMethod("PIX");
    setConvertDueDate(new Date().toISOString().slice(0, 10));
    setConvertError(null);
  }

  async function handleConfirmConvertQuote(e: FormEvent) {
    e.preventDefault();
    if (!convertingQuote) return;
    setConvertSubmitting(true);
    setConvertError(null);
    try {
      if (convertDestination === "ORDER") {
        if (!convertingQuote.customerId) {
          throw new Error("Cliente obrigatório para gerar Ordem de Serviço.");
        }
        await operationsApi.createOrder({
          customerId: convertingQuote.customerId,
          contractedAmount: Number(convertingQuote.total),
          eventLocation: convertEventLocation.trim(),
          eventAt: new Date(convertEventAt).toISOString(),
          items: convertingQuote.items.map((it) => ({
            productId: it.productId,
            productLotId: it.productLotId,
            plannedQuantity: Number(it.quantity),
          })),
        });
        await commercialApi.cancelQuote(convertingQuote.id);
        setActionSuccess("Orçamento convertido em Ordem de Serviço de Show com sucesso!");
      } else {
        await commercialApi.convertQuote(convertingQuote.id, {
          condition: convertCondition,
          paymentMethod: convertCondition === "IMEDIATO" ? convertPaymentMethod : undefined,
          dueDate: convertCondition === "PRAZO" ? convertDueDate : undefined,
        });
        setActionSuccess("Orçamento convertido em Venda Direta com sucesso!");
      }

      setConvertingQuote(null);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setConvertError(errorMessage(err));
    } finally {
      setConvertSubmitting(false);
    }
  }

  function handleOpenCreateSale() {
    setSaleCustomerId(customers[0]?.id || "");
    setSalePricingListId(pricingLists[0]?.id || "");
    setSaleCondition("IMEDIATO");
    setSalePaymentMethod("PIX");
    setSaleDueDate(currentDate);
    setSaleItems([{ productId: products[0]?.id || "", productLotId: lots[0]?.id || "", quantity: 1 }]);
    setSaleError(null);
    setIsSaleModalOpen(true);
  }

  async function handleSaveSale(e: FormEvent) {
    e.preventDefault();
    setSaleSubmitting(true);
    setSaleError(null);
    try {
      await commercialApi.createSale({
        customerId: saleCustomerId || undefined,
        priceListId: salePricingListId,
        condition: saleCondition,
        paymentMethod: saleCondition === "IMEDIATO" ? salePaymentMethod : undefined,
        dueDate: saleCondition === "PRAZO" ? saleDueDate : undefined,
        items: saleItems.map((it) => ({
          productLotId: it.productLotId,
          quantity: Number(it.quantity),
        })),
      });

      setIsSaleModalOpen(false);
      setActionSuccess("Venda finalizada com sucesso!");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setSaleError(errorMessage(err));
    } finally {
      setSaleSubmitting(false);
    }
  }

  function handleOpenReturn(sale: Sale) {
    setReturningSale(sale);
    setReturnReason("Desistência do cliente");
    setReturnItems(
      sale.items.map((it) => ({
        saleItemId: it.id,
        quantity: Number(it.quantity),
      })),
    );
    setReturnError(null);
  }

  async function handleConfirmReturn(e: FormEvent) {
    e.preventDefault();
    if (!returningSale) return;
    setReturnSubmitting(true);
    setReturnError(null);
    try {
      await commercialApi.createReturn(returningSale.id, {
        reason: returnReason.trim(),
        items: returnItems,
      });

      setReturningSale(null);
      setActionSuccess("Devolução de mercadorias registrada com sucesso!");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setReturnError(errorMessage(err));
    } finally {
      setReturnSubmitting(false);
    }
  }

  function handleOpenPricingModal() {
    setNewPricingName("");
    setNewPricingItems(
      products.map((p) => ({
        productId: p.id,
        unitPrice: 10,
      })),
    );
    setPricingError(null);
    setIsPricingModalOpen(true);
  }

  async function handleSavePricingList(e: FormEvent) {
    e.preventDefault();
    if (!newPricingName.trim()) return;
    setPricingSubmitting(true);
    setPricingError(null);
    try {
      await commercialApi.createPricingList({
        name: newPricingName.trim(),
        items: newPricingItems,
      });
      setIsPricingModalOpen(false);
      setActionSuccess("Tabela de preços cadastrada com sucesso!");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setPricingError(errorMessage(err));
    } finally {
      setPricingSubmitting(false);
    }
  }

  function handleOpenPromoModal() {
    setPromoName("");
    setPromoStartsAt(currentDate);
    setPromoEndsAt(currentDate);
    setPromoItems(
      products.map((p) => ({
        productId: p.id,
        discountType: "PERCENTUAL" as PromotionDiscountType,
        discountPercent: 10,
      })),
    );
    setPromoError(null);
    setIsPromoModalOpen(true);
  }

  async function handleSavePromotion(e: FormEvent) {
    e.preventDefault();
    if (!promoName.trim() || promoItems.length === 0) return;
    setPromoSubmitting(true);
    setPromoError(null);
    try {
      await commercialApi.createPromotion({
        name: promoName.trim(),
        effectiveFrom: promoStartsAt,
        effectiveUntil: promoEndsAt,
        items: promoItems,
      });
      setIsPromoModalOpen(false);
      setActionSuccess("Campanha promocional cadastrada com sucesso!");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setPromoError(errorMessage(err));
    } finally {
      setPromoSubmitting(false);
    }
  }

  async function handleTogglePromotion(promoId: string, currentActive: boolean) {
    try {
      await commercialApi.togglePromotion(promoId, !currentActive);
      setActionSuccess(`Promoção ${!currentActive ? "ativada" : "desativada"} com sucesso!`);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function handleOpenFiscalModal(sale: Sale) {
    setFiscalSale(sale);
    setFiscalType(sale.customer ? "NFE" : "NFCE");
    setFiscalNature("Venda de mercadoria");
    setFiscalError(null);
    setFiscalSuccess(null);
  }

  async function handleSubmitFiscal(e: FormEvent) {
    e.preventDefault();
    if (!fiscalSale) return;
    setFiscalSubmitting(true);
    setFiscalError(null);
    try {
      let doc: FiscalDocument;
      if (fiscalType === "NFE") {
        doc = await fiscalApi.emitNFe({
          saleId: fiscalSale.id,
          natureOfOperation: fiscalNature.trim() || "Venda de mercadoria",
        });
      } else {
        doc = await fiscalApi.emitNFCe({
          saleId: fiscalSale.id,
        });
      }
      setFiscalSuccess(doc);
      setActionSuccess(`${doc.type} #${doc.number} emitida e autorizada com sucesso pela SEFAZ!`);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setFiscalError(errorMessage(err));
    } finally {
      setFiscalSubmitting(false);
    }
  }

  async function handleOpenPixModal(sale: Sale) {
    setPixLoading(true);
    try {
      let entryId = sale.financialEntry?.id;
      if (!entryId) {
        const entries = await financeApi.getEntries(1, "RECEBER");
        const match = entries.data.find(
          (e) =>
            (sale.customer && e.counterparty?.includes(sale.customer.legalName)) ||
            Math.abs(Number(e.amount) - Number(sale.total)) < 0.01,
        );
        if (match) {
          entryId = match.id;
        }
      }

      if (!entryId) {
        throw new Error(
          "Nenhum título a receber pendente encontrado para esta venda.",
        );
      }

      const pix = await financeApi.generatePix(entryId);
      setPixData(pix);
      setIsPixModalOpen(true);
    } catch (err) {
      toast.error("Erro ao gerar QR Code PIX para a venda: " + errorMessage(err));
    } finally {
      setPixLoading(false);
    }
  }

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
