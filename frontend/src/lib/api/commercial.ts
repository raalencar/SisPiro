import { requestJson, type PageResult } from "./client";
import type { Product, ProductLot } from "./inventory";
import type { Customer } from "./customers";

export type PricingList = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  items?: Array<{ id: string; productId: string; unitPrice: string; product?: Product }>;
};

export type PromotionDiscountType = "PRECO_FIXO" | "PERCENTUAL";

export type ProductPromotion = {
  id: string;
  name: string;
  effectiveFrom: string;
  effectiveUntil: string;
  active: boolean;
  createdAt: string;
  items?: Array<{
    id: string;
    productId: string;
    discountType: PromotionDiscountType;
    promotionalPrice?: string | null;
    discountPercent?: string | null;
    product?: Product;
  }>;
};

export type SalesQuoteItem = {
  id: string;
  productId: string;
  productLotId: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  product?: Product;
  productLot?: ProductLot;
};

export type SalesQuoteStatus = "EMITIDO" | "CONVERTIDO" | "CANCELADO";

export type SalesQuote = {
  id: string;
  customerId: string | null;
  priceListId: string;
  status: SalesQuoteStatus;
  total: string;
  expiresAt: string;
  customer?: Customer | null;
  priceList?: PricingList;
  items: SalesQuoteItem[];
  createdAt: string;
};

export type SaleItem = {
  id: string;
  productId: string;
  productLotId: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  product?: Product;
  productLot?: ProductLot;
};

export type Sale = {
  id: string;
  customerId?: string | null;
  priceListId: string;
  quoteId?: string | null;
  total: string;
  customer?: Customer | null;
  financialEntry?: { id: string; status: string } | null;
  items: SaleItem[];
  createdAt: string;
};

export type QuotesConversionReport = {
  period: { from: string; to: string };
  totals: {
    quotesCount: number;
    convertedCount: number;
    canceledCount: number;
    expiredCount: number;
    activeCount: number;
    conversionRatePercent: number;
    quotedAmount: string;
    convertedAmount: string;
    averageTicket: string;
  };
};

export type SalesReportSummary = {
  period: { from: string; to: string };
  totals: {
    grossSales: string;
    returned: string;
    netSales: string;
    salesCount: number;
    returnsCount: number;
  };
  byProduct: Array<{
    productId: string;
    productName: string;
    grossSales: string;
    returned: string;
    netSales: string;
  }>;
  byCustomer: Array<{
    customerId: string | null;
    customerName: string;
    grossSales: string;
    returned: string;
    netSales: string;
  }>;
};

function pageQuery(page: number, search?: string): URLSearchParams {
  const query = new URLSearchParams({ page: String(page), limit: "100" });
  if (search?.trim()) query.set("search", search.trim());
  return query;
}

export const commercialApi = {
  getPricingLists: (page = 1, search?: string) =>
    requestJson<PageResult<PricingList>>(
      `/api/commercial/pricing/lists?${pageQuery(page, search).toString()}`,
    ),
  createPricingList: (body: {
    name: string;
    items: Array<{ productId: string; unitPrice: number }>;
  }) =>
    requestJson<PricingList>("/api/commercial/pricing/lists", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getPromotions: (page = 1) =>
    requestJson<PageResult<ProductPromotion>>(
      `/api/commercial/pricing/promotions?page=${page}&limit=100`,
    ),
  createPromotion: (body: {
    name: string;
    effectiveFrom: string;
    effectiveUntil: string;
    items: Array<{
      productId: string;
      discountType: PromotionDiscountType;
      promotionalPrice?: number;
      discountPercent?: number;
    }>;
  }) =>
    requestJson<ProductPromotion>("/api/commercial/pricing/promotions", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  togglePromotion: (id: string, active: boolean) =>
    requestJson<ProductPromotion>(`/api/commercial/pricing/promotions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  getQuotes: (page = 1, status?: SalesQuoteStatus) => {
    const query = new URLSearchParams({ page: String(page), limit: "100" });
    if (status) query.set("status", status);
    return requestJson<PageResult<SalesQuote>>(
      `/api/commercial/quotes?${query.toString()}`,
    );
  },
  getQuote: (id: string) =>
    requestJson<SalesQuote>(`/api/commercial/quotes/${id}`),
  createQuote: (body: {
    customerId?: string;
    priceListId: string;
    items: Array<{ productLotId: string; quantity: number }>;
  }) =>
    requestJson<SalesQuote>("/api/commercial/quotes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateQuote: (
    id: string,
    body: {
      customerId?: string;
      priceListId?: string;
      items: Array<{ productLotId: string; quantity: number }>;
    },
  ) =>
    requestJson<SalesQuote>(`/api/commercial/quotes/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  sendQuote: (id: string) =>
    requestJson<{ queued: boolean; jobId?: string }>(
      `/api/commercial/quotes/${id}/send`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  cancelQuote: (id: string) =>
    requestJson<SalesQuote>(`/api/commercial/quotes/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  convertQuote: (
    id: string,
    body: {
      condition: "IMEDIATO" | "PRAZO";
      paymentMethod?: string;
      dueDate?: string;
    },
  ) =>
    requestJson<Sale>(`/api/commercial/quotes/${id}/convert`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getSales: (page = 1) =>
    requestJson<PageResult<Sale>>(`/api/commercial/sales?page=${page}&limit=100`),
  getSale: (id: string) => requestJson<Sale>(`/api/commercial/sales/${id}`),
  createSale: (body: {
    customerId?: string;
    priceListId: string;
    condition: "IMEDIATO" | "PRAZO";
    paymentMethod?: string;
    dueDate?: string;
    items: Array<{ productLotId: string; quantity: number }>;
  }) =>
    requestJson<Sale>("/api/commercial/sales", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createReturn: (
    saleId: string,
    body: {
      reason: string;
      dueDate?: string;
      items: Array<{ saleItemId: string; quantity: number }>;
    },
  ) =>
    requestJson<unknown>(`/api/commercial/sales/${saleId}/returns`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getSalesReport: (from: string, to: string) =>
    requestJson<SalesReportSummary>(
      `/api/commercial/sales/reports/summary?from=${from}&to=${to}`,
    ),
  getQuotesConversionReport: (from: string, to: string) =>
    requestJson<QuotesConversionReport>(
      `/api/commercial/reports/quotes-conversion?from=${from}&to=${to}`,
    ),
};
