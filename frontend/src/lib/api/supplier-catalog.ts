import { requestJson, type PageResult } from "./client";

export type SupplierCatalogItemSummary = {
  id: string;
  supplierId: string;
  supplierName: string;
  externalId: string;
  supplierCode: string | null;
  name: string;
  effect: string | null;
  unitPackaging: string | null;
  masterPackaging: string | null;
  approxDuration: string | null;
  categories: string[];
  thumbnailUrl: string | null;
  productId: string | null;
  productSku: string | null;
};

export type SupplierCatalogItem = SupplierCatalogItemSummary & {
  description: string | null;
  notes: string | null;
  extraAttributes: {
    maquina?: string | null;
    quantidade_por_rolo?: string | number | null;
    tags?: string[] | null;
  } | null;
  sourceUrl: string | null;
  importedAt: string;
  updatedAt: string;
  images: Array<{ index: number; url: string }>;
};

export type SupplierCatalogLinkedFilter = "" | "true" | "false";

export type SupplierCatalogQuery = {
  page?: number;
  limit?: number;
  q?: string;
  supplierId?: string;
  category?: string;
  linked?: SupplierCatalogLinkedFilter;
};

const CATALOG_IMAGE_PATH =
  /^\/procurement\/supplier-catalog\/[0-9a-f-]{36}\/images\/\d+$/i;

/**
 * Converte a URL relativa devolvida pela API (`/procurement/supplier-catalog/<id>/images/<n>`,
 * sem `/api/v1`) para a rota BFF same-origin. Qualquer outro formato é descartado.
 */
export function catalogImageSrc(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl || !CATALOG_IMAGE_PATH.test(relativeUrl)) return null;
  return `/api${relativeUrl}`;
}

export function suggestedSku(supplierCode: string | null): string {
  return (supplierCode ?? "").replace(/\s+/g, "").slice(0, 50);
}

export const supplierCatalogApi = {
  list: (query: SupplierCatalogQuery = {}) => {
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      limit: String(query.limit ?? 24),
    });
    if (query.q?.trim()) params.set("q", query.q.trim());
    if (query.supplierId) params.set("supplierId", query.supplierId);
    if (query.category) params.set("category", query.category);
    if (query.linked) params.set("linked", query.linked);
    return requestJson<PageResult<SupplierCatalogItemSummary>>(
      `/api/procurement/supplier-catalog?${params.toString()}`,
    );
  },
  categories: (supplierId?: string) => {
    const params = new URLSearchParams();
    if (supplierId) params.set("supplierId", supplierId);
    const query = params.toString();
    return requestJson<{ data: string[] }>(
      `/api/procurement/supplier-catalog/categories${query ? `?${query}` : ""}`,
    );
  },
  get: (id: string) =>
    requestJson<SupplierCatalogItem>(
      `/api/procurement/supplier-catalog/${encodeURIComponent(id)}`,
    ),
};
