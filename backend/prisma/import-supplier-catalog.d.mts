export declare const DEFAULT_SUPPLIER_CATALOG_DIR: string;

export interface MappedCatalogItem {
  externalId: string | null;
  supplierCode: string | null;
  name: string | null;
  description: string | null;
  effect: string | null;
  unitPackaging: string | null;
  masterPackaging: string | null;
  approxDuration: string | null;
  notes: string | null;
  extraAttributes: {
    maquina: string | null;
    quantidade_por_rolo: string | null;
    tags: string[];
  };
  categories: string[];
  sourceUrl: string | null;
  imagePaths: string[];
}

export interface ImportCounts {
  applied: boolean;
  supplierId: string;
  total: number;
  create: number;
  update: number;
  unchanged: number;
}

export declare function findSuspiciousContent(raw: unknown): string[];
export declare function safeSourceUrl(
  value: unknown,
  allowedHosts?: string[],
): string | null;
export declare function loadCatalogFile(file: string): unknown[];
export declare function mapCatalogItem(
  raw: Record<string, unknown>,
  options: { imagesPrefix: string; catalogDir: string; sourceHosts?: string[] },
): { data: MappedCatalogItem; errors: string[] };
export declare function importSupplierCatalog(
  prisma: unknown,
  options: {
    items: unknown[];
    supplierId: string;
    imagesPrefix: string;
    catalogDir?: string;
    sourceHosts?: string[];
    sourceFile?: string | null;
    apply?: boolean;
    log?: (message: string) => void;
  },
): Promise<ImportCounts>;
