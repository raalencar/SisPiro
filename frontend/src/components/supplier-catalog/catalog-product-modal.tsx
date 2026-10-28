"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CreateProductForm } from "@/components/inventory/create-product-form";
import {
  ApiError,
  inventoryApi,
  suggestedSku,
  type Product,
  type ProductType,
  type SupplierCatalogItem,
} from "@/lib/api";

const NON_PCE_CATEGORIES = new Set(["Máquinas", "Acessórios"]);

/** Itens de fogos começam como PCE; máquinas/acessórios não. O usuário pode alterar. */
export function defaultIsPce(categories: string[]): boolean {
  return !categories.some((name) => NON_PCE_CATEGORIES.has(name));
}

function conflictProductId(error: ApiError): string | null {
  const payload = error.payload;
  if (
    typeof payload === "object" &&
    payload !== null &&
    "productId" in payload &&
    typeof payload.productId === "string"
  ) {
    return payload.productId;
  }
  return null;
}

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

interface CatalogProductModalProps {
  item: SupplierCatalogItem;
  onClose: () => void;
  onCreated: (product: Product) => void;
  onConflict: (productId: string) => Promise<SupplierCatalogItem | null>;
}

export function CatalogProductModal({
  item,
  onClose,
  onCreated,
  onConflict,
}: CatalogProductModalProps) {
  const [productType, setProductType] = useState("MERCADORIA");
  const [isPce, setIsPce] = useState(() => defaultIsPce(item.categories));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ message: string; sku: string | null } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const description = text(form, "description");
    try {
      const product = await inventoryApi.createProduct({
        sku: text(form, "sku"),
        name: text(form, "name"),
        type: text(form, "type") as ProductType,
        isPce,
        ...(isPce
          ? { riskClass: text(form, "riskClass"), neqGrams: Number(form.get("neqGrams")) }
          : {}),
        unit: text(form, "unit"),
        ...(description ? { description } : {}),
        supplierCatalogItemId: item.id,
      });
      onCreated(product);
    } catch (requestError) {
      // 409 com `productId` = item já vinculado. Outros 409 (ex.: SKU duplicado)
      // mantêm o formulário aberto com os valores digitados e a mensagem da API.
      const productId =
        requestError instanceof ApiError && requestError.status === 409
          ? conflictProductId(requestError)
          : null;
      if (requestError instanceof ApiError && productId) {
        const fresh = await onConflict(productId);
        setConflict({ message: requestError.message, sku: fresh?.productSku ?? null });
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Não foi possível cadastrar o produto.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-product-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Cadastrar como produto</p>
            <h2 id="catalog-product-title" className="text-lg font-bold">
              {item.supplierCode ? `${item.supplierCode} · ` : ""}
              {item.name}
            </h2>
          </div>
          <button
            type="button"
            className="button button--quiet"
            disabled={submitting}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        {conflict ? (
          <div className="space-y-3" role="alert">
            <p className="form-error">{conflict.message}</p>
            <p className="text-sm">
              Este item já foi vinculado a um produto
              {conflict.sku ? ` (SKU ${conflict.sku})` : ""}. Nenhum novo produto foi criado.
            </p>
            <Link className="text-link" href="/modules/products">
              Ver em Produtos e lotes
            </Link>
            <div className="form-actions">
              <button type="button" className="button button--quiet" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <form className="form-stack inventory-form" onSubmit={handleSubmit}>
            <CreateProductForm
              productType={productType}
              isPce={isPce}
              onProductTypeChange={setProductType}
              onIsPceChange={setIsPce}
              defaults={{
                sku: suggestedSku(item.supplierCode),
                name: item.name,
                description: item.description ?? "",
              }}
              skuHint="Sugerido a partir do código do fornecedor; pode ser alterado."
              pceHint="Classe de risco e NEQ unitária devem ser copiadas da ficha técnica ou da NF do fornecedor — o catálogo não traz esses dados."
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="button button--quiet"
                disabled={submitting}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button className="button button--primary" type="submit" disabled={submitting}>
                {submitting ? "Salvando..." : "Cadastrar produto"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
