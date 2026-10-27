"use client";

import { Icon } from "@/components/icon";
import type { PageResult, SalesQuote } from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";

interface QuotesTabProps {
  loading: boolean;
  quotes: PageResult<SalesQuote> | null;
  currentDate: string;
  onPrintQuote: (quote: SalesQuote) => void;
  onSendQuote: (quoteId: string) => void;
  onEditQuote: (quote: SalesQuote) => void;
  onConvertQuote: (quote: SalesQuote) => void;
  onCancelQuote: (quoteId: string) => void;
}

export function QuotesTab({
  loading,
  quotes,
  currentDate,
  onPrintQuote,
  onSendQuote,
  onEditQuote,
  onConvertQuote,
  onCancelQuote,
}: QuotesTabProps) {
  return (
    <div className="space-y-4">
      <div className="panel p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Carregando orçamentos...</div>
        ) : !quotes || quotes.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">Nenhum orçamento emitido.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-50/90 border-b border-neutral-200 text-neutral-800 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Valor Total</th>
                  <th className="p-3">Validade / Reserva</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {quotes.data.map((q) => {
                  const isExpired = Boolean(
                    q.expiresAt && q.expiresAt.slice(0, 10) < currentDate,
                  );
                  return (
                    <tr key={q.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="p-3 text-xs text-neutral-600 font-medium">{formatDateOnly(q.createdAt)}</td>
                      <td className="p-3 font-semibold text-neutral-900 text-sm">{q.customer?.legalName || "Cliente"}</td>
                      <td className="p-3 font-mono font-bold text-neutral-900 text-sm">{formatCurrency(Number(q.total))}</td>
                      <td className="p-3 text-xs">
                        <span className={isExpired ? "text-rose-800 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block" : "text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block"}>
                          {formatDateOnly(q.expiresAt)} {isExpired ? "(Expirado)" : "(Reserva ativa)"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`status-pill ${
                            q.status === "EMITIDO"
                              ? isExpired
                                ? "status-pill--neutral"
                                : "status-pill--warning"
                              : q.status === "CONVERTIDO"
                                ? "status-pill--available"
                                : "status-pill--error"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="button button--secondary text-xs py-1 px-2.5 flex items-center gap-1.5 border-neutral-300 hover:bg-neutral-100 text-neutral-900 font-semibold shadow-sm"
                            onClick={() => onPrintQuote(q)}
                            title="Visualizar e Imprimir Proposta Comercial Formal"
                          >
                            <Icon name="receipt" size={13} />
                            <span>Proposta</span>
                          </button>
                          {q.status === "EMITIDO" && !isExpired && (
                            <>
                              <button
                                className="button button--secondary text-xs py-1 px-2 border-primary-300 text-primary-800 bg-primary-50 hover:bg-primary-100 font-medium"
                                onClick={() => onSendQuote(q.id)}
                                title="Enviar orçamento por e-mail via BullMQ"
                              >
                                Enviar
                              </button>
                              <button
                                className="button button--secondary text-xs py-1 px-2 border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-medium"
                                onClick={() => onEditQuote(q)}
                              >
                                Editar
                              </button>
                              <button
                                className="button button--primary text-xs py-1 px-2 shadow-sm font-semibold"
                                onClick={() => onConvertQuote(q)}
                              >
                                Converter
                              </button>
                              <button
                                className="button button--secondary text-xs py-1 px-2 border-rose-300 text-rose-800 bg-rose-50 hover:bg-rose-100 font-medium"
                                onClick={() => onCancelQuote(q.id)}
                              >
                                Cancelar
                              </button>
                            </>
                          )}
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
    </div>
  );
}
