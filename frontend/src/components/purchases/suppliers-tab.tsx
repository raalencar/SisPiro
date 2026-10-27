"use client";

import type { PageResult, Supplier } from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

interface SuppliersTabProps {
  suppliers: PageResult<Supplier> | null;
  search: string;
  onSearchChange: (search: string) => void;
}

export function SuppliersTab({
  suppliers,
  search,
  onSearchChange,
}: SuppliersTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="field w-full max-w-md">
          <span className="sr-only">Buscar fornecedores</span>
          <input
            type="search"
            placeholder="Buscar fornecedores por razão social ou CNPJ..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input w-full"
          />
        </label>
      </div>

      <div className="panel p-0 overflow-hidden shadow-sm border border-neutral-200">
        {!suppliers || suppliers.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">Nenhum fornecedor cadastrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-50/90 text-neutral-600 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="p-3">Razão Social</th>
                  <th className="p-3">CNPJ / CPF</th>
                  <th className="p-3">Certificado de Registro (CR)</th>
                  <th className="p-3">Classes PCE</th>
                  <th className="p-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {suppliers.data.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 font-semibold text-neutral-900">{s.legalName}</td>
                    <td className="p-3 font-mono text-xs text-neutral-700">{s.taxId}</td>
                    <td className="p-3">
                      {s.hasCr ? (
                        <div>
                          <span className="font-mono text-xs text-emerald-700 font-bold">
                            {s.crNumber || "CR s/ nº"}
                          </span>
                          {s.crExpiresAt && (
                            <div className="text-xs text-neutral-500 mt-0.5">
                              Vence: {formatDateOnly(s.crExpiresAt)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">Sem CR</span>
                      )}
                    </td>
                    <td className="p-3">
                      {s.authorizedPceClasses && s.authorizedPceClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.authorizedPceClasses.map((cls) => (
                            <span key={cls} className="badge-pce">
                              {cls}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`status-pill ${
                          s.active ? "status-pill--available" : "status-pill--neutral"
                        }`}
                      >
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
