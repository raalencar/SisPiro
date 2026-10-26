"use client";

import { useState } from "react";
import { financeApi, ReconcilePreviewResult, ReconciliationSuggestion } from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface OfxReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OfxReconcileModal({
  isOpen,
  onClose,
  onSuccess,
}: OfxReconcileModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ReconcilePreviewResult | null>(null);
  const [selectedFitIds, setSelectedFitIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEscapeToClose(isOpen, onClose);
  useModalFocusTrap(isOpen);

  if (!isOpen) return null;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setPreviewData(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) throw new Error("Arquivo vazio");

        const preview = await financeApi.previewOfx(content);
        setPreviewData(preview);

        // Pré-seleciona todos os itens que tiveram match com confiança EXACT
        const initialSelected = new Set<string>();
        preview.items.forEach((item) => {
          if (
            item.matchConfidence === "EXACT" &&
            !item.alreadyReconciled &&
            item.suggestedEntry
          ) {
            initialSelected.add(item.transaction.fitId);
          }
        });
        setSelectedFitIds(initialSelected);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao processar o arquivo de extrato OFX.",
        );
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Erro ao ler o arquivo selecionado.");
      setLoading(false);
    };

    reader.readAsText(file);
  }

  function toggleItemSelection(fitId: string) {
    setSelectedFitIds((prev) => {
      const next = new Set(prev);
      if (next.has(fitId)) {
        next.delete(fitId);
      } else {
        next.add(fitId);
      }
      return next;
    });
  }

  async function handleApply() {
    if (!previewData || selectedFitIds.size === 0) return;

    setApplying(true);
    setError(null);

    try {
      const itemsToReconcile = previewData.items
        .filter(
          (item) =>
            selectedFitIds.has(item.transaction.fitId) &&
            item.suggestedEntry &&
            !item.alreadyReconciled,
        )
        .map((item) => ({
          fitId: item.transaction.fitId,
          entryId: item.suggestedEntry!.id,
          amount: item.transaction.amount,
          occurredAt: item.transaction.date,
          memo: item.transaction.memo,
        }));

      if (itemsToReconcile.length === 0) {
        throw new Error(
          "Nenhuma transação selecionada possui lançamento sugerido para conciliação.",
        );
      }

      const res = await financeApi.applyOfx(itemsToReconcile);
      setSuccessMessage(
        `Conciliação realizada com sucesso! ${res.reconciledCount} lançamentos liquidados e auditados.`,
      );

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Falha ao aplicar conciliação bancária.",
      );
    } finally {
      setApplying(false);
    }
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ofx-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 font-bold text-xs tracking-wider border border-blue-500/20">
              OFX / EXTRATO BANCÁRIO
            </span>
            <h2 id="ofx-modal-title" className="text-xl font-bold text-slate-100">
              Conciliação Bancária Automática
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de conciliação bancária"
            className="text-slate-400 hover:text-slate-200 text-xl font-bold p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 text-center animate-pulse">
            ✓ {successMessage}
          </div>
        )}

        {/* Upload de arquivo */}
        <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/50 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-slate-200 mb-1">
            Selecione o arquivo de extrato bancário padrão (.ofx)
          </p>
          <p className="text-xs text-slate-400 mb-3">
            Compatível com Itaú, Bradesco, Santander, Banco do Brasil, Inter, Sicoob, etc.
          </p>
          <label className="cursor-pointer py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md">
            <span>{loading ? "Processando arquivo..." : "Escolher arquivo .ofx"}</span>
            <input
              type="file"
              accept=".ofx"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>

        {/* Resumo e lista de transações */}
        {previewData && (
          <div className="mt-4 flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total Transações
                </span>
                <span className="text-lg font-bold text-slate-100">
                  {previewData.summary.totalTransactions}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                  Créditos ({previewData.summary.totalCredits})
                </span>
                <span className="text-lg font-bold text-emerald-300">
                  {formatCurrency(previewData.summary.creditsAmount)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">
                  Débitos ({previewData.summary.totalDebits})
                </span>
                <span className="text-lg font-bold text-rose-300">
                  {formatCurrency(previewData.summary.debitsAmount)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30">
                <span className="text-[10px] uppercase font-bold text-blue-400 block">
                  Matches Sugeridos
                </span>
                <span className="text-lg font-bold text-blue-300">
                  {previewData.summary.matchedCount} títulos
                </span>
              </div>
            </div>

            {/* Tabela de Transações */}
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-800/80 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3 w-10 text-center">Sel.</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Transação Extrato</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3">Lançamento no ERP</th>
                    <th className="p-3 text-center">Status Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                  {previewData.items.map((item: ReconciliationSuggestion, idx: number) => {
                    const isSelected = selectedFitIds.has(item.transaction.fitId);
                    const canSelect = !item.alreadyReconciled && !!item.suggestedEntry;

                    return (
                      <tr
                        key={item.transaction.fitId || idx}
                        className={`hover:bg-slate-800/50 transition-colors ${
                          isSelected ? "bg-blue-950/20" : ""
                        }`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!canSelect}
                            onChange={() => toggleItemSelection(item.transaction.fitId)}
                            className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 cursor-pointer disabled:opacity-30"
                          />
                        </td>
                        <td className="p-3 font-mono text-slate-300 whitespace-nowrap">
                          {item.transaction.date}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-200 truncate max-w-xs">
                            {item.transaction.memo}
                          </p>
                          <span className="font-mono text-[10px] text-slate-400">
                            FITID: {item.transaction.fitId}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold whitespace-nowrap">
                          <span
                            className={
                              item.transaction.type === "CREDIT"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }
                          >
                            {item.transaction.type === "CREDIT" ? "+" : "-"}
                            {formatCurrency(item.transaction.amount)}
                          </span>
                        </td>
                        <td className="p-3">
                          {item.suggestedEntry ? (
                            <div>
                              <div className="font-semibold text-slate-200">
                                #{item.suggestedEntry.code} - {item.suggestedEntry.counterparty}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Venc: {item.suggestedEntry.dueDate} | Saldo:{" "}
                                {formatCurrency(item.suggestedEntry.remaining)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">
                              Nenhum título em aberto correspondente
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {item.alreadyReconciled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-300">
                              JÁ CONCILIADO
                            </span>
                          ) : item.matchConfidence === "EXACT" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              EXATO (100%)
                            </span>
                          ) : item.matchConfidence === "APPROXIMATE" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              APROXIMADO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              NÃO ENCONTRADO
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            {previewData && (
              <span>
                {selectedFitIds.size} de {previewData.items.length} transações selecionadas
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            {previewData && (
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || selectedFitIds.size === 0}
                className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {applying
                  ? "Liquidando..."
                  : `Conciliar Selecionados (${selectedFitIds.size})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
