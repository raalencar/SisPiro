"use client";

import { useState } from "react";
import { GeneratedPix } from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface PixModalProps {
  isOpen: boolean;
  pixData: GeneratedPix | null;
  onClose: () => void;
  onPaymentConfirmed?: () => void;
}

export function PixModal({
  isOpen,
  pixData,
  onClose,
  onPaymentConfirmed,
}: PixModalProps) {
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulatedSuccess, setSimulatedSuccess] = useState(false);

  useEscapeToClose(isOpen, onClose);
  useModalFocusTrap(isOpen);

  if (!isOpen || !pixData) return null;

  async function handleCopy() {
    if (!pixData) return;
    try {
      await navigator.clipboard.writeText(pixData.copyPasteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback simples
      const textArea = document.createElement("textarea");
      textArea.value = pixData.copyPasteCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  async function handleSimulateWebhook() {
    if (!pixData) return;
    setSimulating(true);
    try {
      // Chama webhook via proxy BFF para simular notificação bancária instantânea
      const res = await fetch("/api/finance/pix/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txid: pixData.txid,
          amount: pixData.amount,
          e2eId: `E_SIMULADO_${Date.now()}`,
          paidAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setSimulatedSuccess(true);
        setTimeout(() => {
          onPaymentConfirmed?.();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error("Falha ao simular pagamento PIX:", err);
    } finally {
      setSimulating(false);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pix-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100 flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-400 font-bold text-xs tracking-wider border border-teal-500/20">
              PIX DINÂMICO
            </span>
            <h2 id="pix-modal-title" className="text-lg font-bold text-slate-100">
              Cobrança Instantânea
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de cobrança PIX"
            className="text-slate-400 hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Valor em destaque */}
        <div className="text-center my-2">
          <span className="text-xs uppercase tracking-wider text-slate-400">
            Valor a Pagar
          </span>
          <div className="text-3xl font-extrabold text-teal-400">
            {formatCurrency(pixData.amount)}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            TxID: <span className="font-mono text-slate-300">{pixData.txid}</span>
          </p>
        </div>

        {/* QR Code */}
        <div className="my-4 p-3 bg-white rounded-2xl shadow-inner border border-slate-300 flex items-center justify-center">
          <img
            src={pixData.qrCodeDataUrl}
            alt="QR Code PIX para pagamento"
            className="w-56 h-56 object-contain"
          />
        </div>

        {/* Copia e Cola */}
        <div className="w-full mt-2">
          <label
            htmlFor="pix-copy-paste-input"
            className="block text-xs font-medium text-slate-300 mb-1"
          >
            Código Pix Copia e Cola:
          </label>
          <div className="flex items-center gap-2">
            <input
              id="pix-copy-paste-input"
              readOnly
              value={pixData.copyPasteCode}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-300 truncate focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-teal-600 hover:bg-teal-500 text-white"
              }`}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Informações de expiração */}
        <div className="w-full mt-4 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
          <span>Expira em:</span>
          <span className="font-medium text-slate-200">
            {new Date(pixData.expiresAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Ação de simulação de baixa bancária (útil em testes/demonstração) */}
        {simulatedSuccess ? (
          <div className="w-full mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-center text-xs font-bold text-emerald-300 animate-pulse">
            ✓ Pagamento confirmado e liquidado via Webhook bancário!
          </div>
        ) : (
          <div className="w-full mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleSimulateWebhook}
              disabled={simulating}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-600 transition-colors"
            >
              {simulating ? "Processando..." : "Simular Confirmação Bancária"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
