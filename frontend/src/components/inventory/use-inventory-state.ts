"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  inventoryApi,
  type Magazine,
  type ProductLot,
  type ProductLotStatus,
  type SfpcMonthlyReport,
} from "@/lib/api";
import type { InventoryFormType } from "@/components/inventory-create-form";
import {
  errorMessage,
  createFormByTab,
  type InventoryData,
  type Tab,
} from "./types";

export function useInventoryState(initialTab: Tab = "overview") {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<InventoryFormType | null>(null);

  // Estados do Mapa SFPC
  const [sfpcReport, setSfpcReport] = useState<SfpcMonthlyReport | null>(null);
  const [sfpcYear, setSfpcYear] = useState(new Date().getFullYear());
  const [sfpcMonth, setSfpcMonth] = useState(new Date().getMonth() + 1);
  const [sfpcLoading, setSfpcLoading] = useState(false);
  const [showSfpcOfficialModal, setShowSfpcOfficialModal] = useState(false);

  // Estados para Mudança de Status do Lote
  const [lotForStatus, setLotForStatus] = useState<ProductLot | null>(null);
  const [newStatus, setNewStatus] = useState<ProductLotStatus>("QUARENTENA");
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Estados para Desmembramento de Lote (Split)
  const [lotForSplit, setLotForSplit] = useState<ProductLot | null>(null);
  const [splitMagazineId, setSplitMagazineId] = useState("");
  const [splitNewLotNumber, setSplitNewLotNumber] = useState("");
  const [splitQuantity, setSplitQuantity] = useState("");
  const [splitSubmitting, setSplitSubmitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const pageFor = (tab: Tab) => (activeTab === tab ? page : 1);
    const searchFor = (tab: Tab) =>
      activeTab === tab && appliedSearch ? appliedSearch : undefined;

    void Promise.allSettled([
      inventoryApi.getStockReport(),
      inventoryApi.getProducts(pageFor("products"), searchFor("products")),
      inventoryApi.getLots(pageFor("lots"), searchFor("lots")),
      inventoryApi.getMagazines(pageFor("magazines"), searchFor("magazines")),
      inventoryApi.getMovements(pageFor("movements"), searchFor("movements")),
    ])
      .then(
        ([
          reportResult,
          productsResult,
          lotsResult,
          magazinesResult,
          movementsResult,
        ]) => {
          if (!current) return;
          const listResults = [
            productsResult,
            lotsResult,
            magazinesResult,
            movementsResult,
          ];
          const listFailures = listResults.filter(
            (result) => result.status === "rejected",
          );
          if (listFailures.length > 0) {
            const messages = listFailures.map((result) =>
              result.status === "rejected" ? errorMessage(result.reason) : "",
            );
            setError(messages.join(" "));
            setData(null);
            return;
          }
          if (
            productsResult.status !== "fulfilled" ||
            lotsResult.status !== "fulfilled" ||
            magazinesResult.status !== "fulfilled" ||
            movementsResult.status !== "fulfilled"
          ) {
            setError("A API retornou listas de estoque em formato inesperado.");
            setData(null);
            return;
          }
          const report =
            reportResult.status === "fulfilled" ? reportResult.value : null;
          setData({
            report,
            products: productsResult.value,
            lots: lotsResult.value,
            magazines: magazinesResult.value,
            movements: movementsResult.value,
          });
          if (reportResult.status === "rejected") {
            setError(
              `Resumo de estoque indisponível: ${errorMessage(
                reportResult.reason,
              )} As listas seguem disponíveis.`,
            );
          }
        },
      )
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [activeTab, page, appliedSearch, revision]);

  // Carregar dados SFPC quando a aba é selecionada ou ao mudar mês/ano
  useEffect(() => {
    if (activeTab === "sfpc") {
      let isCurrent = true;
      inventoryApi
        .getSfpcMonthlyMap(sfpcYear, sfpcMonth)
        .then((report) => {
          if (isCurrent) setSfpcReport(report);
        })
        .catch((err) => {
          if (isCurrent) setError(`Falha ao carregar Mapa SFPC: ${errorMessage(err)}`);
        })
        .finally(() => {
          if (isCurrent) setSfpcLoading(false);
        });

      return () => {
        isCurrent = false;
      };
    }
  }, [activeTab, sfpcYear, sfpcMonth, revision]);

  function changeTab(tab: Tab) {
    if (tab === activeTab) return;
    setLoading(true);
    if (tab === "sfpc") {
      setSfpcLoading(true);
    }
    setError(null);
    setActiveTab(tab);
    setPage(1);
    setSearchInput("");
    setAppliedSearch("");
    setNotice(null);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchInput.trim();
    if (query === appliedSearch && page === 1) {
      setLoading(true);
      setError(null);
      setRevision((current) => current + 1);
      return;
    }
    setLoading(true);
    setError(null);
    setPage(1);
    setAppliedSearch(query);
  }

  function created(message: string) {
    setForm(null);
    setNotice(message);
    setRevision((current) => current + 1);
  }

  async function handleToggleMagazineStatus(magazine: Magazine) {
    try {
      const nextActive = !magazine.active;
      const updated = await inventoryApi.updateMagazineStatus(magazine.id, {
        active: nextActive,
      });
      setNotice(
        `Paiol "${updated.name}" ${
          updated.active ? "reativado" : "inativado"
        } com sucesso.`,
      );
      setRevision((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleUpdateLotStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForStatus) return;
    setStatusSubmitting(true);
    setStatusError(null);
    try {
      await inventoryApi.updateLotStatus(lotForStatus.id, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
      });
      setNotice(
        `Situação do lote "${lotForStatus.lotNumber}" atualizada para ${newStatus}.`,
      );
      setLotForStatus(null);
      setStatusReason("");
      setRevision((current) => current + 1);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function handleSplitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lotForSplit) return;
    setSplitSubmitting(true);
    setSplitError(null);
    try {
      const result = await inventoryApi.splitLot(lotForSplit.id, {
        destinationMagazineId: splitMagazineId,
        newLotNumber: splitNewLotNumber.trim(),
        quantity: Number(splitQuantity),
      });
      setNotice(
        `Lote "${lotForSplit.lotNumber}" desmembrado com sucesso gerando o lote "${result.childLot.lotNumber}".`,
      );
      setLotForSplit(null);
      setSplitNewLotNumber("");
      setSplitQuantity("");
      setSplitMagazineId("");
      setRevision((current) => current + 1);
    } catch (err) {
      setSplitError(errorMessage(err));
    } finally {
      setSplitSubmitting(false);
    }
  }

  const summary = data?.report;
  const expiredLotIds = new Set(summary?.expiredLots.map((lot) => lot.lotId) ?? []);
  const expiringLotIds = new Set(
    summary?.expiringLots.map((lot) => lot.lotId) ?? [],
  );
  const addForm = createFormByTab[activeTab];

  const totalNeqKg =
    summary?.byProduct.reduce(
      (sum, product) => sum + Number(product.neqKg),
      0,
    ) ?? 0;

  return {
    activeTab,
    page,
    setPage,
    searchInput,
    setSearchInput,
    appliedSearch,
    data,
    loading,
    setLoading,
    error,
    setError,
    notice,
    setNotice,
    form,
    setForm,
    sfpcReport,
    sfpcYear,
    setSfpcYear,
    sfpcMonth,
    setSfpcMonth,
    sfpcLoading,
    showSfpcOfficialModal,
    setShowSfpcOfficialModal,
    lotForStatus,
    setLotForStatus,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    statusSubmitting,
    statusError,
    lotForSplit,
    setLotForSplit,
    splitMagazineId,
    setSplitMagazineId,
    splitNewLotNumber,
    setSplitNewLotNumber,
    splitQuantity,
    setSplitQuantity,
    splitSubmitting,
    splitError,
    changeTab,
    applySearch,
    created,
    handleToggleMagazineStatus,
    handleUpdateLotStatus,
    handleSplitLot,
    summary,
    expiredLotIds,
    expiringLotIds,
    addForm,
    totalNeqKg,
    setRevision,
  };
}
