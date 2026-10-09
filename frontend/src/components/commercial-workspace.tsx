"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
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
  type PromotionDiscountType,
  type QuotesConversionReport,
  type Sale,
  type SalesQuote,
  type SalesReportSummary,
} from "@/lib/api";
import { formatCurrency, formatDateOnly, formatNumber } from "@/lib/format";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function CommercialWorkspace() {
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

  // Modal Conversão de Orçamento
  const [convertingQuote, setConvertingQuote] = useState<SalesQuote | null>(null);
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
  const [returnDueDate, setReturnDueDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    setQuoteCustomerId(q.customerId);
    setQuotePricingListId(q.pricingListId);
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
        customerId: quoteCustomerId,
        pricingListId: quotePricingListId,
        items: quoteItems.map((it) => ({
          productId: it.productId,
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
      await commercialApi.convertQuote(convertingQuote.id, {
        condition: convertCondition,
        paymentMethod: convertCondition === "IMEDIATO" ? convertPaymentMethod : undefined,
        dueDate: convertCondition === "PRAZO" ? convertDueDate : undefined,
      });
      setConvertingQuote(null);
      setActionSuccess("Orçamento convertido em venda concluída com sucesso.");
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
    setSaleDueDate(new Date().toISOString().slice(0, 10));
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
        pricingListId: salePricingListId,
        condition: saleCondition,
        paymentMethod: saleCondition === "IMEDIATO" ? salePaymentMethod : undefined,
        dueDate: saleCondition === "PRAZO" ? saleDueDate : undefined,
        items: saleItems.map((it) => ({
          productId: it.productId,
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

  function handleOpenReturn(s: Sale) {
    setReturningSale(s);
    setReturnReason("");
    setReturnDueDate(new Date().toISOString().slice(0, 10));
    setReturnItems(
      s.items
        .filter((it) => Number(it.quantity) > Number(it.returnedQuantity))
        .map((it) => ({
          saleItemId: it.id,
          quantity: Number(it.quantity) - Number(it.returnedQuantity),
        })),
    );
    setReturnError(null);
  }

  async function handleConfirmReturn(e: FormEvent) {
    e.preventDefault();
    if (!returningSale || returnItems.length === 0) return;
    setReturnSubmitting(true);
    setReturnError(null);
    try {
      await commercialApi.createReturn(returningSale.id, {
        reason: returnReason.trim(),
        dueDate: returnDueDate,
        items: returnItems,
      });
      setReturningSale(null);
      setActionSuccess("Devolução registrada com reentrada no lote de estoque.");
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setReturnError(errorMessage(err));
    } finally {
      setReturnSubmitting(false);
    }
  }

  function handleOpenPricingModal() {
    setNewPricingName("");
    setNewPricingItems(products.map((p) => ({ productId: p.id, unitPrice: 0 })));
    setPricingError(null);
    setIsPricingModalOpen(true);
  }

  async function handleSavePricingList(e: FormEvent) {
    e.preventDefault();
    if (!newPricingName.trim() || newPricingItems.length === 0) return;
    setPricingSubmitting(true);
    setPricingError(null);
    try {
      await commercialApi.createPricingList({
        name: newPricingName.trim(),
        items: newPricingItems.filter((it) => it.unitPrice > 0),
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
        startsAt: promoStartsAt,
        endsAt: promoEndsAt,
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
      <div className="flex border-b border-neutral-800 gap-4">
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

      {/* ABA 1: ORÇAMENTOS */}
      {tab === "quotes" && (
        <div className="space-y-4">
          <div className="panel p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-neutral-400">Carregando orçamentos...</div>
            ) : !quotes || quotes.data.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">Nenhum orçamento emitido.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Valor Total</th>
                      <th className="p-3">Validade / Reserva</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {quotes.data.map((q) => {
                      const isExpired = Boolean(
                        q.validUntil && q.validUntil.slice(0, 10) < currentDate,
                      );
                      return (
                        <tr key={q.id} className="hover:bg-neutral-800/30">
                          <td className="p-3 text-xs text-neutral-400">{formatDateOnly(q.createdAt)}</td>
                          <td className="p-3 font-semibold text-neutral-100">{q.customer?.legalName || "Cliente"}</td>
                          <td className="p-3 font-mono font-bold text-neutral-100">{formatCurrency(Number(q.totalAmount))}</td>
                          <td className="p-3 text-xs">
                            <span className={isExpired ? "text-rose-400 font-bold" : "text-emerald-400"}>
                              {formatDateOnly(q.validUntil)} {isExpired ? "(Expirado)" : "(Reserva ativa)"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`status-pill ${
                                q.status === "EMITIDO"
                                  ? isExpired
                                    ? "status-pill--neutral"
                                    : "status-pill--warning"
                                  : q.status === "CONVERTIDO"
                                    ? "status-pill--available"
                                    : "status-pill--error"
                              }`}
                            >
                              {q.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {q.status === "EMITIDO" && !isExpired && (
                                <>
                                  <button
                                    className="button button--ghost text-xs py-1 px-2 text-primary-400"
                                    onClick={() => handleSendQuote(q.id)}
                                    title="Enviar orçamento por e-mail via BullMQ"
                                  >
                                    Enviar
                                  </button>
                                  <button
                                    className="button button--secondary text-xs py-1 px-2"
                                    onClick={() => handleOpenEditQuote(q)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="button button--primary text-xs py-1 px-2"
                                    onClick={() => handleOpenConvertQuote(q)}
                                  >
                                    Converter
                                  </button>
                                  <button
                                    className="button button--ghost text-xs py-1 px-2 text-rose-400"
                                    onClick={() => handleCancelQuote(q.id)}
                                  >
                                    Cancelar
                                  </button>
                                </>
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

      {/* ABA 2: VENDAS PDV */}
      {tab === "sales" && (
        <div className="space-y-4">
          <div className="panel p-0 overflow-hidden">
            {!sales || sales.data.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">Nenhuma venda finalizada.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Itens</th>
                      <th className="p-3">Valor Líquido</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {sales.data.map((s) => (
                      <tr key={s.id} className="hover:bg-neutral-800/30">
                        <td className="p-3 text-xs text-neutral-400">{formatDateOnly(s.createdAt)}</td>
                        <td className="p-3 font-semibold text-neutral-100">
                          {s.customer ? s.customer.legalName : "Venda de Balcão (s/ cliente)"}
                        </td>
                        <td className="p-3 text-xs">
                          {s.items.map((it, i) => (
                            <div key={i} className="text-neutral-300">
                              {it.product?.name || "Produto"}: {formatNumber(Number(it.quantity))} un.
                            </div>
                          ))}
                        </td>
                        <td className="p-3 font-mono font-bold text-neutral-100">
                          {formatCurrency(Number(s.totalAmount))}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            className="button button--ghost text-xs py-1 px-2 text-amber-400"
                            onClick={() => handleOpenReturn(s)}
                          >
                            Devolver Itens
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 3: PREÇOS E PROMOÇÕES */}
      {tab === "pricing" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tabelas de Preço */}
          <div className="panel space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Tabelas de Preço</h2>
              <button className="button button--secondary text-xs" onClick={handleOpenPricingModal}>
                + Nova Tabela
              </button>
            </div>
            <div className="space-y-2">
              {pricingLists.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">Nenhuma tabela cadastrada.</div>
              ) : (
                pricingLists.map((pl) => (
                  <div key={pl.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                    <div className="font-semibold text-neutral-100">{pl.name}</div>
                    <div className="text-xs text-neutral-400">Criada em: {formatDateOnly(pl.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Promoções */}
          <div className="panel space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Campanhas Promocionais</h2>
              <button className="button button--secondary text-xs" onClick={handleOpenPromoModal}>
                + Nova Promoção
              </button>
            </div>
            <div className="space-y-2">
              {!promotions || promotions.data.length === 0 ? (
                <div className="p-4 text-center text-xs text-neutral-500">Nenhuma campanha cadastrada.</div>
              ) : (
                promotions.data.map((pr) => (
                  <div key={pr.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-neutral-100">{pr.name}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`status-pill ${
                            pr.active ? "status-pill--available" : "status-pill--neutral"
                          }`}
                        >
                          {pr.active ? "Ativa" : "Inativa"}
                        </span>
                        <button
                          type="button"
                          className="button button--ghost text-xs py-0.5 px-2 text-neutral-300"
                          onClick={() => handleTogglePromotion(pr.id, pr.active)}
                        >
                          {pr.active ? "Desativar" : "Ativar"}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400">
                      Vigência: {formatDateOnly(pr.startsAt)} até {formatDateOnly(pr.endsAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: RELATÓRIOS & CONVERSÃO */}
      {tab === "reports" && (
        <div className="space-y-6">
          {/* Relatório de Conversão de Orçamentos */}
          <div className="panel space-y-4">
            <h2 className="text-lg font-bold">Taxa de Conversão de Orçamentos Comerciais</h2>
            {quotesReport ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Total Emitido</span>
                  <span className="text-xl font-bold font-mono">{quotesReport.totals.totalQuotes}</span>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Convertidos em Venda</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">
                    {quotesReport.totals.convertedQuotes}
                  </span>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Taxa de Conversão</span>
                  <span className="text-xl font-bold font-mono text-primary-400">
                    {quotesReport.totals.conversionRatePercent.toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Ticket Médio</span>
                  <span className="text-xl font-bold font-mono">
                    {formatCurrency(Number(quotesReport.totals.averageTicket))}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">Carregando métricas de conversão...</p>
            )}
          </div>

          {/* Resumo de Vendas */}
          {salesReport && (
            <div className="panel space-y-4">
              <h2 className="text-lg font-bold">Resumo Financeiro de Vendas</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Vendas Brutas</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {formatCurrency(Number(salesReport.totals.grossSales))}
                  </span>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Devoluções</span>
                  <span className="text-lg font-bold font-mono text-rose-400">
                    {formatCurrency(Number(salesReport.totals.returns))}
                  </span>
                </div>
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-xs text-neutral-400 block">Vendas Líquidas</span>
                  <span className="text-lg font-bold font-mono text-primary-400">
                    {formatCurrency(Number(salesReport.totals.netSales))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CRIAR / EDITAR ORÇAMENTO */}
      {isQuoteModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold">
              {editingQuote ? "Editar Orçamento Comercial" : "Novo Orçamento Comercial"}
            </h2>
            <form className="form-stack space-y-3" onSubmit={handleSaveQuote}>
              <label className="field">
                <span>Cliente *</span>
                <select
                  required
                  value={quoteCustomerId}
                  onChange={(e) => setQuoteCustomerId(e.target.value)}
                  className="input"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.legalName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Tabela de Preço *</span>
                <select
                  required
                  value={quotePricingListId}
                  onChange={(e) => setQuotePricingListId(e.target.value)}
                  className="input"
                >
                  {pricingLists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Itens e Lotes Reservados:</span>
                  <button
                    type="button"
                    className="button button--ghost text-xs py-1 px-2"
                    onClick={() =>
                      setQuoteItems((prev) => [
                        ...prev,
                        {
                          productId: products[0]?.id || "",
                          productLotId: lots[0]?.id || "",
                          quantity: 1,
                        },
                      ])
                    }
                  >
                    + Adicionar item
                  </button>
                </div>

                {quoteItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 p-2 bg-neutral-900 border border-neutral-800 rounded items-center text-xs"
                  >
                    <div className="col-span-5">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuoteItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, productId: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <select
                        value={item.productLotId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuoteItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, productLotId: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      >
                        {lots
                          .filter((l) => l.product.id === item.productId || !item.productId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.lotNumber} ({l.quantity} disp.)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setQuoteItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, quantity: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {quoteItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuoteItems((prev) => prev.filter((_, idx) => idx !== index))
                          }
                          className="text-rose-400 font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {quoteError && <p className="form-error text-xs" role="alert">{quoteError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsQuoteModalOpen(false)}
                  disabled={quoteSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={quoteSubmitting}>
                  {quoteSubmitting ? "Gravando..." : "Salvar Orçamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONVERSÃO DE ORÇAMENTO */}
      {convertingQuote && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-md w-full space-y-4">
            <h2 className="text-xl font-bold">Converter Orçamento em Venda</h2>
            <p className="text-xs text-neutral-400">
              Valor Total: <strong>{formatCurrency(Number(convertingQuote.totalAmount))}</strong>
            </p>
            <form className="form-stack space-y-3" onSubmit={handleConfirmConvertQuote}>
              <label className="field">
                <span>Condição de Pagamento *</span>
                <select
                  value={convertCondition}
                  onChange={(e) => setConvertCondition(e.target.value as "IMEDIATO" | "PRAZO")}
                  className="input"
                >
                  <option value="IMEDIATO">Imediato (À vista)</option>
                  <option value="PRAZO">A Prazo</option>
                </select>
              </label>

              {convertCondition === "IMEDIATO" ? (
                <label className="field">
                  <span>Método de Pagamento *</span>
                  <select
                    value={convertPaymentMethod}
                    onChange={(e) => setConvertPaymentMethod(e.target.value)}
                    className="input"
                  >
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span>Data de Vencimento *</span>
                  <input
                    type="date"
                    required
                    value={convertDueDate}
                    onChange={(e) => setConvertDueDate(e.target.value)}
                  />
                </label>
              )}

              {convertError && <p className="form-error text-xs" role="alert">{convertError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setConvertingQuote(null)}
                  disabled={convertSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={convertSubmitting}>
                  {convertSubmitting ? "Convertendo..." : "Confirmar Venda e Baixar Estoque"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT VENDA DIRETA */}
      {isSaleModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold">Checkout de Venda (PDV)</h2>
            <form className="form-stack space-y-3" onSubmit={handleSaveSale}>
              <label className="field">
                <span>Cliente (obrigatório para PCE ou vendas a prazo)</span>
                <select
                  value={saleCustomerId}
                  onChange={(e) => setSaleCustomerId(e.target.value)}
                  className="input"
                >
                  <option value="">Venda de balcão sem identificação</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.legalName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Tabela de Preço *</span>
                <select
                  required
                  value={salePricingListId}
                  onChange={(e) => setSalePricingListId(e.target.value)}
                  className="input"
                >
                  {pricingLists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Condição</span>
                  <select
                    value={saleCondition}
                    onChange={(e) => setSaleCondition(e.target.value as "IMEDIATO" | "PRAZO")}
                    className="input"
                  >
                    <option value="IMEDIATO">À vista</option>
                    <option value="PRAZO">A Prazo</option>
                  </select>
                </label>
                {saleCondition === "IMEDIATO" ? (
                  <label className="field">
                    <span>Método de Pagamento</span>
                    <select
                      value={salePaymentMethod}
                      onChange={(e) => setSalePaymentMethod(e.target.value)}
                      className="input"
                    >
                      <option value="PIX">PIX</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="CARTAO_DEBITO">Débito</option>
                      <option value="CARTAO_CREDITO">Crédito</option>
                    </select>
                  </label>
                ) : (
                  <label className="field">
                    <span>Vencimento</span>
                    <input
                      type="date"
                      required
                      value={saleDueDate}
                      onChange={(e) => setSaleDueDate(e.target.value)}
                    />
                  </label>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <span className="text-sm font-semibold block">Produtos e Lotes:</span>
                {saleItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 p-2 bg-neutral-900 border border-neutral-800 rounded items-center text-xs"
                  >
                    <div className="col-span-5">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSaleItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, productId: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4">
                      <select
                        value={item.productLotId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSaleItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, productLotId: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      >
                        {lots
                          .filter((l) => l.product.id === item.productId || !item.productId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.lotNumber} ({l.quantity} disp.)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setSaleItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, quantity: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {saleItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSaleItems((prev) => prev.filter((_, idx) => idx !== index))
                          }
                          className="text-rose-400 font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {saleError && <p className="form-error text-xs" role="alert">{saleError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsSaleModalOpen(false)}
                  disabled={saleSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={saleSubmitting}>
                  {saleSubmitting ? "Finalizando..." : "Concluir Venda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DEVOLUÇÃO */}
      {returningSale && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full space-y-4">
            <h2 className="text-xl font-bold">Registrar Devolução de Mercadorias</h2>
            <form className="form-stack space-y-3" onSubmit={handleConfirmReturn}>
              <label className="field">
                <span>Motivo da Devolução *</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Produto avariado, desistência do cliente"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </label>

              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <span className="text-sm font-semibold block">Itens da Venda:</span>
                {returnItems.map((item, index) => {
                  const saleItem = returningSale.items.find((it) => it.id === item.saleItemId);
                  return (
                    <div
                      key={index}
                      className="p-2 bg-neutral-900 border border-neutral-800 rounded flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold">{saleItem?.product?.name || "Item"}</span>
                        <div className="text-neutral-400">
                          Preço unitário: {formatCurrency(Number(saleItem?.unitPrice || 0))}
                        </div>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          max={Number(saleItem?.quantity || 1)}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setReturnItems((prev) =>
                              prev.map((it, idx) =>
                                idx === index ? { ...it, quantity: val } : it,
                              ),
                            );
                          }}
                          className="input text-xs w-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {returnError && <p className="form-error text-xs" role="alert">{returnError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setReturningSale(null)}
                  disabled={returnSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={returnSubmitting}>
                  {returnSubmitting ? "Registrando..." : "Confirmar Devolução"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TABELA DE PREÇO */}
      {isPricingModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">Nova Tabela de Preços</h2>
            <form className="form-stack space-y-4" onSubmit={handleSavePricingList}>
              <label className="field">
                <span>Nome da Tabela *</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tabela Varejo 2026, Atacado Revenda"
                  value={newPricingName}
                  onChange={(e) => setNewPricingName(e.target.value)}
                />
              </label>

              <div className="space-y-2 border-t border-neutral-800 pt-3">
                <span className="text-sm font-semibold block">Preços Unitários por Produto:</span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {newPricingItems.map((item, idx) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <div
                        key={item.productId}
                        className="p-2 bg-neutral-900 border border-neutral-800 rounded flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold">{product?.name || "Produto"}</span>
                        <div className="w-32 flex items-center gap-1">
                          <span className="text-neutral-500">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setNewPricingItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, unitPrice: val } : it)),
                              );
                            }}
                            className="input text-xs w-full text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {pricingError && <p className="form-error text-xs" role="alert">{pricingError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsPricingModalOpen(false)}
                  disabled={pricingSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={pricingSubmitting}>
                  {pricingSubmitting ? "Salvando..." : "Salvar Tabela"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CAMPANHA PROMOCIONAL */}
      {isPromoModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold">Nova Campanha Promocional</h2>
            <form className="form-stack space-y-4" onSubmit={handleSavePromotion}>
              <label className="field">
                <span>Nome da Campanha *</span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Black Friday Pirotécnica, Junina 2026"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Data Início *</span>
                  <input
                    type="date"
                    required
                    value={promoStartsAt}
                    onChange={(e) => setPromoStartsAt(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Data Fim *</span>
                  <input
                    type="date"
                    required
                    value={promoEndsAt}
                    onChange={(e) => setPromoEndsAt(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-2 border-t border-neutral-800 pt-3">
                <span className="text-sm font-semibold block">Descontos por Produto:</span>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {promoItems.map((item, idx) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <div
                        key={item.productId}
                        className="p-2 bg-neutral-900 border border-neutral-800 rounded flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold truncate max-w-[140px]">{product?.name || "Produto"}</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={item.discountType}
                            onChange={(e) => {
                              const t = e.target.value as PromotionDiscountType;
                              setPromoItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, discountType: t } : it)),
                              );
                            }}
                            className="input text-xs py-1"
                          >
                            <option value="PERCENTUAL">Percentual (%)</option>
                            <option value="VALOR_FIXO">Valor Fixo (R$)</option>
                          </select>
                          <input
                            type="number"
                            step={item.discountType === "PERCENTUAL" ? "1" : "0.01"}
                            min="0"
                            max={item.discountType === "PERCENTUAL" ? "100" : undefined}
                            value={item.discountType === "PERCENTUAL" ? (item.discountPercent ?? 0) : (item.promotionalPrice ?? 0)}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPromoItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? item.discountType === "PERCENTUAL"
                                      ? { ...it, discountPercent: val, promotionalPrice: undefined }
                                      : { ...it, promotionalPrice: val, discountPercent: undefined }
                                    : it,
                                ),
                              );
                            }}
                            className="input text-xs w-20 text-right"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {promoError && <p className="form-error text-xs" role="alert">{promoError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsPromoModalOpen(false)}
                  disabled={promoSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary" disabled={promoSubmitting}>
                  {promoSubmitting ? "Salvando..." : "Criar Campanha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
