"use client";

import { useState, type FormEvent } from "react";
import {
  commercialApi,
  financeApi,
  fiscalApi,
  type FiscalDocument,
  type GeneratedPix,
  type Product,
  type PromotionDiscountType,
  type Sale,
} from "@/lib/api";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function useCommercialModals(
  products: Product[],
  currentDate: string,
  reload: (message?: string) => void,
) {
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
  const [promoStartsAt, setPromoStartsAt] = useState(() => currentDate);
  const [promoEndsAt, setPromoEndsAt] = useState(() => currentDate);
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
      reload("Devolução de mercadorias registrada com sucesso!");
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
      reload("Tabela de preços cadastrada com sucesso!");
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
      reload("Campanha promocional cadastrada com sucesso!");
    } catch (err) {
      setPromoError(errorMessage(err));
    } finally {
      setPromoSubmitting(false);
    }
  }

  async function handleTogglePromotion(promoId: string, currentActive: boolean) {
    await commercialApi.togglePromotion(promoId, !currentActive);
    reload(`Promoção ${!currentActive ? "ativada" : "desativada"} com sucesso!`);
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
      reload(`${doc.type} #${doc.number} emitida e autorizada com sucesso pela SEFAZ!`);
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
    } finally {
      setPixLoading(false);
    }
  }

  return {
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
    isPixModalOpen,
    setIsPixModalOpen,
    pixData,
    pixLoading,
    handleOpenPixModal,
  };
}
