import { fileURLToPath } from 'node:url';

// src/common e dist/common ficam no mesmo nível: três diretórios acima está a raiz do monorepo.
export const DEFAULT_SUPPLIER_CATALOG_DIR = fileURLToPath(
  new URL('../../../data/fornecedores', import.meta.url),
);

export function supplierCatalogImageUrl(itemId: string, index: number) {
  return `/procurement/supplier-catalog/${itemId}/images/${index}`;
}
