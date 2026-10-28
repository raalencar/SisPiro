// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierCatalogWorkspace } from "./supplier-catalog-workspace";
import {
  ApiError,
  catalogImageSrc,
  inventoryApi,
  procurementApi,
  suggestedSku,
  supplierCatalogApi,
  type SupplierCatalogItem,
} from "@/lib/api";

const authState = vi.hoisted(() => ({ roles: ["ESTOQUE"] as string[] }));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Usuário", roles: authState.roles } }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    supplierCatalogApi: { list: vi.fn(), categories: vi.fn(), get: vi.fn() },
    procurementApi: { ...actual.procurementApi, getSuppliers: vi.fn() },
    inventoryApi: { ...actual.inventoryApi, createProduct: vi.fn() },
  };
});

const ITEM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

const item: SupplierCatalogItem = {
  id: ITEM_ID,
  supplierId: "supplier-1",
  supplierName: "Amazon Fireworks",
  externalId: "8025",
  supplierCode: "AMZ 8025",
  name: "Torta 100 tiros <b>multicor</b>",
  effect: "Crisântemo",
  unitPackaging: "1 un",
  masterPackaging: "4 un",
  approxDuration: "40s",
  categories: ["Tortas"],
  thumbnailUrl: `/procurement/supplier-catalog/${ITEM_ID}/images/0`,
  productId: null,
  productSku: null,
  description: "<script>alert(1)</script>Linha 1",
  notes: null,
  extraAttributes: { tags: ["festa"] },
  sourceUrl: "https://fornecedor.example/produto/8025",
  importedAt: "2026-10-27T12:00:00.000Z",
  updatedAt: "2026-10-27T12:00:00.000Z",
  images: [{ index: 0, url: `/procurement/supplier-catalog/${ITEM_ID}/images/0` }],
};

const linkedItem = {
  ...item,
  id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  name: "Máquina de fumaça",
  supplierCode: "AMZ 9000",
  categories: ["Máquinas"],
  productId: "product-9",
  productSku: "AMZ9000",
  thumbnailUrl: null,
};

function page(data: SupplierCatalogItem[]) {
  return { data, meta: { page: 1, limit: 24, total: data.length, totalPages: 1 } };
}

beforeEach(() => {
  authState.roles = ["ESTOQUE"];
  vi.mocked(supplierCatalogApi.list).mockResolvedValue(page([item, linkedItem]));
  vi.mocked(supplierCatalogApi.categories).mockResolvedValue({ data: ["Máquinas", "Tortas"] });
  vi.mocked(supplierCatalogApi.get).mockResolvedValue(item);
  vi.mocked(procurementApi.getSuppliers).mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("catalog helpers", () => {
  it("maps only well-formed catalog image URLs to the same-origin BFF", () => {
    expect(catalogImageSrc(`/procurement/supplier-catalog/${ITEM_ID}/images/2`)).toBe(
      `/api/procurement/supplier-catalog/${ITEM_ID}/images/2`,
    );
    expect(catalogImageSrc("https://evil.example/x.png")).toBeNull();
    expect(catalogImageSrc(`/procurement/supplier-catalog/${ITEM_ID}/../../x`)).toBeNull();
    expect(catalogImageSrc(null)).toBeNull();
  });

  it("suggests the SKU from the supplier code without spaces", () => {
    expect(suggestedSku("AMZ 8025")).toBe("AMZ8025");
    expect(suggestedSku(null)).toBe("");
  });
});

describe("SupplierCatalogWorkspace", () => {
  it("renders the grid with lazy thumbnails, placeholder and linked badge", async () => {
    render(<SupplierCatalogWorkspace />);

    expect(await screen.findByText("Torta 100 tiros <b>multicor</b>")).toBeTruthy();
    expect(screen.getByText("Cadastrado (SKU AMZ9000)")).toBeTruthy();
    const image = screen.getByRole("img", { name: "Torta 100 tiros <b>multicor</b>" });
    expect(image.getAttribute("src")).toBe(`/api/procurement/supplier-catalog/${ITEM_ID}/images/0`);
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(screen.getByText("Sem imagem")).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Tortas" })).toBeTruthy();
    // ESTOQUE sem COMPRAS: fornecedores do filtro vêm dos itens carregados.
    expect(procurementApi.getSuppliers).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "Amazon Fireworks" })).toBeTruthy();
  });

  it("sends the status filter to the API", async () => {
    render(<SupplierCatalogWorkspace />);
    await screen.findByText("Torta 100 tiros <b>multicor</b>");

    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "false" } });

    await waitFor(() =>
      expect(supplierCatalogApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ linked: "false", page: 1 }),
      ),
    );
  });

  it("shows the detail as plain text and the source URL as a non-clickable warning", async () => {
    render(<SupplierCatalogWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhes de Torta/ }));

    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Site de origem comprometido — não acessar.");
    expect(within(dialog).getByText("https://fornecedor.example/produto/8025").tagName).toBe("P");
    expect(dialog.querySelector('a[href*="fornecedor.example"]')).toBeNull();
    expect(dialog.querySelector("script")).toBeNull();
    expect(within(dialog).getByText("<script>alert(1)</script>Linha 1")).toBeTruthy();
  });

  it("creates the product with the suggested SKU and supplierCatalogItemId", async () => {
    vi.mocked(inventoryApi.createProduct).mockResolvedValue({
      id: "product-1",
      sku: "AMZ8025",
      name: item.name,
      type: "MERCADORIA",
      isPce: true,
      riskClass: "1.4G",
      neqGrams: "100",
      unit: "UN",
    } as never);
    render(<SupplierCatalogWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhes de Torta/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar como produto" }));

    const sku = (await screen.findByLabelText(/^SKU/)) as HTMLInputElement;
    expect(sku.value).toBe("AMZ8025");
    expect((screen.getByLabelText("Produto controlado (PCE)") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByText(/ficha técnica ou da NF do fornecedor/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "UN" } });
    fireEvent.change(screen.getByLabelText("Classe de risco"), { target: { value: "1.4G" } });
    fireEvent.change(screen.getByLabelText("NEQ unitária (gramas)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar produto" }));

    await waitFor(() =>
      expect(inventoryApi.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          sku: "AMZ8025",
          name: item.name,
          isPce: true,
          riskClass: "1.4G",
          neqGrams: 100,
          unit: "UN",
          description: item.description,
          supplierCatalogItemId: ITEM_ID,
        }),
      ),
    );
    // Selo na grade e no detalhe reaberto, sem recarregar a lista.
    expect(await screen.findAllByText("Cadastrado (SKU AMZ8025)")).toHaveLength(2);
    expect(supplierCatalogApi.list).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Cadastrar como produto" })).toBeNull();
  });

  it("handles 409 with the API message and a link to the existing product", async () => {
    vi.mocked(inventoryApi.createProduct).mockRejectedValue(
      new ApiError("Item do catálogo já vinculado a um produto.", "http", 409, {
        message: "Item do catálogo já vinculado a um produto.",
        productId: "product-7",
      }),
    );
    render(<SupplierCatalogWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhes de Torta/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar como produto" }));
    await screen.findByLabelText(/^SKU/);
    vi.mocked(supplierCatalogApi.get).mockResolvedValue({
      ...item,
      productId: "product-7",
      productSku: "OUTRO-SKU",
    });
    fireEvent.click(screen.getByLabelText("Produto controlado (PCE)"));
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "UN" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar produto" }));

    expect(await screen.findByText("Item do catálogo já vinculado a um produto.")).toBeTruthy();
    expect(
      await screen.findByText((_, node) =>
        node?.tagName === "P" && /vinculado a um produto \(SKU OUTRO-SKU\)/.test(node.textContent ?? ""),
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver em Produtos e lotes" }).getAttribute("href")).toBe(
      "/modules/products",
    );
    expect(screen.getByText("Cadastrado (SKU OUTRO-SKU)")).toBeTruthy();
  });

  it("keeps the form open with typed values on 409 without productId (duplicate SKU)", async () => {
    vi.mocked(inventoryApi.createProduct).mockRejectedValue(
      new ApiError("Já existe um registro com esses dados únicos.", "http", 409, {
        message: "Já existe um registro com esses dados únicos.",
      }),
    );
    render(<SupplierCatalogWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhes de Torta/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar como produto" }));
    await screen.findByLabelText(/^SKU/);
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "UN" } });
    fireEvent.change(screen.getByLabelText("Classe de risco"), { target: { value: "1.4G" } });
    fireEvent.change(screen.getByLabelText("NEQ unitária (gramas)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar produto" }));

    expect(await screen.findByText("Já existe um registro com esses dados únicos.")).toBeTruthy();
    expect(screen.queryByText(/Nenhum novo produto foi criado/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver em Produtos e lotes" })).toBeNull();
    expect(supplierCatalogApi.get).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText("Classe de risco") as HTMLInputElement).value).toBe("1.4G");
    expect((screen.getByLabelText("NEQ unitária (gramas)") as HTMLInputElement).value).toBe("100");
    expect((screen.getByLabelText(/^SKU/) as HTMLInputElement).value).toBe("AMZ8025");
    expect(screen.getByRole("button", { name: "Cadastrar produto" })).toBeTruthy();
  });

  it("shows the empty state and the API error message", async () => {
    vi.mocked(supplierCatalogApi.list).mockResolvedValueOnce(page([]));
    render(<SupplierCatalogWorkspace />);
    expect(await screen.findByText("Nenhum item do catálogo corresponde aos filtros.")).toBeTruthy();
    cleanup();

    vi.mocked(supplierCatalogApi.list).mockRejectedValueOnce(
      new ApiError("Acesso negado.", "http", 403),
    );
    render(<SupplierCatalogWorkspace />);
    expect(await screen.findByText("Acesso negado.")).toBeTruthy();
  });

  it("hides product creation for profiles without ESTOQUE", async () => {
    authState.roles = ["COMPRAS"];
    render(<SupplierCatalogWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalhes de Torta/ }));

    expect(
      await screen.findByText("Cadastrar o item como produto exige o perfil ESTOQUE."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cadastrar como produto" })).toBeNull();
    expect(procurementApi.getSuppliers).toHaveBeenCalledWith(1);
  });
});
