"use client";

import type { FiscalDocument } from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { renderStatusBadge, renderTypeBadge } from "./types";

interface FiscalTableProps {
  documents: FiscalDocument[];
  loading: boolean;
  copiedKey: string | null;
  onCopyKey: (key: string) => void;
  onViewDanfe: (doc: FiscalDocument) => void;
  onOpenCancelModal: (doc: FiscalDocument) => void;
}

export function FiscalTable({
  documents,
  loading,
  copiedKey,
  onCopyKey,
  onViewDanfe,
  onOpenCancelModal,
}: FiscalTableProps) {
  if (loading) {
    return (
      <div className="empty-state" style={{ padding: "3rem" }}>
        <p>Carregando documentos fiscais...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "3rem" }}>
        <h3>Nenhum documento fiscal encontrado</h3>
        <p>
          Emita a primeira NF-e para suas vendas faturadas ou NFS-e para suas
          ordens de serviço concluídas.
        </p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nº / Série</th>
            <th>Tipo</th>
            <th>Destinatário / Tomador</th>
            <th>Origem</th>
            <th>Valor Total</th>
            <th>Chave de Acesso / Protocolo</th>
            <th>Status</th>
            <th>Emissão</th>
            <th style={{ textAlign: "right" }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc: FiscalDocument) => {
            const recipientName =
              doc.sale?.customer?.legalName ||
              doc.serviceOrder?.customer?.legalName ||
              "Consumidor Final";
            const recipientTaxId =
              doc.sale?.customer?.taxId ||
              doc.serviceOrder?.customer?.taxId ||
              "-";

            return (
              <tr key={doc.id}>
                <td>
                  <strong>{doc.number}</strong>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-muted, #718096)",
                    }}
                  >
                    Série {doc.series}
                  </div>
                </td>
                <td>{renderTypeBadge(doc.type)}</td>
                <td>
                  <div>
                    <strong>{recipientName}</strong>
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-muted, #718096)",
                    }}
                  >
                    {recipientTaxId}
                  </div>
                </td>
                <td>
                  {doc.sale && (
                    <span className="badge">Venda #{doc.sale.code}</span>
                  )}
                  {doc.serviceOrder && (
                    <span className="badge">
                      OS #{doc.serviceOrder.code}
                    </span>
                  )}
                  {!doc.sale && !doc.serviceOrder && "-"}
                </td>
                <td>
                  <strong>{formatCurrency(Number(doc.totalAmount))}</strong>
                </td>
                <td>
                  {doc.accessKey ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          wordBreak: "break-all",
                        }}
                        title={doc.accessKey}
                      >
                        {doc.accessKey.slice(0, 16)}...
                        {doc.accessKey.slice(-6)}
                      </span>
                      <button
                        type="button"
                        className="action-button-mini"
                        onClick={() => onCopyKey(doc.accessKey!)}
                        title="Copiar chave de acesso"
                        style={{
                          cursor: "pointer",
                          padding: "2px 6px",
                          fontSize: "0.75rem",
                        }}
                      >
                        {copiedKey === doc.accessKey ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "var(--color-muted, #718096)" }}>
                      -
                    </span>
                  )}
                  {doc.protocol && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--color-muted, #718096)",
                      }}
                    >
                      Prot: {doc.protocol}
                    </div>
                  )}
                </td>
                <td>{renderStatusBadge(doc.status)}</td>
                <td>
                  {doc.issuedAt
                    ? formatDateOnly(doc.issuedAt)
                    : formatDateOnly(doc.createdAt)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      gap: "0.5rem",
                      justifyContent: "flex-end",
                    }}
                  >
                    {doc.status === "AUTORIZADO" && (
                      <button
                        type="button"
                        className="action-button secondary"
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => onViewDanfe(doc)}
                        title="Visualizar e Imprimir Espelho da DANFE"
                      >
                        DANFE
                      </button>
                    )}
                    {doc.xmlUrl && (
                      <a
                        href={doc.xmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="action-button secondary"
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.8rem",
                        }}
                        title="Baixar arquivo XML assinado"
                      >
                        XML
                      </a>
                    )}
                    {doc.status === "AUTORIZADO" && (
                      <button
                        type="button"
                        className="action-button danger"
                        style={{
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => onOpenCancelModal(doc)}
                        title="Cancelar documento fiscal na SEFAZ"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
