"use client";

import { useState, type FormEvent } from "react";
import {
  commercialApi,
  operationsApi,
  type OperationalCustomer,
  type OperationalLot,
  type PricingList,
  type Product,
  type SalesQuote,
} from "@/lib/api";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function useCommercialQuotes(
  customers: OperationalCustomer[],
  lots: OperationalLot[],
  products: Product[],
  pricingLists: PricingList[],
  onSuccess: (message: string) => void,
  onError: (message: string) => void,
  reload: () => void,
) {
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
        onSuccess("Orçamento atualizado e reserva recalculada com sucesso.");
      } else {
        await commercialApi.createQuote(payload);
        onSuccess("Orçamento emitido com sucesso com reserva ativa por 7 dias.");
      }

      setIsQuoteModalOpen(false);
      reload();
    } catch (err) {
      setQuoteError(errorMessage(err));
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function handleSendQuote(quoteId: string) {
    try {
      await commercialApi.sendQuote(quoteId);
      onSuccess("Envio do orçamento agendado com sucesso via BullMQ.");
    } catch (err) {
      onError(errorMessage(err));
    }
  }

  async function handleCancelQuote(quoteId: string) {
    if (!window.confirm("Deseja realmente cancelar este orçamento e liberar a reserva de estoque?")) return;
    try {
      await commercialApi.cancelQuote(quoteId);
      onSuccess("Orçamento cancelado e reserva liberada.");
      reload();
    } catch (err) {
      onError(errorMessage(err));
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
        onSuccess("Orçamento convertido em Ordem de Serviço de Show com sucesso!");
      } else {
        await commercialApi.convertQuote(convertingQuote.id, {
          condition: convertCondition,
          paymentMethod: convertCondition === "IMEDIATO" ? convertPaymentMethod : undefined,
          dueDate: convertCondition === "PRAZO" ? convertDueDate : undefined,
        });
        onSuccess("Orçamento convertido em Venda Direta com sucesso!");
      }

      setConvertingQuote(null);
      reload();
    } catch (err) {
      setConvertError(errorMessage(err));
    } finally {
      setConvertSubmitting(false);
    }
  }

  return {
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
  };
}
