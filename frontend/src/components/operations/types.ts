import type { OperationalLot, ServiceOrder, ServiceOrderStatus } from "@/lib/api";

export type OrderAction = "create" | "edit" | "approve" | "start" | "cancel" | "close";
export type OrderDraftItem = { lotId: string; quantity: string };

export function localDateTime(daysAhead: number): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function localDate(daysAhead = 0): string {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function monthRange(): { from: string; to: string } {
  const now = new Date();
  return {
    from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    to: localDate(
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
        now.getDate(),
    ),
  };
}

export function isUsableLot(lot: OperationalLot): boolean {
  const today = localDate(0);
  return (
    lot.product.type !== "SERVICO" &&
    Number(lot.quantity) > 0 &&
    lot.expiresAt.slice(0, 10) >= today &&
    lot.magazine.active &&
    lot.magazine.fireLicenseExpiresAt.slice(0, 10) >= today
  );
}

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  ORCAMENTO: "Orçamento",
  APROVADO: "Aprovada",
  EM_MONTAGEM: "Em montagem",
  CONCLUIDO: "Concluída",
  CANCELADO: "Cancelada",
};

export const STATUS_TONES: Record<ServiceOrderStatus, string> = {
  ORCAMENTO: "neutral",
  APROVADO: "available",
  EM_MONTAGEM: "warning",
  CONCLUIDO: "available",
  CANCELADO: "error",
};

export interface StepDef {
  number: number;
  label: string;
  sublabel: string;
  state: "completed" | "current" | "upcoming";
}

export function getOrderSteps(order: ServiceOrder): StepDef[] {
  const isCanceled = order.status === "CANCELADO";
  const s = order.status;

  const step1State: StepDef["state"] = isCanceled
    ? "upcoming"
    : s === "ORCAMENTO"
      ? "current"
      : "completed";

  const step2State: StepDef["state"] = isCanceled || s === "ORCAMENTO"
    ? "upcoming"
    : s === "APROVADO"
      ? "current"
      : "completed";

  const step3State: StepDef["state"] = isCanceled || s === "ORCAMENTO"
    ? "upcoming"
    : s === "APROVADO" || s === "EM_MONTAGEM"
      ? "current"
      : "completed";

  const step4State: StepDef["state"] = isCanceled || s === "ORCAMENTO" || s === "APROVADO"
    ? "upcoming"
    : s === "EM_MONTAGEM"
      ? "current"
      : "completed";

  const step5State: StepDef["state"] = s === "CONCLUIDO"
    ? "current"
    : "upcoming";

  return [
    {
      number: 1,
      label: "1. Orçamento",
      sublabel: s === "ORCAMENTO" ? "Proposta em aberto" : "Lotes validados",
      state: step1State,
    },
    {
      number: 2,
      label: "2. Aprovação & ART",
      sublabel: order.responsibleBlaster ? order.responsibleBlaster.name : "Designar Blaster",
      state: step2State,
    },
    {
      number: 3,
      label: "3. Guia de Tráfego & Carga",
      sublabel: "Transporte militar",
      state: step3State,
    },
    {
      number: 4,
      label: "4. Montagem & Queima",
      sublabel: s === "EM_MONTAGEM" ? "Equipe em campo" : "Disparo dos fogos",
      state: step4State,
    },
    {
      number: 5,
      label: "5. Conclusão & Fiscal",
      sublabel: s === "CONCLUIDO" ? "NFS-e emitida" : "Apuração e sobras",
      state: step5State,
    },
  ];
}
