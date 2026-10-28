"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  procurementApi,
  supplierCatalogApi,
  type PageResult,
  type SupplierCatalogItem,
  type SupplierCatalogItemSummary,
  type SupplierCatalogLinkedFilter,
} from "@/lib/api";

export const CATALOG_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 350;

export type SupplierOption = { id: string; name: string };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * @param canListSuppliers GET /suppliers exige COMPRAS; para os demais perfis a
 * lista de fornecedores do filtro é montada a partir dos itens já carregados.
 */
export function useSupplierCatalogState(canListSuppliers: boolean) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [category, setCategory] = useState("");
  const [linked, setLinked] = useState<SupplierCatalogLinkedFilter>("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PageResult<SupplierCatalogItemSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [registeredSuppliers, setRegisteredSuppliers] = useState<SupplierOption[] | null>(null);
  const [seenSuppliers, setSeenSuppliers] = useState<Record<string, string>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupplierCatalogItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReload, setDetailReload] = useState(0);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      setQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, query]);

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await supplierCatalogApi.list({
          page,
          limit: CATALOG_PAGE_SIZE,
          q: query,
          supplierId,
          category,
          linked,
        });
        if (!current) return;
        setResult(response);
        setSeenSuppliers((previous) => {
          const next = { ...previous };
          for (const item of response.data) next[item.supplierId] = item.supplierName;
          return next;
        });
      } catch (requestError) {
        if (current) setError(errorMessage(requestError, "Não foi possível carregar o catálogo."));
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [page, query, supplierId, category, linked]);

  useEffect(() => {
    let current = true;
    async function load() {
      setCategoriesError(null);
      try {
        const response = await supplierCatalogApi.categories(supplierId || undefined);
        if (current) setCategories(response.data);
      } catch (requestError) {
        if (current) {
          setCategories([]);
          setCategoriesError(errorMessage(requestError, "Não foi possível carregar as categorias."));
        }
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [supplierId]);

  useEffect(() => {
    if (!canListSuppliers) return;
    let current = true;
    procurementApi
      .getSuppliers(1)
      .then((response) => {
        if (current) {
          setRegisteredSuppliers(
            response.data.map((supplier) => ({ id: supplier.id, name: supplier.legalName })),
          );
        }
      })
      .catch(() => {
        // Sem a lista oficial, o filtro usa os fornecedores vistos no catálogo.
        if (current) setRegisteredSuppliers(null);
      });
    return () => {
      current = false;
    };
  }, [canListSuppliers]);

  useEffect(() => {
    if (!selectedId) return;
    const itemId = selectedId;
    let current = true;
    async function load() {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const response = await supplierCatalogApi.get(itemId);
        if (current) setDetail(response);
      } catch (requestError) {
        if (current) setDetailError(errorMessage(requestError, "Não foi possível carregar o item."));
      } finally {
        if (current) setDetailLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [selectedId, detailReload]);

  const supplierOptions = useMemo<SupplierOption[]>(() => {
    if (registeredSuppliers) return registeredSuppliers;
    return Object.entries(seenSuppliers)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [registeredSuppliers, seenSuppliers]);

  const openItem = useCallback((id: string) => {
    setDetail(null);
    setSelectedId(id);
  }, []);

  const closeItem = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  /** Atualiza o selo do item na grade e no detalhe sem recarregar a página. */
  const markLinked = useCallback(
    (itemId: string, productId: string, productSku: string | null) => {
      setResult((previous) =>
        previous
          ? {
              ...previous,
              data: previous.data.map((item) =>
                item.id === itemId ? { ...item, productId, productSku } : item,
              ),
            }
          : previous,
      );
      setDetail((previous) =>
        previous && previous.id === itemId ? { ...previous, productId, productSku } : previous,
      );
    },
    [],
  );

  /** Recarrega o item (ex.: 409 — outro usuário já vinculou) e propaga o SKU real à grade. */
  const refreshItem = useCallback(
    async (itemId: string) => {
      try {
        const fresh = await supplierCatalogApi.get(itemId);
        if (fresh.productId) markLinked(itemId, fresh.productId, fresh.productSku);
        return fresh;
      } catch {
        setDetailReload((value) => value + 1);
        return null;
      }
    },
    [markLinked],
  );

  function changeFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return {
    searchInput,
    setSearchInput,
    supplierId,
    setSupplierId: (value: string) => {
      setSupplierId(value);
      setCategory("");
      setPage(1);
    },
    category,
    setCategory: changeFilter(setCategory),
    linked,
    setLinked: changeFilter(setLinked),
    page,
    setPage,
    result,
    loading,
    error,
    categories,
    categoriesError,
    supplierOptions,
    selectedId,
    detail,
    detailLoading,
    detailError,
    openItem,
    closeItem,
    markLinked,
    refreshItem,
  };
}
