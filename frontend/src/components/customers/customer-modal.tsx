"use client";

import type { FormEvent } from "react";
import type { Customer } from "@/lib/api";
import { PCE_CLASSES } from "./types";

interface CustomerModalProps {
  isOpen: boolean;
  editingCustomer: Customer | null;
  legalName: string;
  taxId: string;
  hasCr: boolean;
  crNumber: string;
  crExpiresAt: string;
  authorizedClasses: string[];
  submitting: boolean;
  error: string | null;
  onLegalNameChange: (val: string) => void;
  onTaxIdChange: (val: string) => void;
  onHasCrChange: (val: boolean) => void;
  onCrNumberChange: (val: string) => void;
  onCrExpiresAtChange: (val: string) => void;
  onToggleClass: (cls: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function CustomerModal({
  isOpen,
  editingCustomer,
  legalName,
  taxId,
  hasCr,
  crNumber,
  crExpiresAt,
  authorizedClasses,
  submitting,
  error,
  onLegalNameChange,
  onTaxIdChange,
  onHasCrChange,
  onCrNumberChange,
  onCrExpiresAtChange,
  onToggleClass,
  onClose,
  onSubmit,
}: CustomerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-xl font-bold">
          {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
        </h2>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <label className="field">
            <span>Razão Social / Nome completo *</span>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => onLegalNameChange(e.target.value)}
            />
          </label>

          <label className="field">
            <span>CPF ou CNPJ (apenas dígitos) *</span>
            <input
              type="text"
              required
              maxLength={18}
              disabled={Boolean(editingCustomer)}
              value={taxId}
              onChange={(e) => onTaxIdChange(e.target.value)}
            />
          </label>

          {/* Seção de CR */}
          <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3 text-neutral-900">
            <label className="flex items-center gap-2 text-sm font-semibold text-neutral-900 cursor-pointer">
              <input
                type="checkbox"
                checked={hasCr}
                onChange={(e) => onHasCrChange(e.target.checked)}
              />
              <span>Possui Certificado de Registro (CR) do Exército</span>
            </label>

            {hasCr && (
              <div className="space-y-3 pt-3 border-t border-neutral-200">
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Número do CR *</span>
                    <input
                      type="text"
                      required={hasCr}
                      value={crNumber}
                      onChange={(e) => onCrNumberChange(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Validade do CR *</span>
                    <input
                      type="date"
                      required={hasCr}
                      value={crExpiresAt}
                      onChange={(e) => onCrExpiresAtChange(e.target.value)}
                    />
                  </label>
                </div>

                <div>
                  <span className="text-xs font-semibold text-neutral-700 block mb-1.5">
                    Classes PCE Autorizadas:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PCE_CLASSES.map((cls) => {
                      const selected = authorizedClasses.includes(cls);
                      return (
                        <button
                          type="button"
                          key={cls}
                          onClick={() => onToggleClass(cls)}
                          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                            selected
                              ? "bg-[#142f31] border-[#0f2324] text-white font-bold shadow-sm"
                              : "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-medium"
                          }`}
                        >
                          Classe {cls}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <p className="form-error text-xs" role="alert">{error}</p>}

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
              {submitting ? "Salvando..." : "Salvar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
