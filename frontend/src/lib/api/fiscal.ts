import { requestJson, type PageResult } from "./client";

export type FiscalDocumentType = "NFE" | "NFCE" | "NFSE";
export type FiscalDocumentStatus =
  | "PROCESSANDO"
  | "AUTORIZADO"
  | "REJEITADO"
  | "CANCELADO";

export type FiscalDocument = {
  id: string;
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  number: number;
  series: number;
  accessKey?: string | null;
  protocol?: string | null;
  totalAmount: number | string;
  xmlUrl?: string | null;
  danfeUrl?: string | null;
  errorMessage?: string | null;
  issuedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  saleId?: string | null;
  serviceOrderId?: string | null;
  createdAt: string;
  sale?: {
    code: number;
    total: number | string;
    customer?: { legalName: string; taxId: string } | null;
  } | null;
  serviceOrder?: {
    code: number;
    contractedAmount?: number | string | null;
    eventLocation: string;
    customer?: { legalName: string; taxId: string } | null;
  } | null;
};

export const fiscalApi = {
  getDocuments: (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.type) q.set("type", params.type);
    if (params?.status) q.set("status", params.status);
    if (params?.search?.trim()) q.set("search", params.search.trim());
    return requestJson<PageResult<FiscalDocument>>(
      `/api/fiscal/documents?${q.toString()}`,
    );
  },
  getDocument: (id: string) =>
    requestJson<FiscalDocument>(`/api/fiscal/documents/${id}`),
  emitNFe: (body: {
    saleId: string;
    natureOfOperation?: string;
    notes?: string;
    series?: number;
  }) =>
    requestJson<FiscalDocument>("/api/fiscal/nfe", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  emitNFCe: (body: { saleId: string; series?: number }) =>
    requestJson<FiscalDocument>("/api/fiscal/nfce", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  emitNFSe: (body: {
    serviceOrderId: string;
    serviceDescription?: string;
    series?: number;
  }) =>
    requestJson<FiscalDocument>("/api/fiscal/nfse", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelDocument: (id: string, body: { reason: string }) =>
    requestJson<FiscalDocument>(`/api/fiscal/documents/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
