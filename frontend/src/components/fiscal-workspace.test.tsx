// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FiscalWorkspace } from "./fiscal-workspace";
import type { FiscalDocument } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fiscalApi: {
      getDocuments: vi.fn(),
      getDocument: vi.fn(),
      emitNFe: vi.fn(),
      emitNFCe: vi.fn(),
      emitNFSe: vi.fn(),
      cancelDocument: vi.fn(),
    },
    commercialApi: {
      getSales: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
    },
    operationsApi: {
      getOrders: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } }),
    },
  };
});

const mockDoc: FiscalDocument = {
  id: "doc-1",
  type: "NFE",
  status: "AUTORIZADO",
  number: 1045,
  series: 1,
  accessKey: "35261012345678000195550010000010451123456789",
  protocol: "135260000123456",
  totalAmount: "2500.50",
  xmlUrl: "https://sefaz.gov.br/xml/1045.xml",
  danfeUrl: "https://sefaz.gov.br/danfe/1045",
  createdAt: "2026-10-26T10:00:00.000Z",
  issuedAt: "2026-10-26T10:01:00.000Z",
  sale: {
    code: 50,
    total: "2500.50",
    customer: { legalName: "Pirotecnia Brasil LTDA", taxId: "12.345.678/0001-90" },
  },
};

describe("FiscalWorkspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renderiza lista de documentos fiscais com status, chave e valor formatado", async () => {
    const { fiscalApi } = await import("@/lib/api");
    vi.mocked(fiscalApi.getDocuments).mockResolvedValue({
      data: [mockDoc],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    render(<FiscalWorkspace />);

    expect(await screen.findByText("1045")).toBeDefined();
    expect(screen.getByText("Pirotecnia Brasil LTDA")).toBeDefined();
    expect(screen.getAllByText("AUTORIZADO").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Venda #50")).toBeDefined();
    expect(screen.getByText("DANFE")).toBeDefined();
    expect(screen.getByText("XML")).toBeDefined();
    expect(screen.getByText("Cancelar")).toBeDefined();
  });

  it("abre e fecha o modal de emissão de NF-e", async () => {
    const { fiscalApi } = await import("@/lib/api");
    vi.mocked(fiscalApi.getDocuments).mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      },
    });

    render(<FiscalWorkspace />);

    const emitNfeBtn = await screen.findByRole("button", { name: /emitir nf-e/i });
    fireEvent.click(emitNfeBtn);

    expect(screen.getByRole("heading", { name: /emitir nf-e/i })).toBeDefined();
    expect(screen.getByLabelText(/venda a faturar/i)).toBeDefined();

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /emitir nf-e/i })).toBeNull();
    });
  });

  it("abre modal de cancelamento ao clicar em Cancelar em documento autorizado", async () => {
    const { fiscalApi } = await import("@/lib/api");
    vi.mocked(fiscalApi.getDocuments).mockResolvedValue({
      data: [mockDoc],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    render(<FiscalWorkspace />);

    const cancelBtn = await screen.findByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    expect(
      screen.getByRole("heading", { name: /cancelar documento fiscal #1045/i }),
    ).toBeDefined();
    expect(screen.getByLabelText(/justificativa do cancelamento/i)).toBeDefined();
  });
});
