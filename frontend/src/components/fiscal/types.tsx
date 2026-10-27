import type { FiscalDocumentStatus, FiscalDocumentType } from "@/lib/api";

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação fiscal.";
}

export function renderStatusBadge(status: FiscalDocumentStatus) {
  switch (status) {
    case "AUTORIZADO":
      return <span className="status-badge status-badge-success">AUTORIZADO</span>;
    case "PROCESSANDO":
      return <span className="status-badge status-badge-warning">PROCESSANDO</span>;
    case "CANCELADO":
      return <span className="status-badge status-badge-danger">CANCELADO</span>;
    case "REJEITADO":
      return <span className="status-badge status-badge-danger">REJEITADO</span>;
    default:
      return <span className="status-badge">{status}</span>;
  }
}

export function renderTypeBadge(type: FiscalDocumentType) {
  switch (type) {
    case "NFE":
      return <span className="status-badge status-badge-info">NF-e (55)</span>;
    case "NFCE":
      return <span className="status-badge status-badge-warning">NFC-e (65)</span>;
    case "NFSE":
      return <span className="status-badge status-badge-neutral">NFS-e</span>;
    default:
      return <span className="status-badge">{type}</span>;
  }
}
