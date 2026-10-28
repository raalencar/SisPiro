import { requestJson, type PageResult } from "./client";

export type ProductType = "MERCADORIA" | "SERVICO" | "INSUMO";
export type StockMovementType =
  | "ENTRADA"
  | "SAIDA"
  | "TRANSFERENCIA"
  | "AJUSTE";

export type Product = {
  id: string;
  sku: string;
  name: string;
  type: ProductType;
  isPce: boolean;
  riskClass: string | null;
  neqGrams: string;
  unit: string;
  description?: string | null;
  /** Relativa, sem `/api/v1` (ver `catalogImageSrc`). Presente em GET /inventory/products. */
  imageUrl?: string | null;
};

export type CreateProductBody = {
  sku: string;
  name: string;
  type: ProductType;
  isPce: boolean;
  riskClass?: string;
  neqGrams?: number;
  unit: string;
  description?: string;
  supplierCatalogItemId?: string;
};

export type Magazine = {
  id: string;
  name: string;
  active: boolean;
  maxNeqCapacityKg: string;
  currentNeqKg: string;
  remainingNeqKg: string;
  fireLicenseExpiresAt: string;
};

export type ProductLotStatus = "DISPONIVEL" | "QUARENTENA" | "BLOQUEADO";

export type ProductLot = {
  id: string;
  productId: string;
  magazineId: string;
  lotNumber: string;
  quantity: string;
  manufacturedAt: string;
  expiresAt: string;
  manufacturerOrImporter: string;
  status: ProductLotStatus;
  statusReason: string | null;
  neqKg: string;
  product: Product;
  magazine: Magazine;
};

export type StockMovement = {
  id: string;
  type: StockMovementType;
  quantity: string;
  occurredAt: string;
  reference: string | null;
  productLot: {
    id: string;
    lotNumber: string;
    product: Product;
  };
  sourceMagazine: Magazine | null;
  destinationMagazine: Magazine | null;
};

export type StockReport = {
  asOf: string;
  expiryWindowDays: number;
  totals: {
    lotCount: number;
    physicalQuantity: string;
    reservedQuantity: string;
    availableQuantity: string;
    quarantinedQuantity: string;
    blockedQuantity: string;
    expiredQuantity: string;
    expiringQuantity: string;
  };
  byProduct: Array<{
    productId: string;
    sku: string;
    productName: string;
    unit: string;
    lotCount: number;
    neqKg: string;
    physicalQuantity: string;
    reservedQuantity: string;
    availableQuantity: string;
    quarantinedQuantity: string;
    blockedQuantity: string;
    expiredQuantity: string;
    expiringQuantity: string;
  }>;
  expiringLots: Array<{
    lotId: string;
    productId: string;
    sku: string;
    productName: string;
    unit: string;
    lotNumber: string;
    magazineId: string;
    magazineName: string;
    expiresAt: string;
    status: string;
    statusReason: string | null;
    physicalQuantity: string;
    reservedQuantity: string;
    availableQuantity: string;
  }>;
  expiredLots: Array<{
    lotId: string;
    productId: string;
    sku: string;
    productName: string;
    unit: string;
    lotNumber: string;
    magazineId: string;
    magazineName: string;
    expiresAt: string;
    status: string;
    statusReason: string | null;
    physicalQuantity: string;
    reservedQuantity: string;
    availableQuantity: string;
  }>;
};

export type SfpcMonthlyReport = {
  year: number;
  month: number;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  totals: {
    productCount: number;
    initialBalanceNeqKg: string;
    inflowNeqKg: string;
    outflowNeqKg: string;
    finalBalanceNeqKg: string;
  };
  byRiskClass: Array<{
    riskClass: string;
    productCount: number;
    initialQuantity: string;
    inflowQuantity: string;
    outflowQuantity: string;
    finalQuantity: string;
    initialNeqKg: string;
    inflowNeqKg: string;
    outflowNeqKg: string;
    finalNeqKg: string;
  }>;
  items: Array<{
    productId: string;
    sku: string;
    productName: string;
    riskClass: string;
    unit: string;
    neqGrams: string;
    initialQuantity: string;
    inflowBreakdown: {
      purchases: string;
      returns: string;
      adjustments: string;
      total: string;
    };
    outflowBreakdown: {
      sales: string;
      serviceOrders: string;
      adjustments: string;
      total: string;
    };
    finalQuantity: string;
    initialNeqKg: string;
    inflowNeqKg: string;
    outflowNeqKg: string;
    finalNeqKg: string;
  }>;
};

function paginatedPath(path: string, page: number, search?: string): string {
  const query = new URLSearchParams({ page: String(page), limit: "100" });
  if (search?.trim()) query.set("search", search.trim());
  return `/api/inventory/${path}?${query.toString()}`;
}

export const inventoryApi = {
  getStockReport: () =>
    requestJson<StockReport>("/api/inventory/reports/stock-summary"),
  getSfpcMonthlyMap: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    const query = params.toString();
    return requestJson<SfpcMonthlyReport>(
      `/api/inventory/reports/sfpc-monthly-map${query ? `?${query}` : ""}`,
    );
  },
  getProducts: (page = 1, search?: string) =>
    requestJson<PageResult<Product>>(paginatedPath("products", page, search)),
  getMagazines: (page = 1, search?: string) =>
    requestJson<PageResult<Magazine>>(paginatedPath("magazines", page, search)),
  getLots: (page = 1, search?: string) =>
    requestJson<PageResult<ProductLot>>(paginatedPath("lots", page, search)),
  getMovements: (page = 1, search?: string) =>
    requestJson<PageResult<StockMovement>>(
      paginatedPath("movements", page, search),
    ),
  createProduct: (body: CreateProductBody) =>
    requestJson<Product>("/api/inventory/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createMagazine: (body: {
    name: string;
    maxNeqCapacityKg: number;
    fireLicenseExpiresAt: string;
  }) =>
    requestJson<Magazine>("/api/inventory/magazines", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMagazineStatus: (id: string, body: { active: boolean }) =>
    requestJson<Magazine>(`/api/inventory/magazines/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  createLot: (body: {
    productId: string;
    magazineId: string;
    lotNumber: string;
    quantity: number;
    manufacturedAt: string;
    expiresAt: string;
    manufacturerOrImporter: string;
  }) =>
    requestJson<ProductLot>("/api/inventory/lots", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLotStatus: (
    id: string,
    body: { status: ProductLotStatus; reason?: string },
  ) =>
    requestJson<ProductLot>(`/api/inventory/lots/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  splitLot: (
    id: string,
    body: {
      destinationMagazineId: string;
      newLotNumber: string;
      quantity: number;
    },
  ) =>
    requestJson<{
      parentLot: ProductLot;
      childLot: ProductLot;
      originMovement: StockMovement;
      childMovement: StockMovement;
    }>(`/api/inventory/lots/${id}/split`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  createMovement: (body: {
    type: StockMovementType;
    productLotId: string;
    quantity: number;
    destinationMagazineId?: string;
    reference?: string;
  }) =>
    requestJson<StockMovement>("/api/inventory/movements", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
