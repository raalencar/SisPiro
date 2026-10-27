"use client";

import type { Magazine } from "@/lib/api";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { EmptyTable } from "./types";

interface MagazinesTabProps {
  magazines: Magazine[];
  onToggleStatus: (magazine: Magazine) => void;
}

export function MagazinesTab({
  magazines,
  onToggleStatus,
}: MagazinesTabProps) {
  if (magazines.length === 0) {
    return <EmptyTable message="Nenhum paiol corresponde à busca." />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Paiol</th>
            <th>Situação</th>
            <th>NEQ atual</th>
            <th>Capacidade</th>
            <th>Disponível</th>
            <th>Licença até</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {magazines.map((magazine) => (
            <tr key={magazine.id}>
              <td>
                <strong>{magazine.name}</strong>
              </td>
              <td>
                {magazine.active ? (
                  <span className="stock-badge">Ativo</span>
                ) : (
                  <span className="stock-badge stock-badge--danger">
                    Inativo
                  </span>
                )}
              </td>
              <td>
                {(() => {
                  const cur = Number(magazine.currentNeqKg) || 0;
                  const max = Number(magazine.maxNeqCapacityKg) || 1;
                  const pct = Math.min(100, Math.round((cur / max) * 100));
                  const barColor =
                    pct >= 90
                      ? "bg-rose-500"
                      : pct >= 70
                        ? "bg-amber-500"
                        : "bg-emerald-500";
                  const textColor =
                    pct >= 90
                      ? "text-rose-400 font-bold"
                      : pct >= 70
                        ? "text-amber-400 font-semibold"
                        : "text-emerald-400";
                  return (
                    <div className="space-y-1 min-w-[130px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className={textColor}>{formatNumber(cur)} kg</span>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${pct}%` }}
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>
                  );
                })()}
              </td>
              <td>
                {formatNumber(Number(magazine.maxNeqCapacityKg))} kg
              </td>
              <td>
                <span className="font-mono text-xs text-neutral-300">
                  {formatNumber(Number(magazine.remainingNeqKg))} kg
                </span>
              </td>
              <td>{formatDateOnly(magazine.fireLicenseExpiresAt)}</td>
              <td>
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => onToggleStatus(magazine)}
                >
                  {magazine.active ? "Inativar" : "Reativar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
