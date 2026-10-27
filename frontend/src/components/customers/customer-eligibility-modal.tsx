"use client";

import type { FormEvent } from "react";
import type { Customer, CustomerEligibility } from "@/lib/api";
import { PCE_CLASSES } from "./types";

interface CustomerEligibilityModalProps {
  customer: Customer | null;
  classesToCheck: string[];
  eligibilityResult: CustomerEligibility | null;
  checkingEligibility: boolean;
  onToggleCheckClass: (cls: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function CustomerEligibilityModal({
  customer,
  classesToCheck,
  eligibilityResult,
  checkingEligibility,
  onToggleCheckClass,
  onClose,
  onSubmit,
}: CustomerEligibilityModalProps) {
  if (!customer) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-md w-full space-y-4">
        <h2 className="text-lg font-bold">Verificar Elegibilidade PCE</h2>
        <p className="text-xs text-neutral-400">
          Avalia o CR de <strong>{customer.legalName}</strong> contra classes controladas específicas:
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PCE_CLASSES.map((cls) => {
              const selected = classesToCheck.includes(cls);
              return (
                <button
                  type="button"
                  key={cls}
                  onClick={() => onToggleCheckClass(cls)}
                  className={`px-2 py-1 text-xs rounded border ${
                    selected
                      ? "bg-amber-600 border-amber-500 text-white font-bold"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300"
                  }`}
                >
                  {cls}
                </button>
              );
            })}
          </div>

          {eligibilityResult && (
            <div
              className={`p-3 rounded text-xs border ${
                eligibilityResult.eligible
                  ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                  : "bg-rose-950/40 border-rose-700 text-rose-300"
              }`}
            >
              <div className="font-bold mb-1">
                {eligibilityResult.eligible
                  ? "✓ Cliente Elegível para compra de PCE"
                  : "✗ Cliente NÃO Elegível"}
              </div>
              {eligibilityResult.reasons.length > 0 && (
                <ul className="list-disc pl-4 space-y-0.5">
                  {eligibilityResult.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              type="submit"
              className="button button--secondary"
              disabled={checkingEligibility || classesToCheck.length === 0}
            >
              {checkingEligibility ? "Validando..." : "Testar Classes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
