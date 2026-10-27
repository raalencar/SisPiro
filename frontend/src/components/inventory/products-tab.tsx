"use client";

import type { Product } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { EmptyTable, productTypeLabels } from "./types";

interface ProductsTabProps {
  products: Product[];
}

export function ProductsTab({ products }: ProductsTabProps) {
  if (products.length === 0) {
    return <EmptyTable message="Nenhum produto corresponde à busca." />;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU / produto</th>
            <th>Tipo</th>
            <th>PCE / classe</th>
            <th>NEQ unitária</th>
            <th>Unidade</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <strong>{product.name}</strong>
                <small>{product.sku}</small>
              </td>
              <td>{productTypeLabels[product.type] ?? product.type}</td>
              <td>
                {product.isPce ? `PCE · ${product.riskClass}` : "Não PCE"}
              </td>
              <td>
                {product.isPce
                  ? `${formatNumber(Number(product.neqGrams), 3)} g`
                  : "—"}
              </td>
              <td>{product.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
