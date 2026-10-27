import { requestJson, type PageResult } from "./client";

export type TrafficGuideStatus =
  | "EMITIDA"
  | "EM_TRANSITO"
  | "CONCLUIDA"
  | "CANCELADA";

export type TrafficGuideItem = {
  id: string;
  productId: string;
  productLotId: string;
  quantity: number | string;
  neqGrams: number | string;
  unNumber: string;
  riskClass: string;
  product?: { name: string; sku: string };
  productLot?: { lotNumber: string };
};

export type TrafficGuide = {
  id: string;
  number: string;
  fiscalDocumentId?: string | null;
  serviceOrderId?: string | null;
  sourceMagazineId?: string | null;
  status: TrafficGuideStatus;
  validFrom: string;
  validUntil: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  routeDescription: string;
  vehiclePlate: string;
  vehiclePlateState: string;
  vehicleModel?: string | null;
  driverName: string;
  driverCpf: string;
  driverLicense: string;
  hasMopp: boolean;
  blasterId?: string | null;
  totalNeqKg: number | string;
  notes?: string | null;
  issuedAt: string;
  createdAt: string;
  sourceMagazine?: { name: string } | null;
  blaster?: { name: string; licenseNumber: string; taxId?: string } | null;
  fiscalDocument?: {
    number: number;
    type: string;
    accessKey?: string | null;
    sale?: { customer?: { legalName: string; taxId: string } | null };
  } | null;
  serviceOrder?: {
    code: number;
    eventLocation: string;
    customer?: { legalName: string; taxId: string } | null;
  } | null;
  items?: TrafficGuideItem[];
};

export const complianceApi = {
  getTrafficGuides: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    if (params?.search?.trim()) q.set("search", params.search.trim());
    return requestJson<PageResult<TrafficGuide>>(
      `/api/compliance/traffic-guides?${q.toString()}`,
    );
  },
  getTrafficGuideById: (id: string) =>
    requestJson<TrafficGuide>(`/api/compliance/traffic-guides/${id}`),
  createTrafficGuide: (body: {
    sourceMagazineId: string;
    fiscalDocumentId?: string;
    serviceOrderId?: string;
    validFrom: string;
    validUntil: string;
    originCity: string;
    originState: string;
    destinationCity: string;
    destinationState: string;
    routeDescription: string;
    vehiclePlate: string;
    vehiclePlateState: string;
    vehicleModel?: string;
    driverName: string;
    driverCpf: string;
    driverLicense: string;
    hasMopp?: boolean;
    blasterId?: string;
    notes?: string;
    items: Array<{
      productId: string;
      productLotId: string;
      quantity: number;
      unNumber?: string;
      riskClass?: string;
    }>;
  }) =>
    requestJson<TrafficGuide>("/api/compliance/traffic-guides", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTrafficGuideStatus: (
    id: string,
    body: { status: TrafficGuideStatus; reason?: string },
  ) =>
    requestJson<TrafficGuide>(`/api/compliance/traffic-guides/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
