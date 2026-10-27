"use client";

import type { FormEvent } from "react";
import type { ServiceOrder } from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

interface GtModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ServiceOrder | null;
  originCity: string;
  onOriginCityChange: (val: string) => void;
  originState: string;
  onOriginStateChange: (val: string) => void;
  destCity: string;
  onDestCityChange: (val: string) => void;
  destState: string;
  onDestStateChange: (val: string) => void;
  plate: string;
  onPlateChange: (val: string) => void;
  plateState: string;
  onPlateStateChange: (val: string) => void;
  driverCpf: string;
  onDriverCpfChange: (val: string) => void;
  driverLicense: string;
  onDriverLicenseChange: (val: string) => void;
  driverName: string;
  onDriverNameChange: (val: string) => void;
  route: string;
  onRouteChange: (val: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent) => Promise<void>;
}

export function GtModal({
  isOpen,
  onClose,
  order,
  originCity,
  onOriginCityChange,
  originState,
  onOriginStateChange,
  destCity,
  onDestCityChange,
  destState,
  onDestStateChange,
  plate,
  onPlateChange,
  plateState,
  onPlateStateChange,
  driverCpf,
  onDriverCpfChange,
  driverLicense,
  onDriverLicenseChange,
  driverName,
  onDriverNameChange,
  route,
  onRouteChange,
  submitting,
  error,
  onSubmit,
}: GtModalProps) {
  useEscapeToClose(isOpen, () => !submitting && onClose());
  useModalFocusTrap(isOpen);

  if (!isOpen || !order) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-xs tracking-wider border border-blue-500/20">
              R-105 / DFPC
            </span>
            <h2 id="gt-modal-title" className="text-lg font-bold text-slate-100">
              Emitir Guia de Tráfego para Ordem #{order.code}
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

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 overflow-y-auto pr-1">
          <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs">
            <p className="font-semibold text-slate-200">
              Destino: {order.eventLocation} · Cliente: {order.customer.legalName}
            </p>
            <p className="text-slate-400 mt-1">
              Blaster: {order.responsibleBlaster?.name ?? "Definido na aprovação"} · Itens: {order.items.length} produto(s) PCE
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Cidade de Origem (Paiol)</label>
              <input
                type="text"
                required
                value={originCity}
                onChange={(e) => onOriginCityChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">UF Origem</label>
              <input
                type="text"
                maxLength={2}
                required
                value={originState}
                onChange={(e) => onOriginStateChange(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Cidade Destino (Show)</label>
              <input
                type="text"
                required
                value={destCity}
                onChange={(e) => onDestCityChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">UF Destino</label>
              <input
                type="text"
                maxLength={2}
                required
                value={destState}
                onChange={(e) => onDestStateChange(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Placa Veículo</label>
              <input
                type="text"
                required
                value={plate}
                onChange={(e) => onPlateChange(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">UF Placa</label>
              <input
                type="text"
                maxLength={2}
                required
                value={plateState}
                onChange={(e) => onPlateStateChange(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">CPF Motorista</label>
              <input
                type="text"
                required
                value={driverCpf}
                onChange={(e) => onDriverCpfChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">CNH Motorista (MOPP)</label>
              <input
                type="text"
                required
                value={driverLicense}
                onChange={(e) => onDriverLicenseChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block text-slate-400 mb-1">Nome Completo do Condutor MOPP</label>
            <input
              type="text"
              required
              value={driverName}
              onChange={(e) => onDriverNameChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
            />
          </div>

          <div className="text-xs">
            <label className="block text-slate-400 mb-1">Itinerário Rodoviário Detalhado</label>
            <textarea
              required
              rows={2}
              value={route}
              onChange={(e) => onRouteChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
            />
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
              {submitting ? "Emitindo..." : "Autorizar Guia de Tráfego (GT)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
