"use client";

import Link from "next/link";
import { useState } from "react";
import type { SupplierCatalogItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { CatalogImage } from "./catalog-image";
import { LinkedBadge } from "./catalog-grid";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-neutral-500">{label}</dt>
      <dd className="text-sm">{value || "—"}</dd>
    </div>
  );
}

/** Texto livre vindo do fornecedor: renderizado como texto, nunca como HTML. */
function PlainText({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <section>
      <h3 className="text-xs font-semibold text-neutral-500">{label}</h3>
      <p className="whitespace-pre-line text-sm">{value}</p>
    </section>
  );
}

function Gallery({ item }: { item: SupplierCatalogItem }) {
  const [active, setActive] = useState(0);
  if (item.images.length === 0) {
    return <CatalogImage url={null} alt={item.name} className="h-56 w-full rounded-md" />;
  }
  const current = item.images[Math.min(active, item.images.length - 1)];
  return (
    <div className="space-y-2">
      <CatalogImage
        key={current.url}
        url={current.url}
        alt={`${item.name} — imagem ${current.index + 1}`}
        className="h-64 w-full rounded-md"
      />
      {item.images.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Imagens do item">
          {item.images.map((image, position) => (
            <button
              key={image.index}
              type="button"
              className={`rounded-md border-2 ${position === active ? "border-teal-700" : "border-transparent"}`}
              aria-label={`Mostrar imagem ${image.index + 1}`}
              aria-pressed={position === active}
              onClick={() => setActive(position)}
            >
              <CatalogImage url={image.url} alt="" className="h-14 w-14 rounded" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CatalogItemModalProps {
  item: SupplierCatalogItem | null;
  loading: boolean;
  error: string | null;
  canCreateProduct: boolean;
  onClose: () => void;
  onCreateProduct: () => void;
}

export function CatalogItemModal({
  item,
  loading,
  error,
  canCreateProduct,
  onClose,
  onCreateProduct,
}: CatalogItemModalProps) {
  const extra = item?.extraAttributes;
  const tags = extra?.tags?.filter(Boolean) ?? [];

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-content space-y-4"
        style={{ maxWidth: 860 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-item-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Catálogo de fornecedores</p>
            <h2 id="catalog-item-title" className="text-lg font-bold">
              {item?.name ?? "Item do catálogo"}
            </h2>
          </div>
          <button type="button" className="button button--quiet" onClick={onClose}>
            Fechar
          </button>
        </div>

        {loading && !item && <p className="inventory-loading">Carregando item...</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {item && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Gallery item={item} />
              <dl className="grid grid-cols-2 content-start gap-3">
                <Field label="Fornecedor" value={item.supplierName} />
                <Field label="Código do fornecedor" value={item.supplierCode} />
                <Field label="ID externo" value={item.externalId} />
                <Field label="Efeito" value={item.effect} />
                <Field label="Embalagem unitária" value={item.unitPackaging} />
                <Field label="Embalagem master" value={item.masterPackaging} />
                <Field label="Duração aproximada" value={item.approxDuration} />
                <Field label="Máquina" value={extra?.maquina ?? null} />
                <Field
                  label="Quantidade por rolo"
                  value={
                    extra?.quantidade_por_rolo === null || extra?.quantidade_por_rolo === undefined
                      ? null
                      : String(extra.quantidade_por_rolo)
                  }
                />
                <Field label="Categorias" value={item.categories.join(", ")} />
                <Field label="Tags" value={tags.join(", ")} />
                <Field label="Importado em" value={formatDateTime(item.importedAt)} />
                <Field label="Atualizado em" value={formatDateTime(item.updatedAt)} />
              </dl>
            </div>

            <PlainText label="Descrição" value={item.description} />
            <PlainText label="Observações" value={item.notes} />

            {item.sourceUrl && (
              <section className="inventory-alert inventory-alert--error" role="note">
                <p className="text-xs font-semibold">
                  Site de origem comprometido — não acessar.
                </p>
                <p className="break-all font-mono text-xs select-all">{item.sourceUrl}</p>
              </section>
            )}

            <div className="modal-footer">
              {item.productId ? (
                <>
                  <LinkedBadge sku={item.productSku} />
                  <Link className="text-link" href="/modules/products">
                    Ver em Produtos e lotes
                  </Link>
                </>
              ) : canCreateProduct ? (
                <button type="button" className="button button--primary" onClick={onCreateProduct}>
                  Cadastrar como produto
                </button>
              ) : (
                <p className="form-hint">
                  Cadastrar o item como produto exige o perfil ESTOQUE.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
