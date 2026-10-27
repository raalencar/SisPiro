import { requestJson, type PageResult } from "./client";
import type { Product } from "./inventory";

export type Supplier = {
  id: string;
  legalName: string;
  tradeName?: string | null;
  taxId: string;
  email?: string | null;
  phone?: string | null;
  hasCr: boolean;
  crNumber?: string | null;
  crExpiresAt?: string | null;
  authorizedPceClasses: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseReceipt = {
  id: string;
  quantity: string;
  lotNumber: string;
  manufacturedAt: string;
  expiresAt: string;
  manufacturerOrImporter: string;
  magazineId: string;
};

export type PurchaseItem = {
  id: string;
  productId: string;
  product?: Product;
  orderedQuantity: string;
  unitCost: string;
  receipts: PurchaseReceipt[];
};

export type PurchaseStatus = "PENDENTE" | "PARCIAL" | "RECEBIDO" | "CANCELADO";

export type Purchase = {
  id: string;
  supplierId: string;
  supplier?: Supplier;
  status: PurchaseStatus;
  reference?: string | null;
  createdAt: string;
  receivedAt?: string | null;
  items: PurchaseItem[];
};

function pageQuery(page: number, search?: string): URLSearchParams {
  const query = new URLSearchParams({ page: String(page), limit: "100" });
  if (search?.trim()) query.set("search", search.trim());
  return query;
}

export const procurementApi = {
  getSuppliers: (page = 1, search?: string, active?: boolean) => {
    const query = pageQuery(page, search);
    if (active !== undefined) query.set("active", String(active));
    return requestJson<PageResult<Supplier>>(
      `/api/procurement/suppliers?${query.toString()}`,
    );
  },
  createSupplier: (body: Partial<Supplier>) =>
    requestJson<Supplier>("/api/procurement/suppliers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSupplier: (id: string, body: Partial<Supplier>) =>
    requestJson<Supplier>(`/api/procurement/suppliers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  getPurchases: (page = 1, status?: PurchaseStatus, supplierId?: string) => {
    const query = new URLSearchParams({ page: String(page), limit: "100" });
    if (status) query.set("status", status);
    if (supplierId) query.set("supplierId", supplierId);
    return requestJson<PageResult<Purchase>>(
      `/api/procurement/purchases?${query.toString()}`,
    );
  },
  getPurchase: (id: string) =>
    requestJson<Purchase>(`/api/procurement/purchases/${id}`),
  createPurchase: (body: {
    supplierId: string;
    reference?: string;
    items: Array<{ productId: string; orderedQuantity: number; unitCost: number }>;
  }) =>
    requestJson<Purchase>("/api/procurement/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  receivePurchase: (
    id: string,
    body: {
      dueDate: string;
      invoiceReference: string;
      items: Array<{
        purchaseItemId: string;
        magazineId: string;
        lotNumber: string;
        quantity: number;
        manufacturedAt: string;
        expiresAt: string;
        manufacturerOrImporter: string;
      }>;
    },
  ) =>
    requestJson<Purchase>(`/api/procurement/purchases/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelPurchase: (id: string) =>
    requestJson<Purchase>(`/api/procurement/purchases/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};
