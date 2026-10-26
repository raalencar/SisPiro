// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchasesWorkspace } from "./purchases-workspace";
import type { Purchase } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    procurementApi: {
      getPurchases: vi.fn(),
      getSuppliers: vi.fn(),
      createSupplier: vi.fn(),
      updateSupplier: vi.fn(),
      createPurchase: vi.fn(),
      receivePurchase: vi.fn(),
      cancelPurchase: vi.fn(),
    },
    inventoryApi: {
      getProducts: vi.fn(),
      getMagazines: vi.fn(),
    },
  };
});

const mockPurchase: Purchase = {
  id: "purchase-1",
  supplierId: "supplier-1",
  supplier: {
    id: "supplier-1",
    legalName: "Fornecedor DEMO",
    taxId: "23456789000195",
    hasCr: true,
    authorizedPceClasses: [],
    active: true,
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
  },
  status: "PENDENTE",
  reference: null,
  createdAt: "2026-10-08T00:00:00.000Z",
  receivedAt: null,
  items: [
    {
      id: "item-1",
      productId: "product-1",
      product: {
        id: "product-1",
        sku: "DEMO-MERC-001",
        name: "Produto demonstrativo",
        type: "MERCADORIA",
        isPce: false,
        riskClass: null,
        neqGrams: "0",
        unit: "UN",
      },
      orderedQuantity: "40",
      unitCost: "12.5",
      receipts: [],
    },
  ],
};

describe("PurchasesWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("computes total and received/ordered quantities from the real API shape, never NaN (regression)", async () => {
    const { procurementApi, inventoryApi } = await import("@/lib/api");
    vi.mocked(procurementApi.getPurchases).mockResolvedValue({
      data: [mockPurchase],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(procurementApi.getSuppliers).mockResolvedValue({
      data: [mockPurchase.supplier!],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(inventoryApi.getProducts).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    vi.mocked(inventoryApi.getMagazines).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });

    render(<PurchasesWorkspace />);

    expect(await screen.findByText(/R\$\s*500,00/)).toBeDefined();
    expect(screen.getByText(/0\/40 UN/)).toBeDefined();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("submits orderedQuantity and reference, not quantity/notes, when creating a purchase order", async () => {
    const { procurementApi, inventoryApi } = await import("@/lib/api");
    vi.mocked(procurementApi.getPurchases).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    vi.mocked(procurementApi.getSuppliers).mockResolvedValue({
      data: [mockPurchase.supplier!],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(inventoryApi.getProducts).mockResolvedValue({
      data: [mockPurchase.items[0].product!],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(inventoryApi.getMagazines).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    vi.mocked(procurementApi.createPurchase).mockResolvedValue(mockPurchase);

    render(<PurchasesWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /novo pedido de compra/i }));
    fireEvent.click(screen.getByRole("button", { name: /emitir pedido/i }));

    await screen.findByText(/novo pedido de compra/i, {}, { timeout: 3000 }).catch(() => undefined);
    expect(procurementApi.createPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            orderedQuantity: expect.any(Number),
          }),
        ],
      }),
    );
    const payload = vi.mocked(procurementApi.createPurchase).mock.calls[0][0];
    expect(payload.items[0]).not.toHaveProperty("quantity");
    expect(payload).not.toHaveProperty("notes");
  });
});
