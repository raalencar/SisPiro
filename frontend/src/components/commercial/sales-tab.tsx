"use client";

import type { PageResult, Sale } from "@/lib/api";
import { formatCurrency, formatDateOnly, formatNumber } from "@/lib/format";

interface SalesTabProps {
  sales: PageResult<Sale> | null;
  pixLoading: boolean;
  onOpenFiscalModal: (sale: Sale) => void;
  onOpenPixModal: (sale: Sale) => void;
  onPrintSaleReceipt: (sale: Sale) => void;
  onOpenReturn: (sale: Sale) => void;
}

export function SalesTab({
  sales,
  pixLoading,
  onOpenFiscalModal,
  onOpenPixModal,
  onPrintSaleReceipt,
  onOpenReturn,
}: SalesTabProps) {
  return (
    <div className="space-y-4">
      <div className="panel p-0 overflow-hidden">
        {!sales || sales.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">Nenhuma venda finalizada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-50/90 border-b border-neutral-200 text-neutral-800 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Itens</th>
                  <th className="p-3">Valor Líquido</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {sales.data.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 text-xs text-neutral-600 font-medium">{formatDateOnly(s.createdAt)}</td>
                    <td className="p-3 font-semibold text-neutral-900 text-sm">
                      {s.customer ? s.customer.legalName : "Venda de Balcão (s/ cliente)"}
                    </td>
                    <td className="p-3 text-xs">
                      {s.items.map((it, i) => (
                        <div key={i} className="text-neutral-800 font-medium">
                          {it.product?.name || "Produto"}: {formatNumber(Number(it.quantity))} un.
                        </div>
                      ))}
                    </td>
                    <td className="p-3 font-mono font-bold text-neutral-900 text-sm">
                      {formatCurrency(Number(s.total))}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="button button--secondary text-xs py-1 px-2.5 border-emerald-600 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-semibold flex items-center gap-1 shadow-sm"
                          onClick={() => onOpenFiscalModal(s)}
                          title={s.customer ? "Emitir NF-e (Modelo 55)" : "Emitir NFC-e (Modelo 65)"}
                        >
                          <span>📄</span> {s.customer ? "NF-e" : "NFC-e"}
                        </button>
                        <button
                          className="button button--secondary text-xs py-1 px-2.5 border-teal-600 text-teal-800 bg-teal-50 hover:bg-teal-100 font-semibold flex items-center gap-1 shadow-sm"
                          onClick={() => onOpenPixModal(s)}
                          disabled={pixLoading}
                          title="Cobrar via QR Code PIX no balcão"
                        >
                          <span>📱</span> PIX
                        </button>
                        <button
                          className="button button--secondary text-xs py-1 px-2.5 border-neutral-300 hover:bg-neutral-100 text-neutral-800 font-medium shadow-sm"
                          onClick={() => onPrintSaleReceipt(s)}
                          title="Visualizar e Imprimir Comprovante / Recibo da Venda"
                        >
                          Recibo
                        </button>
                        <button
                          className="button button--secondary text-xs py-1 px-2.5 border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 font-medium shadow-sm"
                          onClick={() => onOpenReturn(s)}
                        >
                          Devolver Itens
                        </button>
                      </div>
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
