const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_API_PREFIX = "/api/v1";
const REQUEST_TIMEOUT_MS = 5_000;
const BUSINESS_REQUEST_TIMEOUT_MS = 15_000;
const SESSION_VALIDITY_MS = 60_000;

let sessionValidatedAt = 0;
let sessionCheck: Promise<void> | null = null;

export type HealthResponse = {
  status: "ok";
};

export type ApiErrorKind = "http" | "network" | "timeout" | "invalid-response";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBaseUrl(): string {
  const origin = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(
    /\/+$/,
    "",
  );
  const prefix = (
    process.env.NEXT_PUBLIC_API_PREFIX || DEFAULT_API_PREFIX
  ).replace(/^\/+|\/+$/g, "");

  return `${origin}/${prefix}`;
}

export function getApiEndpoint(path: string): string {
  return `${apiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

function apiMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === "string")
    ) {
      return message.join(" ");
    }
  }
  return `A API respondeu com erro HTTP ${status}.`;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...init.headers,
        },
        signal: controller.signal,
        cache: init.cache ?? "no-store",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          "A API demorou para responder. Tente novamente.",
          "timeout",
        );
      }
      throw new ApiError(
        "Não foi possível conectar à API. Verifique se o backend está em execução.",
        "network",
      );
    }

    let payload: unknown = null;
    try {
      const text = response.status === 204 ? "" : await response.text();
      if (text) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          if (response.ok) throw new Error("invalid-json");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          "A API demorou para responder. Tente novamente.",
          "timeout",
        );
      }
      throw new ApiError(
        "A API retornou uma resposta inválida. Tente novamente mais tarde.",
        "invalid-response",
        response.status,
      );
    }

    if (!response.ok) {
      throw new ApiError(
        apiMessage(payload, response.status),
        "http",
        response.status,
      );
    }

    if (payload === null) {
      throw new ApiError(
        "A API retornou uma resposta vazia.",
        "invalid-response",
        response.status,
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(path: string): Promise<unknown> {
  return fetchJson(
    getApiEndpoint(path),
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
    REQUEST_TIMEOUT_MS,
  );
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const isBusinessRequest =
    path.startsWith("/api/inventory/") ||
    path.startsWith("/api/operations/") ||
    path.startsWith("/api/customers/") ||
    path.startsWith("/api/blasters/") ||
    path.startsWith("/api/procurement/") ||
    path.startsWith("/api/commercial/") ||
    path.startsWith("/api/finance/");
  if (isBusinessRequest) await ensureSessionAndNotify();

  let payload: unknown;
  try {
    payload = await fetchJson(
      path,
      {
        ...init,
        credentials: "same-origin",
      },
      BUSINESS_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (
      !isBusinessRequest ||
      !(error instanceof ApiError) ||
      error.status !== 401
    ) {
      throw error;
    }
    sessionValidatedAt = 0;
    await ensureSessionAndNotify();
    try {
      payload = await fetchJson(
        path,
        {
          ...init,
          credentials: "same-origin",
        },
        BUSINESS_REQUEST_TIMEOUT_MS,
      );
    } catch (retryError) {
      notifySessionExpired(retryError);
      throw retryError;
    }
  }
  return payload as T;
}

export function markSessionFresh(): void {
  sessionValidatedAt = Date.now();
}

export function clearSessionFreshness(): void {
  sessionValidatedAt = 0;
}

function isSessionPayload(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "roles" in value &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => typeof role === "string")
  );
}

async function ensureSession(): Promise<void> {
  if (Date.now() - sessionValidatedAt < SESSION_VALIDITY_MS) return;
  if (!sessionCheck) {
    sessionCheck = fetchJson(
      "/api/auth/session",
      { method: "GET", credentials: "same-origin" },
      BUSINESS_REQUEST_TIMEOUT_MS,
    )
      .then((payload) => {
        if (!isSessionPayload(payload)) {
          throw new ApiError(
            "A API retornou uma sessão em formato inesperado.",
            "invalid-response",
          );
        }
        markSessionFresh();
      })
      .finally(() => {
        sessionCheck = null;
      });
  }
  await sessionCheck;
}

async function ensureSessionAndNotify(): Promise<void> {
  try {
    await ensureSession();
  } catch (error) {
    notifySessionExpired(error);
    throw error;
  }
}

function notifySessionExpired(error: unknown): void {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event("erp:session-expired"));
  }
}

function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "ok"
  );
}

async function getHealth(
  path: "health/live" | "health/ready",
): Promise<HealthResponse> {
  const response = await getJson(path);
  if (!isHealthResponse(response)) {
    throw new ApiError(
      "A API retornou dados de saúde em formato inesperado.",
      "invalid-response",
    );
  }

  return response;
}

export function getLiveness(): Promise<HealthResponse> {
  return getHealth("health/live");
}

export function getReadiness(): Promise<HealthResponse> {
  return getHealth("health/ready");
}

export type PageResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ProductType = "MERCADORIA" | "SERVICO" | "INSUMO";
export type StockMovementType =
  "ENTRADA" | "SAIDA" | "TRANSFERENCIA" | "AJUSTE";

export type Product = {
  id: string;
  sku: string;
  name: string;
  type: ProductType;
  isPce: boolean;
  riskClass: string | null;
  neqGrams: string;
  unit: string;
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

export type OperationalCustomer = {
  id: string;
  legalName: string;
  hasCr: boolean;
  crExpiresAt: string | null;
  authorizedPceClasses: string[];
  active: boolean;
};

export type OperationalBlaster = {
  id: string;
  name: string;
  licenseExpiresAt: string;
  active: boolean;
};

export type OperationalLot = {
  id: string;
  productId: string;
  magazineId: string;
  lotNumber: string;
  quantity: string;
  status: ProductLotStatus;
  statusReason: string | null;
  expiresAt: string;
  neqKg: string;
  product: Pick<
    Product,
    "id" | "sku" | "name" | "type" | "isPce" | "riskClass" | "neqGrams" | "unit"
  >;
  magazine: {
    id: string;
    name: string;
    active: boolean;
    fireLicenseExpiresAt: string;
  };
};

export type ServiceOrderStatus =
  "ORCAMENTO" | "APROVADO" | "EM_MONTAGEM" | "CONCLUIDO" | "CANCELADO";

export type ServiceOrderItem = {
  id: string;
  productId: string;
  productLotId: string;
  plannedQuantity: string;
  firedQuantity: string | null;
  neqKg: string;
  product: Product;
  productLot: ProductLot;
};

export type ServiceOrder = {
  id: string;
  code: number;
  status: ServiceOrderStatus;
  customerId: string;
  customer: OperationalCustomer;
  contractedAmount: string;
  eventAt: string;
  eventLocation: string;
  responsibleBlasterId: string | null;
  responsibleBlaster: OperationalBlaster | null;
  artNumber: string | null;
  dueDate: string | null;
  reportNotes: string | null;
  reservationActive: boolean;
  reservedNeqKg: string;
  items: ServiceOrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type ServiceOrderReport = {
  period: { from: string; to: string; basis: string };
  totals: {
    orderCount: number;
    ordersWithoutContractedAmount: number;
    contractedAmount: string;
  };
  byStatus: Array<{
    status: ServiceOrderStatus;
    orderCount: number;
    ordersWithoutContractedAmount: number;
    contractedAmount: string;
  }>;
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
  createProduct: (body: {
    sku: string;
    name: string;
    type: ProductType;
    isPce: boolean;
    riskClass?: string;
    neqGrams?: number;
    unit: string;
  }) =>
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

function operationsPath(path: string, query?: URLSearchParams): string {
  const suffix = query?.toString();
  return `/api/operations/${path}${suffix ? `?${suffix}` : ""}`;
}

function pageQuery(page: number, search?: string): URLSearchParams {
  const query = new URLSearchParams({ page: String(page), limit: "100" });
  if (search?.trim()) query.set("search", search.trim());
  return query;
}

export const operationsApi = {
  getOrders: (page = 1, search?: string, status?: ServiceOrderStatus) => {
    const query = pageQuery(page, search);
    if (status) query.set("status", status);
    return requestJson<PageResult<ServiceOrder>>(
      operationsPath("orders", query),
    );
  },
  getReport: (from: string, to: string) => {
    const query = new URLSearchParams({ from, to });
    return requestJson<ServiceOrderReport>(
      operationsPath("orders/reports/summary", query),
    );
  },
  getOrder: (id: string) =>
    requestJson<ServiceOrder>(operationsPath(`orders/${id}`)),
  getCustomers: (page = 1, search?: string) =>
    requestJson<PageResult<OperationalCustomer>>(
      operationsPath("references/customers", pageQuery(page, search)),
    ),
  getBlasters: (page = 1, search?: string) =>
    requestJson<PageResult<OperationalBlaster>>(
      operationsPath("references/blasters", pageQuery(page, search)),
    ),
  getLots: (page = 1, search?: string) =>
    requestJson<PageResult<OperationalLot>>(
      operationsPath("references/lots", pageQuery(page, search)),
    ),
  createOrder: (body: {
    customerId: string;
    contractedAmount: number;
    eventAt: string;
    eventLocation: string;
    items: Array<{
      productId: string;
      productLotId: string;
      plannedQuantity: number;
    }>;
  }) =>
    requestJson<ServiceOrder>(operationsPath("orders"), {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateOrder: (
    id: string,
    body: {
      customerId?: string;
      contractedAmount: number;
      eventAt: string;
      eventLocation: string;
      items: Array<{
        productId: string;
        productLotId: string;
        plannedQuantity: number;
      }>;
    },
  ) =>
    requestJson<ServiceOrder>(operationsPath(`orders/${id}`), {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  approveOrder: (
    id: string,
    body: { responsibleBlasterId: string; artNumber?: string },
  ) =>
    requestJson<ServiceOrder>(operationsPath(`orders/${id}/approve`), {
      method: "POST",
      body: JSON.stringify(body),
    }),
  startOrder: (id: string) =>
    requestJson<ServiceOrder>(operationsPath(`orders/${id}/start`), {
      method: "POST",
      body: JSON.stringify({}),
    }),
  cancelOrder: (id: string, reason?: string) =>
    requestJson<ServiceOrder>(operationsPath(`orders/${id}/cancel`), {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  closeOrder: (
    id: string,
    body: {
      dueDate: string;
      reportNotes?: string;
      items: Array<{ itemId: string; firedQuantity: number }>;
    },
  ) =>
    requestJson<ServiceOrder>(operationsPath(`orders/${id}/close`), {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ==========================================
// Clientes & Blasters
// ==========================================

export type Customer = {
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

export type CustomerEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type Blaster = {
  id: string;
  name: string;
  taxId: string;
  licenseNumber: string;
  licenseExpiresAt: string;
  authorizedClasses: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BlasterEligibility = {
  eligible: boolean;
  reasons: string[];
};

export const customersApi = {
  getCustomers: (page = 1, search?: string, active?: boolean) => {
    const query = pageQuery(page, search);
    if (active !== undefined) query.set("active", String(active));
    return requestJson<PageResult<Customer>>(`/api/customers?${query.toString()}`);
  },
  getCustomer: (id: string) => requestJson<Customer>(`/api/customers/${id}`),
  createCustomer: (body: Partial<Customer>) =>
    requestJson<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCustomer: (id: string, body: Partial<Customer>) =>
    requestJson<Customer>(`/api/customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  checkPceEligibility: (id: string, requestedClasses: string[]) =>
    requestJson<CustomerEligibility>(`/api/customers/${id}/pce-eligibility`, {
      method: "POST",
      body: JSON.stringify({ requestedClasses }),
    }),
};

export const blastersApi = {
  getBlasters: (page = 1, search?: string, active?: boolean) => {
    const query = pageQuery(page, search);
    if (active !== undefined) query.set("active", String(active));
    return requestJson<PageResult<Blaster>>(`/api/blasters?${query.toString()}`);
  },
  getBlaster: (id: string) => requestJson<Blaster>(`/api/blasters/${id}`),
  createBlaster: (body: Partial<Blaster>) =>
    requestJson<Blaster>("/api/blasters", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBlaster: (id: string, body: Partial<Blaster>) =>
    requestJson<Blaster>(`/api/blasters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  checkEligibility: (id: string, eventDate: string) =>
    requestJson<BlasterEligibility>(`/api/blasters/${id}/eligibility`, {
      method: "POST",
      body: JSON.stringify({ eventDate }),
    }),
};

// ==========================================
// Compras & Fornecedores
// ==========================================

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

export type PurchaseItem = {
  id: string;
  productId: string;
  product?: Product;
  quantity: string;
  unitCost: string;
  totalCost: string;
  receivedQuantity: string;
};

export type PurchaseStatus = "PENDENTE" | "PARCIAL" | "RECEBIDO" | "CANCELADO";

export type Purchase = {
  id: string;
  supplierId: string;
  supplier?: Supplier;
  status: PurchaseStatus;
  totalAmount: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseItem[];
};

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
    notes?: string;
    items: Array<{ productId: string; quantity: number; unitCost: number }>;
  }) =>
    requestJson<Purchase>("/api/procurement/purchases", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  receivePurchase: (
    id: string,
    body: {
      dueDate: string;
      invoiceReference?: string;
      batches: Array<{
        productId: string;
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

// ==========================================
// Comercial, Vendas, Orçamentos & Promoções
// ==========================================

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
  startsAt: string;
  endsAt: string;
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
  customerId: string;
  pricingListId: string;
  status: SalesQuoteStatus;
  totalAmount: string;
  validUntil: string;
  reservationActive: boolean;
  customer?: Customer;
  pricingList?: PricingList;
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
  returnedQuantity: string;
  product?: Product;
  productLot?: ProductLot;
};

export type Sale = {
  id: string;
  customerId?: string | null;
  pricingListId: string;
  quoteId?: string | null;
  totalAmount: string;
  customer?: Customer | null;
  items: SaleItem[];
  createdAt: string;
};

export type QuotesConversionReport = {
  period: { from: string; to: string };
  totals: {
    totalQuotes: number;
    convertedQuotes: number;
    expiredQuotes: number;
    activeQuotes: number;
    conversionRatePercent: number;
    totalAmountQuoted: string;
    totalAmountConverted: string;
    averageTicket: string;
  };
};

export type SalesReportSummary = {
  period: { from: string; to: string };
  totals: {
    grossSales: string;
    returns: string;
    netSales: string;
    salesCount: number;
    returnsCount: number;
  };
  byProduct: Array<{
    productId: string;
    productName: string;
    grossAmount: string;
    returnedAmount: string;
    netAmount: string;
  }>;
  byCustomer: Array<{
    customerId: string | null;
    customerName: string;
    grossAmount: string;
    returnedAmount: string;
    netAmount: string;
  }>;
};

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
    startsAt: string;
    endsAt: string;
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
    customerId: string;
    pricingListId: string;
    items: Array<{ productId: string; productLotId: string; quantity: number }>;
  }) =>
    requestJson<SalesQuote>("/api/commercial/quotes", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateQuote: (
    id: string,
    body: {
      customerId?: string;
      pricingListId?: string;
      items: Array<{ productId: string; productLotId: string; quantity: number }>;
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
    pricingListId: string;
    condition: "IMEDIATO" | "PRAZO";
    paymentMethod?: string;
    dueDate?: string;
    items: Array<{ productId: string; productLotId: string; quantity: number }>;
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

// ==========================================
// Financeiro & Relatórios
// ==========================================

export type FinancialDirection = "PAGAR" | "RECEBER";
export type FinancialStatus =
  | "ABERTO"
  | "PARCIAL"
  | "PAGO"
  | "COMPENSADO"
  | "CANCELADO";

export type FinancialPayment = {
  id: string;
  amount: string;
  method: string;
  paidAt: string;
  notes?: string | null;
};

export type FinancialEntry = {
  id: string;
  direction: FinancialDirection;
  status: FinancialStatus;
  category: string;
  counterpart?: string;
  counterparty?: string;
  amount: string;
  paidAmount?: string;
  paid?: string;
  remainingAmount?: string;
  outstanding?: string;
  dueDate: string;
  overdue: boolean;
  customerId?: string | null;
  customer?: Customer | null;
  saleId?: string | null;
  serviceOrderId?: string | null;
  purchaseId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  installmentGroup?: string | null;
  payments: FinancialPayment[];
  createdAt: string;
};

export type CashFlowSummary = {
  period: { from: string; to: string };
  totals: { totalInflow: string; totalOutflow: string; netCashFlow: string };
  daily: Array<{
    date: string;
    inflow: string;
    outflow: string;
    net: string;
  }>;
};

export type AgingBucket = {
  current: string;
  overdue1to30: string;
  overdue31to60: string;
  overdue61to90: string;
  overdueOver90: string;
  total: string;
};

export type AgingReport = {
  asOf: string;
  receivables: AgingBucket;
  payables: AgingBucket;
  netExposure: string;
};

export const financeApi = {
  getEntries: (
    page = 1,
    direction?: FinancialDirection,
    status?: FinancialStatus,
    from?: string,
    to?: string,
    installmentGroup?: string,
  ) => {
    const query = new URLSearchParams({ page: String(page), limit: "100" });
    if (direction) query.set("direction", direction);
    if (status) query.set("status", status);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (installmentGroup) query.set("installmentGroup", installmentGroup);
    return requestJson<PageResult<FinancialEntry>>(
      `/api/finance/entries?${query.toString()}`,
    );
  },
  getEntry: (id: string) =>
    requestJson<FinancialEntry>(`/api/finance/entries/${id}`),
  createEntry: (body: {
    direction: FinancialDirection;
    category: string;
    counterparty?: string;
    counterpart?: string;
    description?: string;
    amount: number;
    dueDate: string;
    customerId?: string;
    installmentsCount?: number;
    intervalDays?: number;
  }) => {
    const counterparty = body.counterparty || body.counterpart || "";
    const description =
      body.description ||
      `Lançamento ${body.direction === "PAGAR" ? "a pagar" : "a receber"} - ${counterparty || body.category}`;
    return requestJson<FinancialEntry & { installments?: FinancialEntry[] }>(
      "/api/finance/entries",
      {
        method: "POST",
        body: JSON.stringify({
          ...body,
          counterparty,
          description,
        }),
      },
    );
  },
  createPayment: (
    id: string,
    body: {
      amount: number;
      method: string;
      paidAt?: string;
      notes?: string;
    },
  ) =>
    requestJson<FinancialEntry>(`/api/finance/entries/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelEntry: (id: string) =>
    requestJson<FinancialEntry>(`/api/finance/entries/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  getCashFlow: (from: string, to: string) =>
    requestJson<CashFlowSummary>(`/api/finance/cash-flow?from=${from}&to=${to}`),
  getAgingReport: (asOf: string) =>
    requestJson<AgingReport>(`/api/finance/reports/aging?asOf=${asOf}`),
};
