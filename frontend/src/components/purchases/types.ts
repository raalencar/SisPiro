import type { Purchase, PurchaseStatus } from "@/lib/api";

export const PCE_CLASSES = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];

export const STATUS_LABELS: Record<PurchaseStatus, string> = {
  PENDENTE: "Pendente",
  PARCIAL: "Parcial",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
};

export const STATUS_TONES: Record<PurchaseStatus, string> = {
  PENDENTE: "neutral",
  PARCIAL: "warning",
  RECEBIDO: "available",
  CANCELADO: "error",
};

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function receivedQuantity(item: Purchase["items"][number]): number {
  return item.receipts.reduce((sum, receipt) => sum + Number(receipt.quantity), 0);
}

export function purchaseTotal(purchase: Purchase): number {
  return purchase.items.reduce(
    (sum, item) => sum + Number(item.orderedQuantity) * Number(item.unitCost),
    0,
  );
}
