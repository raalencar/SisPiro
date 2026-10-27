import { requestJson, type PageResult } from "./client";
import type { Product, ProductLot, ProductLotStatus } from "./inventory";

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
  | "ORCAMENTO"
  | "APROVADO"
  | "EM_MONTAGEM"
  | "CONCLUIDO"
  | "CANCELADO";

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
