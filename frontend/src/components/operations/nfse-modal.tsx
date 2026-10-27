"use client";

import type { FormEvent } from "react";
import type { FiscalDocument, ServiceOrder } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface NfseModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ServiceOrder | null;
  submitting: boolean;
  error: string | null;
  success: FiscalDocument | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function NfseModal({
  isOpen,
  onClose,
  order,
  submitting,
  error,
  success,
  onSubmit,
}: NfseModalProps) {
  useEscapeToClose(isOpen, () => !submitting && onClose());
  useModalFocusTrap(isOpen);

  if (!isOpen || !order) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nfse-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-slate-100 flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-xs tracking-wider border border-emerald-500/20">
              NFS-e PREFEITURA
            </span>
            <h2 id="nfse-modal-title" className="text-lg font-bold text-slate-100">
              Emitir Nota Fiscal de Serviços
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {success ? (
          <div className="mt-4 p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center">
            <p className="text-sm font-bold text-emerald-300">✓ NFS-e Emitida com Sucesso!</p>
            <p className="text-xs text-slate-300 mt-1">Número: #{success.number}</p>
            <p className="text-xs font-mono text-slate-400 mt-1">Chave: {success.accessKey ?? success.protocol}</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 text-xs">
            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Tomador:</span>
                <span className="font-semibold text-slate-200">{order.customer.legalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Local do Show:</span>
                <span className="text-slate-200">{order.eventLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Blaster / ART:</span>
                <span className="text-slate-200">{order.responsibleBlaster?.name ?? "Técnico"} · ART {order.artNumber ?? "S/N"}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700/50 pt-1 font-bold">
                <span className="text-slate-300">Valor Total:</span>
                <span className="text-emerald-400">{formatCurrency(Number(order.contractedAmount))}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="button button--quiet"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="button button--primary"
                disabled={submitting}
              >
                {submitting ? "Autorizando..." : "Autorizar NFS-e na Prefeitura"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
