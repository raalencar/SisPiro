"use client";

import type {
  SupplierCatalogItemSummary,
  SupplierCatalogLinkedFilter,
} from "@/lib/api";
import { CatalogImage } from "./catalog-image";
import type { SupplierOption } from "./use-supplier-catalog-state";

export function LinkedBadge({ sku }: { sku: string | null }) {
  return (
    <span className="status-pill status-pill--available">
      Cadastrado{sku ? ` (SKU ${sku})` : ""}
    </span>
  );
}

interface CatalogFiltersProps {
  searchInput: string;
  supplierId: string;
  category: string;
  linked: SupplierCatalogLinkedFilter;
  supplierOptions: SupplierOption[];
  categories: string[];
  categoriesError: string | null;
  onSearchChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onLinkedChange: (value: SupplierCatalogLinkedFilter) => void;
}

export function CatalogFilters({
  searchInput,
  supplierId,
  category,
  linked,
  supplierOptions,
  categories,
  categoriesError,
  onSearchChange,
  onSupplierChange,
  onCategoryChange,
  onLinkedChange,
}: CatalogFiltersProps) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="field">
          <span>Buscar</span>
          <input
            type="search"
            maxLength={100}
            placeholder="Nome, código ou efeito"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Fornecedor</span>
          <select value={supplierId} onChange={(event) => onSupplierChange(event.target.value)}>
            <option value="">Todos</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Categoria</span>
          <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">Todas</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Situação</span>
          <select
            value={linked}
            onChange={(event) =>
              onLinkedChange(event.target.value as SupplierCatalogLinkedFilter)
            }
          >
            <option value="">Todos</option>
            <option value="false">Não cadastrados</option>
            <option value="true">Cadastrados</option>
          </select>
        </label>
      </div>
      {categoriesError && (
        <p className="form-error" role="alert">
          {categoriesError}
        </p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs text-neutral-600">
      <span className="font-semibold">{label}:</span> {value}
    </p>
  );
}

interface CatalogGridProps {
  items: SupplierCatalogItemSummary[];
  onOpen: (id: string) => void;
}

export function CatalogGrid({ items, onOpen }: CatalogGridProps) {
  if (items.length === 0) {
    return <p className="table-empty">Nenhum item do catálogo corresponde aos filtros.</p>;
  }
  return (
    <ul className="catalog-grid" aria-label="Itens do catálogo">
      {items.map((item) => (
        <li key={item.id} className="panel flex flex-col gap-2 p-3">
          <CatalogImage
            url={item.thumbnailUrl}
            alt={item.name}
            className="h-40 w-full rounded-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            {item.supplierCode && (
              <span className="font-mono text-xs text-neutral-500">{item.supplierCode}</span>
            )}
            {item.productId && <LinkedBadge sku={item.productSku} />}
          </div>
          <h3 className="text-sm font-semibold leading-snug">{item.name}</h3>
          <Detail label="Efeito" value={item.effect} />
          <Detail label="Emb. unitária" value={item.unitPackaging} />
          <Detail label="Emb. master" value={item.masterPackaging} />
          {item.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.categories.map((name) => (
                <span key={name} className="status-pill status-pill--neutral">
                  {name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-auto pt-1">
            <button
              type="button"
              className="button button--quiet w-full"
              onClick={() => onOpen(item.id)}
              aria-label={`Ver detalhes de ${item.name}`}
            >
              Ver detalhes
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
