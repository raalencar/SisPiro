// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComplianceWorkspace } from "./compliance-workspace";
import type { TrafficGuide } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    complianceApi: {
      getTrafficGuides: vi.fn(),
      getTrafficGuideById: vi.fn(),
      createTrafficGuide: vi.fn(),
      updateTrafficGuideStatus: vi.fn(),
    },
    inventoryApi: {
      getMagazines: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
      getProducts: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
      getLots: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
    },
    operationsApi: {
      getBlasters: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
      getOrders: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
    },
    fiscalApi: {
      getDocuments: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
    },
  };
});

const mockGuide: TrafficGuide = {
  id: "gt-1",
  number: "GT-2026/0001",
  status: "EMITIDA",
  validFrom: "2026-10-26T08:00:00.000Z",
  validUntil: "2026-10-28T18:00:00.000Z",
  originCity: "Ribeirão Preto",
  originState: "SP",
  destinationCity: "Campinas",
  destinationState: "SP",
  routeDescription: "SP-330 Anhanguera",
  vehiclePlate: "ABC1D23",
  vehiclePlateState: "SP",
  vehicleModel: "MB Sprinter",
  driverName: "Carlos Alberto da Silva",
  driverCpf: "111.222.333-44",
  driverLicense: "123456789",
  hasMopp: true,
  totalNeqKg: "2.500",
  issuedAt: "2026-10-26T10:00:00.000Z",
  createdAt: "2026-10-26T10:00:00.000Z",
  sourceMagazine: { name: "Paiol Central SP" },
  blaster: { name: "Manoel Blaster", licenseNumber: "CR-998877" },
  items: [
    {
      id: "it-1",
      productId: "p1",
      productLotId: "l1",
      quantity: 10,
      neqGrams: 2500,
      unNumber: "UN 0336",
      riskClass: "1.4G",
      product: { name: "Torta Pirotécnica 19 Tiros", sku: "FOG-19T" },
      productLot: { lotNumber: "LT-2026-A" },
    },
  ],
};

describe("ComplianceWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderiza lista de Guias de Tráfego militares com número, itinerário e massa NEQ", async () => {
    const { complianceApi } = await import("@/lib/api");
    vi.mocked(complianceApi.getTrafficGuides).mockResolvedValue({
      data: [mockGuide],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(<ComplianceWorkspace />);

    expect(await screen.findByText("GT-2026/0001")).toBeDefined();
    expect(screen.getByText("Ribeirão Preto/SP → Campinas/SP")).toBeDefined();
    expect(screen.getByText("ABC1D23 (SP)")).toBeDefined();
    expect(screen.getByText("Carlos Alberto da Silva")).toBeDefined();
    expect(screen.getByText("Manoel Blaster")).toBeDefined();
    expect(screen.getByText(/2,5.*kg NEQ/)).toBeDefined();
    expect(screen.getAllByText("EMITIDA").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Espelho GT")).toBeDefined();
  });

  it("abre e fecha o modal de emissão de nova Guia de Tráfego", async () => {
    const { complianceApi } = await import("@/lib/api");
    vi.mocked(complianceApi.getTrafficGuides).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    render(<ComplianceWorkspace />);

    const emitBtn = await screen.findByRole("button", { name: /emitir guia de tráfego/i });
    fireEvent.click(emitBtn);

    expect(screen.getByRole("heading", { name: /emitir guia de tráfego/i })).toBeDefined();
    expect(screen.getByLabelText(/paiol de origem/i)).toBeDefined();

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /emitir guia de tráfego/i })).toBeNull();
    });
  });

  it("abre o espelho oficial de impressão da GT para fiscalização militar", async () => {
    const { complianceApi } = await import("@/lib/api");
    vi.mocked(complianceApi.getTrafficGuides).mockResolvedValue({
      data: [mockGuide],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    render(<ComplianceWorkspace />);

    const espelhoBtn = await screen.findByRole("button", { name: "Espelho GT" });
    fireEvent.click(espelhoBtn);

    expect(screen.getByRole("heading", { name: /espelho oficial - guia de tráfego #gt-2026\/0001/i })).toBeDefined();
    expect(screen.getByText(/ministério da defesa/i)).toBeDefined();
    expect(screen.getByText(/comando logístico \(colog\)/i)).toBeDefined();
    expect(screen.getByText("Imprimir Guia Oficial")).toBeDefined();
  });
});
