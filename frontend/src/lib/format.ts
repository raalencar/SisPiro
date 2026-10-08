const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatDateOnly(value: string | Date): string {
  const date = value instanceof Date
    ? value
    : new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date);
}

export function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: BRAZIL_TIME_ZONE,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits,
  }).format(value);
}
