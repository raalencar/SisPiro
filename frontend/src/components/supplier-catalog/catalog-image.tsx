"use client";

import { useState } from "react";
import { catalogImageSrc } from "@/lib/api";

interface CatalogImageProps {
  /** URL relativa da API (sem `/api/v1`). */
  url: string | null | undefined;
  alt: string;
  className?: string;
  /** Sem imagem ou erro de carga: mostra o placeholder (true) ou nada (false). */
  placeholder?: boolean;
}

/**
 * Imagem autenticada servida pelo BFF. Falhas (403 para perfis sem acesso ao
 * catálogo, 404, rede) caem silenciosamente no placeholder.
 */
export function CatalogImage({
  url,
  alt,
  className = "",
  placeholder = true,
}: CatalogImageProps) {
  const src = catalogImageSrc(url);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src !== null && failedSrc === src;

  if (!src || failed) {
    if (!placeholder) return null;
    return (
      <div
        className={`catalog-thumb ${className}`}
        role="img"
        aria-label={`${alt}: sem imagem`}
      >
        <span className="text-xs">Sem imagem</span>
      </div>
    );
  }

  return (
    <div className={`catalog-thumb ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
