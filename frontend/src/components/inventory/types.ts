import type {
  Magazine,
  PageResult,
  Product,
  ProductLot,
  StockMovement,
  StockReport,
} from "@/lib/api";
import type { InventoryFormType } from "@/components/inventory-create-form";

export * from "./components";

export type Tab =
  | "overview"
  | "products"
  | "lots"
  | "magazines"
  | "movements"
  | "sfpc";

export type InventoryData = {
  report: StockReport | null;
  products: PageResult<Product>;
  lots: PageResult<ProductLot>;
  magazines: PageResult<Magazine>;
  movements: PageResult<StockMovement>;
};

export const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Resumo" },
  { id: "products", label: "Produtos" },
  { id: "lots", label: "Lotes" },
  { id: "magazines", label: "Paióis" },
  { id: "movements", label: "Movimentações" },
  { id: "sfpc", label: "Mapa SFPC (R-105)" },
];

export const createFormByTab: Partial<Record<Tab, InventoryFormType>> = {
  products: "product",
  lots: "lot",
  magazines: "magazine",
  movements: "movement",
};

export const productTypeLabels: Record<string, string> = {
  MERCADORIA: "Mercadoria",
  INSUMO: "Insumo",
  SERVICO: "Serviço",
};

export const movementLabels: Record<string, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  TRANSFERENCIA: "Transferência",
  AJUSTE: "Ajuste",
};

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível carregar o estoque.";
}
