// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommercialWorkspace } from "./commercial-workspace";
import type { SalesQuote } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    commercialApi: {
      getPricingLists: vi.fn(),
      createPricingList: vi.fn(),
      getPromotions: vi.fn(),
      createPromotion: vi.fn(),
      togglePromotion: vi.fn(),
      getQuotes: vi.fn(),
      getQuote: vi.fn(),
      createQuote: vi.fn(),
      updateQuote: vi.fn(),
      sendQuote: vi.fn(),
      cancelQuote: vi.fn(),
      convertQuote: vi.fn(),
      getSales: vi.fn(),
      getSale: vi.fn(),
      createSale: vi.fn(),
      createReturn: vi.fn(),
      getSalesReport: vi.fn(),
      getQuotesConversionReport: vi.fn(),
    },
    inventoryApi: {
      getProducts: vi.fn(),
    },
    operationsApi: {
      getCustomers: vi.fn(),
      getLots: vi.fn(),
    },
  };
});

const mockQuote: SalesQuote = {
  id: "quote-1",
  customerId: null,
  priceListId: "price-list-1",
  status: "EMITIDO",
  total: "250",
  expiresAt: "2026-11-02T00:00:00.000Z",
  customer: null,
  items: [
    {
      id: "item-1",
      productId: "product-1",
      productLotId: "lot-1",
      quantity: "2",
      unitPrice: "125",
      subtotal: "250",
    },
  ],
  createdAt: "2026-10-26T00:00:00.000Z",
};

const emptyPage = { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } };

type ApiModule = typeof import("@/lib/api");

function mockBaseLoaders(
  commercialApi: ApiModule["commercialApi"],
  inventoryApi: ApiModule["inventoryApi"],
  operationsApi: ApiModule["operationsApi"],
) {
  vi.mocked(operationsApi.getCustomers).mockResolvedValue(emptyPage);
  vi.mocked(operationsApi.getLots).mockResolvedValue(emptyPage);
  vi.mocked(inventoryApi.getProducts).mockResolvedValue(emptyPage);
  vi.mocked(commercialApi.getPricingLists).mockResolvedValue(emptyPage);
  vi.mocked(commercialApi.getSales).mockResolvedValue(emptyPage);
  vi.mocked(commercialApi.getPromotions).mockResolvedValue(emptyPage);
  vi.mocked(commercialApi.getSalesReport).mockResolvedValue({
    period: { from: "2026-10-01", to: "2026-10-26" },
    totals: { grossSales: "0", returned: "0", netSales: "0", salesCount: 0, returnsCount: 0 },
    byProduct: [],
    byCustomer: [],
  });
  vi.mocked(commercialApi.getQuotesConversionReport).mockResolvedValue({
    period: { from: "2026-10-01", to: "2026-10-26" },
    totals: {
      quotesCount: 0,
      convertedCount: 0,
      canceledCount: 0,
      expiredCount: 0,
      activeCount: 0,
      conversionRatePercent: 0,
      quotedAmount: "0",
      convertedAmount: "0",
      averageTicket: "0",
    },
  });
}

describe("CommercialWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders quote total and expiry from the real API shape, never crashes (regression)", async () => {
    const { commercialApi, inventoryApi, operationsApi } = await import("@/lib/api");
    mockBaseLoaders(commercialApi, inventoryApi, operationsApi);
    vi.mocked(commercialApi.getQuotes).mockResolvedValue({
      data: [mockQuote],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    render(<CommercialWorkspace />);

    expect(await screen.findByText(/R\$\s*250,00/)).toBeDefined();
    expect(screen.getByText(/02\/11\/2026/)).toBeDefined();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("submits priceListId and strips productId when creating a quote", async () => {
    const { commercialApi, inventoryApi, operationsApi } = await import("@/lib/api");
    mockBaseLoaders(commercialApi, inventoryApi, operationsApi);
    vi.mocked(commercialApi.getQuotes).mockResolvedValue(emptyPage);
    vi.mocked(operationsApi.getCustomers).mockResolvedValue({
      data: [{ id: "customer-1", legalName: "Cliente DEMO", hasCr: false, crExpiresAt: null, authorizedPceClasses: [], active: true }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(commercialApi.getPricingLists).mockResolvedValue({
      data: [{ id: "price-list-1", name: "Tabela DEMO", active: true, createdAt: "2026-10-01T00:00:00.000Z" }],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(commercialApi.createQuote).mockResolvedValue(mockQuote);

    render(<CommercialWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /novo orçamento/i }));
    fireEvent.click(screen.getByRole("button", { name: /salvar orçamento/i }));

    await screen.findByText(/emitido com sucesso/i);
    const payload = vi.mocked(commercialApi.createQuote).mock.calls[0][0];
    expect(payload).toHaveProperty("priceListId");
    expect(payload).not.toHaveProperty("pricingListId");
    expect(payload.items[0]).not.toHaveProperty("productId");
  });
});
