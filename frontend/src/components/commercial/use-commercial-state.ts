"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  commercialApi,
  inventoryApi,
  operationsApi,
  type OperationalCustomer,
  type OperationalLot,
  type PageResult,
  type PricingList,
  type Product,
  type ProductPromotion,
  type QuotesConversionReport,
  type Sale,
  type SalesQuote,
  type SalesReportSummary,
} from "@/lib/api";
import { useCommercialModals } from "./use-commercial-modals";
import { useCommercialQuotes } from "./use-commercial-quotes";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function useCommercialState() {
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

  // Hook auxiliar de Orçamentos
  const quotesManager = useCommercialQuotes(
    customers,
    lots,
    products,
    pricingLists,
    (msg) => setActionSuccess(msg),
    (err) => setError(err),
    () => setReloadTrigger((prev) => prev + 1),
  );

  // Hook auxiliar de Modais de Tabelas, Promoções, Devolução, Fiscal e PIX
  const modals = useCommercialModals(products, currentDate, (message) => {
    if (message) setActionSuccess(message);
    setReloadTrigger((prev) => prev + 1);
  });

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

  return {
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
    // Quote & Convert delegates
    ...quotesManager,
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
    // Modals (Pricing, Promo, Return, Fiscal, Pix)
    ...modals,
    // Print
    printQuote,
    setPrintQuote,
    printSaleReceipt,
    setPrintSaleReceipt,
    // Reload
    setReloadTrigger,
    setActionSuccess,
  };
}
