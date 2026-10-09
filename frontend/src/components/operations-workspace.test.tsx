// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OperationsWorkspace } from "./operations-workspace";
import {
  operationsApi,
  type OperationalBlaster,
  type OperationalLot,
  type ServiceOrder,
} from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    operationsApi: {
      getOrders: vi.fn(),
      getOrder: vi.fn(),
      getReport: vi.fn(),
      getCustomers: vi.fn(),
      getBlasters: vi.fn(),
      getLots: vi.fn(),
      updateOrder: vi.fn(),
      createOrder: vi.fn(),
      approveOrder: vi.fn(),
      startOrder: vi.fn(),
      cancelOrder: vi.fn(),
      closeOrder: vi.fn(),
    },
  };
});

const mockCustomer = {
  id: "cust-1",
  legalName: "Prefeitura Municipal",
  active: true,
  hasCr: true,
  crExpiresAt: "2027-12-31",
  authorizedPceClasses: ["1.1", "1.3"],
};

const mockBlaster: OperationalBlaster = {
  id: "blaster-1",
  name: "João Silva",
  active: true,
  licenseExpiresAt: "2027-06-30",
};

const mockProduct = {
  id: "prod-1",
  sku: "BOMBA-01",
  name: "Bomba 3 polegadas",
  type: "MERCADORIA" as const,
  unit: "UN",
  isPce: true,
  riskClass: "1.3",
  neqGrams: "200.000",
};

const mockProductLot = {
  id: "lot-1",
  productId: "prod-1",
  magazineId: "mag-1",
  lotNumber: "LOTE-2026-A",
  quantity: "100",
  manufacturedAt: "2026-01-01",
  expiresAt: "2027-12-31",
  manufacturerOrImporter: "Fabrica",
  status: "DISPONIVEL" as const,
  statusReason: null,
  neqKg: "20.000",
  product: mockProduct,
  magazine: {
    id: "mag-1",
    code: "P-01",
    name: "Paiol Principal",
    active: true,
    maxNeqCapacityKg: "1000",
    currentNeqKg: "20",
    remainingNeqKg: "980",
    fireLicenseExpiresAt: "2027-12-31",
  },
};

const mockOrderOrcamento: ServiceOrder = {
  id: "order-123",
  code: 101,
  customerId: "cust-1",
  customer: mockCustomer,
  responsibleBlasterId: "blaster-1",
  responsibleBlaster: mockBlaster,
  artNumber: null,
  dueDate: null,
  reservationActive: false,
  reservedNeqKg: "10.000",
  eventAt: "2026-11-15T20:00:00.000Z",
  eventLocation: "Praia Central",
  contractedAmount: "15000.00",
  status: "ORCAMENTO",
  reportNotes: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  items: [
    {
      id: "item-1",
      productId: "prod-1",
      productLotId: "lot-1",
      plannedQuantity: "50",
      firedQuantity: null,
      neqKg: "10.000",
      product: mockProduct,
      productLot: mockProductLot,
    },
  ],
};

const mockReport = {
  period: { from: "2026-10-01", to: "2026-10-31", basis: "event" },
  totals: {
    orderCount: 1,
    ordersWithoutContractedAmount: 0,
    contractedAmount: "15000.00",
  },
  byStatus: [
    {
      status: "ORCAMENTO" as const,
      orderCount: 1,
      ordersWithoutContractedAmount: 0,
      contractedAmount: "15000.00",
    },
  ],
};

const mockLot: OperationalLot = {
  id: "lot-1",
  productId: "prod-1",
  magazineId: "mag-1",
  lotNumber: "LOTE-2026-A",
  quantity: "100",
  status: "DISPONIVEL",
  statusReason: null,
  expiresAt: "2027-12-31",
  neqKg: "20.000",
  product: {
    id: "prod-1",
    sku: "BOMBA-01",
    name: "Bomba 3 polegadas",
    type: "MERCADORIA",
    isPce: true,
    riskClass: "1.3",
    neqGrams: "200.000",
    unit: "UN",
  },
  magazine: {
    id: "mag-1",
    name: "Paiol Principal",
    active: true,
    fireLicenseExpiresAt: "2027-12-31",
  },
};

describe("<OperationsWorkspace />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(operationsApi.getOrders).mockResolvedValue({
      data: [mockOrderOrcamento],
      meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    });
    vi.mocked(operationsApi.getOrder).mockResolvedValue(mockOrderOrcamento);
    vi.mocked(operationsApi.getReport).mockResolvedValue(mockReport);
    vi.mocked(operationsApi.getCustomers).mockResolvedValue({
      data: [mockCustomer],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(operationsApi.getBlasters).mockResolvedValue({
      data: [mockBlaster],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(operationsApi.getLots).mockResolvedValue({
      data: [mockLot],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders order list and metrics", async () => {
    render(<OperationsWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeDefined();
      expect(screen.getByText("Prefeitura Municipal")).toBeDefined();
    });
  });

  it("opens edit budget modal when order is in ORCAMENTO status and saves changes", async () => {
    vi.mocked(operationsApi.updateOrder).mockResolvedValueOnce({
      ...mockOrderOrcamento,
      eventLocation: "Praia Nova",
      contractedAmount: "18000.00",
    });

    render(<OperationsWorkspace />);

    // Click "Detalhes" on order #101
    await waitFor(() => {
      expect(screen.getByText("#101")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    // Verify detail pane opened with "Editar orçamento" button
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Editar orçamento" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Editar orçamento" }));

    // Modal title appears
    await waitFor(() => {
      expect(screen.getByText("Editar orçamento #101")).toBeDefined();
    });

    // Change location and contracted amount
    const locationInput = screen.getByDisplayValue("Praia Central");
    fireEvent.change(locationInput, { target: { value: "Praia Nova" } });

    const amountInput = screen.getByDisplayValue("15000.00");
    fireEvent.change(amountInput, { target: { value: "18000.00" } });

    // Submit edit form
    const saveButton = screen.getByRole("button", { name: "Salvar alterações" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(operationsApi.updateOrder).toHaveBeenCalledTimes(1);
      expect(operationsApi.updateOrder).toHaveBeenCalledWith(
        "order-123",
        expect.objectContaining({
          eventLocation: "Praia Nova",
          contractedAmount: 18000,
        }),
      );
    });
  });

  it("surfaces validation error returned by API on edit submission", async () => {
    vi.mocked(operationsApi.updateOrder).mockRejectedValueOnce(
      new Error("Apenas ordens em situação de orçamento podem ser editadas."),
    );

    render(<OperationsWorkspace />);

    await waitFor(() => {
      expect(screen.getByText("#101")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Editar orçamento" })).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Editar orçamento" }));

    await waitFor(() => {
      expect(screen.getByText("Editar orçamento #101")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(
        screen.getByText("Apenas ordens em situação de orçamento podem ser editadas."),
      ).toBeDefined();
    });
  });
});
