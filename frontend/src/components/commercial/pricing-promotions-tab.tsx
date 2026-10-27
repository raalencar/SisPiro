"use client";

import type { PageResult, PricingList, ProductPromotion } from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

interface PricingPromotionsTabProps {
  pricingLists: PricingList[];
  promotions: PageResult<ProductPromotion> | null;
  onOpenPricingModal: () => void;
  onOpenPromoModal: () => void;
  onTogglePromotion: (promoId: string, currentActive: boolean) => void;
}

export function PricingPromotionsTab({
  pricingLists,
  promotions,
  onOpenPricingModal,
  onOpenPromoModal,
  onTogglePromotion,
}: PricingPromotionsTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Tabelas de Preço */}
      <div className="panel space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Tabelas de Preço</h2>
          <button className="button button--secondary text-xs" onClick={onOpenPricingModal}>
            + Nova Tabela
          </button>
        </div>
        <div className="space-y-2">
          {pricingLists.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500 bg-neutral-50 rounded border border-neutral-200">
              Nenhuma tabela cadastrada.
            </div>
          ) : (
            pricingLists.map((pl) => (
              <div
                key={pl.id}
                className="p-3.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg shadow-sm transition-all"
              >
                <div className="font-semibold text-neutral-900">{pl.name}</div>
                <div className="text-xs text-neutral-500 mt-0.5">Criada em: {formatDateOnly(pl.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Promoções */}
      <div className="panel space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-neutral-900">Campanhas Promocionais</h2>
          <button className="button button--secondary text-xs" onClick={onOpenPromoModal}>
            + Nova Promoção
          </button>
        </div>
        <div className="space-y-2">
          {!promotions || promotions.data.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500 bg-neutral-50 rounded border border-neutral-200">
              Nenhuma campanha cadastrada.
            </div>
          ) : (
            promotions.data.map((pr) => (
              <div
                key={pr.id}
                className="p-3.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg shadow-sm space-y-2 transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-neutral-900">{pr.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`status-pill ${
                        pr.active ? "status-pill--available" : "status-pill--neutral"
                      }`}
                    >
                      {pr.active ? "Ativa" : "Inativa"}
                    </span>
                    <button
                      type="button"
                      className="button button--secondary text-xs py-1 px-2.5 text-neutral-700 hover:bg-neutral-100 font-medium border-neutral-300"
                      onClick={() => onTogglePromotion(pr.id, pr.active)}
                    >
                      {pr.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  Vigência: <strong className="text-neutral-700">{formatDateOnly(pr.effectiveFrom)}</strong> até{" "}
                  <strong className="text-neutral-700">{formatDateOnly(pr.effectiveUntil)}</strong>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
