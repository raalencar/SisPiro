"use client";

import type { Customer, PageResult } from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

interface CustomersTableProps {
  customers: PageResult<Customer> | null;
  loading: boolean;
  onOpenEdit: (customer: Customer) => void;
  onCheckEligibility: (customer: Customer) => void;
}

export function CustomersTable({
  customers,
  loading,
  onOpenEdit,
  onCheckEligibility,
}: CustomersTableProps) {
  return (
    <div className="panel p-0 overflow-hidden">
      {loading ? (
        <div className="p-8 text-center text-neutral-400">Carregando clientes...</div>
      ) : !customers || customers.data.length === 0 ? (
        <div className="p-8 text-center text-neutral-400">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full text-left text-sm">
            <thead className="bg-neutral-50/90 border-b border-neutral-200 text-neutral-800 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Razão Social / Nome</th>
                <th className="p-3">CPF/CNPJ</th>
                <th className="p-3">Certificado de Registro (CR)</th>
                <th className="p-3">Classes PCE</th>
                <th className="p-3">Situação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white">
              {customers.data.map((c) => {
                const daysUntilExpiration = c.crExpiresAt
                  ? Math.ceil(
                      (new Date(c.crExpiresAt).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;
                const crExpired = daysUntilExpiration !== null && daysUntilExpiration < 0;
                const crExpiringSoon =
                  daysUntilExpiration !== null &&
                  daysUntilExpiration >= 0 &&
                  daysUntilExpiration <= 30;

                return (
                  <tr key={c.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-neutral-900 text-sm">
                        {c.legalName}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs text-neutral-700 font-medium">{c.taxId}</td>
                    <td className="p-3">
                      {c.hasCr ? (
                        <div className="space-y-1">
                          <span className="font-mono text-xs font-bold text-neutral-900 block">
                            CR #{c.crNumber || "s/ nº"}
                          </span>
                          {c.crExpiresAt && (
                            <div>
                              {crExpired ? (
                                <span className="status-pill status-pill--error text-[11px] py-0.5 px-2">
                                  🚫 Vencido ({formatDateOnly(c.crExpiresAt)})
                                </span>
                              ) : crExpiringSoon ? (
                                <span className="status-pill status-pill--warning text-[11px] py-0.5 px-2 font-bold animate-pulse">
                                  ⚠️ Vence em {daysUntilExpiration} dia(s)
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                                  ✓ Válido até {formatDateOnly(c.crExpiresAt)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500 italic">Sem CR (Não autorizado para PCE)</span>
                      )}
                    </td>
                    <td className="p-3">
                      {c.authorizedPceClasses && c.authorizedPceClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.authorizedPceClasses.map((cls) => (
                            <span key={cls} className="badge-pce">
                              {cls}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`status-pill ${
                          c.active ? "status-pill--available" : "status-pill--neutral"
                        }`}
                      >
                        {c.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`/modules/sales`}
                          className="button button--secondary text-xs py-1 px-2 border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-medium"
                          title="Abrir novo orçamento para este cliente"
                        >
                          + Orçamento
                        </a>
                        <button
                          type="button"
                          className="button button--secondary text-xs py-1 px-2 border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-medium"
                          onClick={() => onCheckEligibility(c)}
                          title="Validar elegibilidade PCE perante o Exército"
                        >
                          Checar CR
                        </button>
                        <button
                          type="button"
                          className="button button--secondary text-xs py-1 px-2 border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-medium"
                          onClick={() => onOpenEdit(c)}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
