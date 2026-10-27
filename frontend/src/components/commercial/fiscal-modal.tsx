"use client";

import type { FormEvent } from "react";
import type { FiscalDocument, Sale } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface FiscalModalProps {
  sale: Sale | null;
  onClose: () => void;
  type: "NFE" | "NFCE";
  onTypeChange: (type: "NFE" | "NFCE") => void;
  nature: string;
  onNatureChange: (nature: string) => void;
  submitting: boolean;
  error: string | null;
  success: FiscalDocument | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function FiscalModal({
  sale,
  onClose,
  type,
  onTypeChange,
  nature,
  onNatureChange,
  submitting,
  error,
  success,
  onSubmit,
}: FiscalModalProps) {
  useEscapeToClose(Boolean(sale), onClose);
  useModalFocusTrap(Boolean(sale));

  if (!sale) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="modal-content panel max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fiscal-sale-title"
      >
        <h2 id="fiscal-sale-title" className="text-xl font-bold flex items-center gap-2">
          <span>📄</span> Emissão Fiscal de Venda
        </h2>

        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg space-y-1 text-xs text-neutral-900">
          <div>
            <strong>Destinatário:</strong>{" "}
            {sale.customer
              ? `${sale.customer.legalName} (${sale.customer.taxId})`
              : "Consumidor Final (Venda de balcão)"}
          </div>
          <div>
            <strong>Valor Total:</strong>{" "}
            <span className="font-mono font-bold text-emerald-700">
              {formatCurrency(Number(sale.total))}
            </span>
          </div>
          <div>
            <strong>Itens:</strong> {sale.items.length} produto(s)
          </div>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg space-y-2 text-xs text-emerald-900">
            <div className="font-bold text-sm text-emerald-800">
              ✅ Documento Fiscal Autorizado pela SEFAZ!
            </div>
            <div>
              <strong>Tipo:</strong> {success.type} · <strong>Número:</strong> {success.number} · <strong>Série:</strong> {success.series}
            </div>
            {success.accessKey && (
              <div className="p-2.5 bg-white border border-neutral-300 rounded font-mono text-[11px] break-all select-all text-neutral-800">
                Chave: {success.accessKey}
              </div>
            )}
            {success.xmlUrl && (
              <div>
                <a
                  href={success.xmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button--secondary text-xs inline-block mt-2"
                >
                  Baixar XML Autorizado
                </a>
              </div>
            )}
            <div className="pt-2 text-right">
              <button
                type="button"
                className="button button--primary text-xs"
                onClick={onClose}
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form className="form-stack space-y-3" onSubmit={onSubmit}>
            <label className="field">
              <span>Modelo de Documento Fiscal *</span>
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as "NFE" | "NFCE")}
                className="input"
              >
                <option value="NFE" disabled={!sale.customer}>
                  NF-e — Modelo 55 (Nota Fiscal Eletrônica com Destinatário)
                </option>
                <option value="NFCE">
                  NFC-e — Modelo 65 (Nota Fiscal de Consumidor Eletrônica)
                </option>
              </select>
              {!sale.customer && (
                <span className="text-[11px] text-amber-400 block mt-1">
                  * Vendas sem cliente identificado emitem NFC-e (Cupom de Balcão).
                </span>
              )}
            </label>

            {type === "NFE" && (
              <label className="field">
                <span>Natureza da Operação *</span>
                <input
                  type="text"
                  required
                  value={nature}
                  onChange={(e) => onNatureChange(e.target.value)}
                />
              </label>
            )}

            {error && (
              <p className="form-error text-xs" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="button button--ghost"
                onClick={onClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={submitting}
              >
                {submitting ? "Emitindo..." : "Autorizar na SEFAZ"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
