"use client";

import type { Product } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { CatalogImage } from "@/components/supplier-catalog/catalog-image";
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
                <div className="flex items-center gap-3">
                  <CatalogImage
                    url={product.imageUrl}
                    alt={product.name}
                    placeholder={false}
                    className="h-10 w-10 shrink-0 rounded"
                  />
                  <div>
                    <strong>{product.name}</strong>
                    <small>{product.sku}</small>
                  </div>
                </div>
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
