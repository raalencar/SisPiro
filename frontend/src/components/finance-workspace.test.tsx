// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceWorkspace } from "./finance-workspace";
import type { FinancialEntry } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    financeApi: {
      getEntries: vi.fn(),
      getCashFlow: vi.fn(),
      getAgingReport: vi.fn(),
      createPayment: vi.fn(),
      cancelEntry: vi.fn(),
      createEntry: vi.fn(),
    },
    customersApi: {
      getCustomers: vi.fn(),
    },
  };
});

const mockEntry: FinancialEntry = {
  id: "entry-1",
  direction: "PAGAR",
  status: "PARCIAL",
  category: "DESPESAS_DEMONSTRATIVAS",
  counterparty: "Fornecedor DEMO",
  amount: "350",
  paid: "120",
  outstanding: "230",
  dueDate: "2026-10-03",
  overdue: true,
  payments: [],
  createdAt: "2026-10-08T00:00:00.000Z",
};

describe("FinanceWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the real paid/outstanding amounts from the API, never NaN", async () => {
    const { financeApi, customersApi } = await import("@/lib/api");
    vi.mocked(financeApi.getEntries).mockResolvedValue({
      data: [mockEntry],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(financeApi.getCashFlow).mockResolvedValue({
      period: { from: "2026-10-01", to: "2026-10-09" },
      totals: { totalInflow: "0", totalOutflow: "0", netCashFlow: "0" },
      daily: [],
    });
    vi.mocked(financeApi.getAgingReport).mockResolvedValue({
      asOf: "2026-10-09",
      receivables: {
        current: "0",
        overdue1to30: "0",
        overdue31to60: "0",
        overdue61to90: "0",
        overdueOver90: "0",
        total: "0",
      },
      payables: {
        current: "0",
        overdue1to30: "0",
        overdue31to60: "0",
        overdue61to90: "0",
        overdueOver90: "0",
        total: "0",
      },
      netExposure: "0",
    });
    vi.mocked(customersApi.getCustomers).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    render(<FinanceWorkspace />);

    await screen.findByText("Fornecedor DEMO", {}, { timeout: 3000 });

    // Regressão: "Amortizado" e "Saldo Devedor" liam entry.paidAmount/
    // entry.remainingAmount, campos que a API nunca retorna (o campo real é
    // paid/outstanding), renderizando "R$ NaN" para todo lançamento.
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText(/120,00/)).toBeDefined();
    expect(screen.getByText(/230,00/)).toBeDefined();
  });
});
