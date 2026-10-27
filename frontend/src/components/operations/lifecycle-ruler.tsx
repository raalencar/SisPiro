"use client";

import type { ServiceOrder } from "@/lib/api";
import { getOrderSteps } from "./types";

interface LifecycleRulerProps {
  order: ServiceOrder;
}

export function OrderStepper({ order }: LifecycleRulerProps) {
  if (order.status === "CANCELADO") {
    return (
      <div className="p-3 my-4 bg-rose-950/30 border border-rose-800/60 rounded text-rose-300 text-xs flex items-center gap-2">
        <span className="font-bold">⚠️ Ordem de Serviço Cancelada:</span>
        <span>As reservas de estoque foram estornadas e o processo foi interrompido.</span>
      </div>
    );
  }

  const steps = getOrderSteps(order);

  return (
    <nav aria-label="Progresso da ordem de serviço" className="my-5 p-4 bg-white border border-neutral-200 shadow-sm rounded-lg">
      <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
        {steps.map((st, idx) => {
          const isCompleted = st.state === "completed";
          const isCurrent = st.state === "current";

          return (
            <li key={st.number} className="flex flex-col items-center sm:items-start text-center sm:text-left gap-1.5 relative">
              <div className="flex items-center gap-2 w-full">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isCompleted
                      ? "bg-emerald-600 text-white shadow-sm"
                      : isCurrent
                        ? "bg-teal-700 text-white ring-2 ring-teal-400 ring-offset-2 ring-offset-white"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-300"
                  }`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? "✓" : st.number}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`hidden sm:block h-0.5 flex-1 ${
                      isCompleted ? "bg-emerald-500" : "bg-neutral-200"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div>
                <span
                  className={`text-xs font-semibold block ${
                    isCurrent
                      ? "text-teal-900 font-bold"
                      : isCompleted
                        ? "text-neutral-900"
                        : "text-neutral-500"
                  }`}
                >
                  {st.label}
                </span>
                <span className="text-[11px] text-neutral-500 block truncate max-w-[130px]">
                  {st.sublabel}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
