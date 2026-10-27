"use client";

import type { OperationalLot, Product } from "@/lib/api";
import type { GtDraftItem } from "./create-gt-modal";

interface GtItemsSectionProps {
  products: Product[];
  lots: OperationalLot[];
  items: GtDraftItem[];
  estimatedNeqKg: number;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onItemChange: (
    index: number,
    field: keyof GtDraftItem,
    value: string | number,
  ) => void;
}

export function GtItemsSection({
  products,
  lots,
  items,
  estimatedNeqKg,
  onAddItem,
  onRemoveItem,
  onItemChange,
}: GtItemsSectionProps) {
  return (
    <div
      style={{
        marginTop: "1rem",
        borderTop: "1px solid var(--border-color, #e2e8f0)",
        paddingTop: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>
          Produtos Controlados a Transportar
        </h3>
        <button
          type="button"
          className="action-button secondary"
          onClick={onAddItem}
        >
          + Adicionar Produto
        </button>
      </div>

      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "3fr 3fr 1fr auto",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <select
            className="form-input"
            value={item.productId}
            onChange={(e) => onItemChange(idx, "productId", e.target.value)}
            required
            aria-label={`Produto item ${idx + 1}`}
          >
            <option value="">Selecione o produto PCE...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.neqGrams}g NEQ)
              </option>
            ))}
          </select>

          <select
            className="form-input"
            value={item.productLotId}
            onChange={(e) => onItemChange(idx, "productLotId", e.target.value)}
            required
            aria-label={`Lote item ${idx + 1}`}
          >
            <option value="">Selecione o lote do paiol...</option>
            {lots
              .filter(
                (l) => !item.productId || l.productId === item.productId,
              )
              .map((l) => (
                <option key={l.id} value={l.id}>
                  Lote {l.lotNumber} (Saldo: {l.quantity})
                </option>
              ))}
          </select>

          <input
            type="number"
            min="1"
            className="form-input"
            value={item.quantity}
            onChange={(e) =>
              onItemChange(idx, "quantity", Number(e.target.value))
            }
            required
            aria-label={`Quantidade item ${idx + 1}`}
          />

          {items.length > 1 && (
            <button
              type="button"
              className="action-button danger"
              onClick={() => onRemoveItem(idx)}
              style={{ padding: "0.4rem 0.6rem" }}
              aria-label={`Remover item ${idx + 1}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      <div
        style={{
          marginTop: "0.5rem",
          textAlign: "right",
          fontWeight: "bold",
        }}
      >
        Carga Explosiva Estimada:{" "}
        <span style={{ color: "var(--color-primary, #2b6cb0)" }}>
          {estimatedNeqKg.toFixed(4)} kg NEQ
        </span>
      </div>
    </div>
  );
}
