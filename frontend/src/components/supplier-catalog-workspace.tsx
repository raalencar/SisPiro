"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { PaginationNav } from "@/components/inventory/components";
import { useToast } from "@/components/toast-provider";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  CatalogFilters,
  CatalogGrid,
  CatalogItemModal,
  CatalogProductModal,
  useSupplierCatalogState,
} from "./supplier-catalog";

function hasAnyRole(roles: readonly string[], wanted: string[]): boolean {
  return roles.includes("ADMIN") || wanted.some((role) => roles.includes(role));
}

export function SupplierCatalogWorkspace() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  // A API decide; a UI só esconde o que o perfil não pode executar.
  const canCreateProduct = hasAnyRole(roles, ["ESTOQUE"]);
  const canListSuppliers = hasAnyRole(roles, ["COMPRAS"]);
  const state = useSupplierCatalogState(canListSuppliers);
  const toast = useToast();
  const [creating, setCreating] = useState(false);

  const detailOpen = Boolean(state.selectedId) && !creating;
  const createOpen = creating && Boolean(state.detail);

  function closeAll() {
    setCreating(false);
    state.closeItem();
  }

  useEscapeToClose(detailOpen, closeAll);
  useModalFocusTrap(detailOpen);
  useEscapeToClose(createOpen, () => setCreating(false));
  useModalFocusTrap(createOpen);

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header">
        <p className="eyebrow">Compras e fornecedores</p>
        <h1 className="text-2xl font-bold">Catálogo de Fornecedores</h1>
        <p className="text-sm text-neutral-500">
          Itens importados dos catálogos dos fornecedores. O catálogo não contém dados PCE: classe
          de risco e NEQ são informadas no cadastro do produto, a partir da ficha técnica/NF.
        </p>
      </header>

      <CatalogFilters
        searchInput={state.searchInput}
        supplierId={state.supplierId}
        category={state.category}
        linked={state.linked}
        supplierOptions={state.supplierOptions}
        categories={state.categories}
        categoriesError={state.categoriesError}
        onSearchChange={state.setSearchInput}
        onSupplierChange={state.setSupplierId}
        onCategoryChange={state.setCategory}
        onLinkedChange={state.setLinked}
      />

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      {state.loading && !state.result ? (
        <p className="inventory-loading" role="status">
          Carregando catálogo...
        </p>
      ) : state.result ? (
        <div className="space-y-4" aria-busy={state.loading}>
          <CatalogGrid items={state.result.data} onOpen={state.openItem} />
          <PaginationNav result={state.result} onChange={state.setPage} />
        </div>
      ) : null}

      {detailOpen && (
        <CatalogItemModal
          item={state.detail}
          loading={state.detailLoading}
          error={state.detailError}
          canCreateProduct={canCreateProduct}
          onClose={closeAll}
          onCreateProduct={() => setCreating(true)}
        />
      )}

      {createOpen && state.detail && (
        <CatalogProductModal
          item={state.detail}
          onClose={() => setCreating(false)}
          onCreated={(product) => {
            state.markLinked(state.detail!.id, product.id, product.sku);
            setCreating(false);
            toast.success(`Produto ${product.sku} cadastrado e vinculado ao catálogo.`);
          }}
          onConflict={() => state.refreshItem(state.detail!.id)}
        />
      )}
    </div>
  );
}
