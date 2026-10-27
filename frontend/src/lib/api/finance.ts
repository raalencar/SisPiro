import { requestJson, type PageResult } from "./client";
import type { Customer } from "./customers";

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
  paid?: string;
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

export type GeneratedPix = {
  entryId: string;
  txid: string;
  amount: number;
  copyPasteCode: string;
  qrCodeDataUrl: string;
  expiresAt: string;
};

export type OfxTransaction = {
  fitId: string;
  type: "CREDIT" | "DEBIT" | "OTHER";
  amount: number;
  date: string;
  memo: string;
  checkNumber?: string;
};

export type ReconciliationSuggestion = {
  transaction: OfxTransaction;
  alreadyReconciled: boolean;
  matchConfidence: "EXACT" | "APPROXIMATE" | "NONE";
  suggestedEntry?: {
    id: string;
    code: number;
    direction: FinancialDirection;
    description: string;
    counterparty: string;
    dueDate: string;
    amount: number;
    remaining: number;
    status: FinancialStatus;
  };
};

export type ReconcilePreviewResult = {
  bankId?: string;
  accountId?: string;
  summary: {
    totalTransactions: number;
    totalCredits: number;
    totalDebits: number;
    creditsAmount: number;
    debitsAmount: number;
    matchedCount: number;
    unmatchedCount: number;
    alreadyReconciledCount: number;
  };
  items: ReconciliationSuggestion[];
};

export type ApplyReconciliationResult = {
  batchId: string;
  reconciledCount: number;
  results: Array<{
    paymentId: string;
    fitId: string;
    entryId: string;
    amount: number;
    newStatus: string;
  }>;
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
    const { counterpart: _discard, ...cleanBody } = body;
    const counterparty = cleanBody.counterparty || _discard || "";
    const description =
      cleanBody.description ||
      `Lançamento ${cleanBody.direction === "PAGAR" ? "a pagar" : "a receber"} - ${counterparty || cleanBody.category}`;
    return requestJson<FinancialEntry & { installments?: FinancialEntry[] }>(
      "/api/finance/entries",
      {
        method: "POST",
        body: JSON.stringify({
          ...cleanBody,
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
  generatePix: (
    entryId: string,
    body?: {
      pixKey?: string;
      merchantName?: string;
      merchantCity?: string;
      expiresInHours?: number;
    },
  ) =>
    requestJson<GeneratedPix>(`/api/finance/pix/qrcode/${entryId}`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  previewOfx: (ofxContent: string) =>
    requestJson<ReconcilePreviewResult>("/api/finance/reconcile/ofx-preview", {
      method: "POST",
      body: JSON.stringify({ ofxContent }),
    }),
  applyOfx: (
    items: Array<{
      fitId: string;
      entryId: string;
      amount: number;
      occurredAt: string;
      memo?: string;
    }>,
  ) =>
    requestJson<ApplyReconciliationResult>("/api/finance/reconcile/ofx-apply", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
};
