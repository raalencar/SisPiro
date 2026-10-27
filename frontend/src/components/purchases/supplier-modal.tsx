"use client";

import type { FormEvent } from "react";
import { PCE_CLASSES } from "./types";

interface SupplierModalProps {
  isOpen: boolean;
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

export function SupplierModal({
  isOpen,
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
}: SupplierModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="modal-content panel max-w-lg w-full space-y-4">
        <h2 className="text-xl font-bold">Novo Fornecedor</h2>
        <form className="form-stack space-y-3" onSubmit={onSubmit}>
          <label className="field">
            <span>Razão Social *</span>
            <input
              type="text"
              required
              value={legalName}
              onChange={(e) => onLegalNameChange(e.target.value)}
            />
          </label>

          <label className="field">
            <span>CNPJ ou CPF (apenas dígitos) *</span>
            <input
              type="text"
              required
              maxLength={18}
              value={taxId}
              onChange={(e) => onTaxIdChange(e.target.value)}
            />
          </label>

          <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg space-y-3 text-neutral-900">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer text-neutral-800">
              <input
                type="checkbox"
                checked={hasCr}
                onChange={(e) => onHasCrChange(e.target.checked)}
                className="rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Fornecedor possui Certificado de Registro (CR)</span>
            </label>

            {hasCr && (
              <div className="space-y-3 pt-2.5 border-t border-neutral-200">
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Nº do CR *</span>
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
                  <span className="text-xs font-medium text-neutral-400 block mb-1">
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
                          className={`px-2 py-1 text-xs rounded border ${
                            selected
                              ? "bg-primary-600 border-primary-500 text-white font-bold"
                              : "bg-neutral-800 border-neutral-700 text-neutral-300"
                          }`}
                        >
                          {cls}
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
              {submitting ? "Salvando..." : "Salvar Fornecedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
