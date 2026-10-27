"use client";

import type { PageResult } from "@/lib/api";

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <article className={`inventory-metric inventory-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function EmptyTable({ message }: { message: string }) {
  return <p className="table-empty">{message}</p>;
}

export function PaginationNav({
  result,
  onChange,
}: {
  result: PageResult<unknown>;
  onChange: (page: number) => void;
}) {
  if (result.meta.totalPages <= 1) return null;
  return (
    <nav className="table-pagination" aria-label="Paginação">
      <button
        className="button button--quiet"
        type="button"
        disabled={result.meta.page <= 1}
        onClick={() => onChange(result.meta.page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {result.meta.page} de {result.meta.totalPages} · {result.meta.total} registros
      </span>
      <button
        className="button button--quiet"
        type="button"
        disabled={result.meta.page >= result.meta.totalPages}
        onClick={() => onChange(result.meta.page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}
