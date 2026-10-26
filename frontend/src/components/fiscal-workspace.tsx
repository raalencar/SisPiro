"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  commercialApi,
  fiscalApi,
  operationsApi,
  type FiscalDocument,
  type FiscalDocumentStatus,
  type FiscalDocumentType,
  type PageResult,
  type Sale,
  type ServiceOrder,
} from "@/lib/api";
import { formatCurrency, formatDateOnly } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação fiscal.";
}

export function FiscalWorkspace() {
  const [documents, setDocuments] = useState<PageResult<FiscalDocument>>({
    data: [],
    meta: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Filtros
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Dados auxiliares para emissão
  const [sales, setSales] = useState<Sale[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  // Modal NF-e
  const [isNFeModalOpen, setIsNFeModalOpen] = useState(false);
  const [nfeSaleId, setNfeSaleId] = useState("");
  const [nfeNature, setNfeNature] = useState("Venda de mercadoria adquirida de terceiros");
  const [nfeNotes, setNfeNotes] = useState("");
  const [nfeSubmitting, setNfeSubmitting] = useState(false);
  const [nfeError, setNfeError] = useState<string | null>(null);

  // Modal NFC-e
  const [isNFCeModalOpen, setIsNFCeModalOpen] = useState(false);
  const [nfceSaleId, setNfceSaleId] = useState("");
  const [nfceSubmitting, setNfceSubmitting] = useState(false);
  const [nfceError, setNfceError] = useState<string | null>(null);

  // Modal NFS-e
  const [isNFSeModalOpen, setIsNFSeModalOpen] = useState(false);
  const [nfseOrderId, setNfseOrderId] = useState("");
  const [nfseDescription, setNfseDescription] = useState("");
  const [nfseSubmitting, setNfseSubmitting] = useState(false);
  const [nfseError, setNfseError] = useState<string | null>(null);

  // Modal Cancelamento
  const [cancelDoc, setCancelDoc] = useState<FiscalDocument | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Feedback de cópia da chave de acesso
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Acessibilidade: Escape e Focus Trap para os 4 modais
  useEscapeToClose(isNFeModalOpen, () => !nfeSubmitting && setIsNFeModalOpen(false));
  useModalFocusTrap(isNFeModalOpen);

  useEscapeToClose(isNFCeModalOpen, () => !nfceSubmitting && setIsNFCeModalOpen(false));
  useModalFocusTrap(isNFCeModalOpen);

  useEscapeToClose(isNFSeModalOpen, () => !nfseSubmitting && setIsNFSeModalOpen(false));
  useModalFocusTrap(isNFSeModalOpen);

  useEscapeToClose(Boolean(cancelDoc), () => !cancelSubmitting && setCancelDoc(null));
  useModalFocusTrap(Boolean(cancelDoc));

  // Carrega documentos fiscais
  useEffect(() => {
    let active = true;

    fiscalApi
      .getDocuments({
        page: 1,
        limit: 50,
        type: filterType || undefined,
        status: filterStatus || undefined,
        search: searchTerm || undefined,
      })
      .then((res) => {
        if (!active) return;
        setDocuments(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadTrigger, filterType, filterStatus, searchTerm]);

  // Carrega vendas e ordens de serviço para seleção nos modais de emissão
  useEffect(() => {
    commercialApi
      .getSales(1)
      .then((res) => setSales(res?.data || []))
      .catch(() => setSales([]));

    operationsApi
      .getOrders(1)
      .then((res) => setServiceOrders(res?.data || []))
      .catch(() => setServiceOrders([]));
  }, [reloadTrigger]);

  function copyAccessKey(key: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(key).then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2500);
      });
    }
  }

  async function handleEmitNFe(e: FormEvent) {
    e.preventDefault();
    if (!nfeSaleId) {
      setNfeError("Selecione a venda faturada.");
      return;
    }
    setNfeSubmitting(true);
    setNfeError(null);
    try {
      const doc = await fiscalApi.emitNFe({
        saleId: nfeSaleId,
        natureOfOperation: nfeNature,
        notes: nfeNotes || undefined,
      });
      setIsNFeModalOpen(false);
      setNfeSaleId("");
      setNfeNotes("");
      setActionSuccess(`NF-e nº ${doc.number} emitida e autorizada com sucesso pela SEFAZ!`);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNfeError(errorMessage(err));
    } finally {
      setNfeSubmitting(false);
    }
  }

  async function handleEmitNFCe(e: FormEvent) {
    e.preventDefault();
    if (!nfceSaleId) {
      setNfceError("Selecione a venda.");
      return;
    }
    setNfceSubmitting(true);
    setNfceError(null);
    try {
      const doc = await fiscalApi.emitNFCe({ saleId: nfceSaleId });
      setIsNFCeModalOpen(false);
      setNfceSaleId("");
      setActionSuccess(`NFC-e nº ${doc.number} emitida com sucesso!`);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNfceError(errorMessage(err));
    } finally {
      setNfceSubmitting(false);
    }
  }

  async function handleEmitNFSe(e: FormEvent) {
    e.preventDefault();
    if (!nfseOrderId) {
      setNfseError("Selecione a Ordem de Serviço.");
      return;
    }
    setNfseSubmitting(true);
    setNfseError(null);
    try {
      const doc = await fiscalApi.emitNFSe({
        serviceOrderId: nfseOrderId,
        serviceDescription: nfseDescription || undefined,
      });
      setIsNFSeModalOpen(false);
      setNfseOrderId("");
      setNfseDescription("");
      setActionSuccess(`NFS-e de Serviços Pirotécnicos nº ${doc.number} autorizada!`);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNfseError(errorMessage(err));
    } finally {
      setNfseSubmitting(false);
    }
  }

  async function handleCancelDocument(e: FormEvent) {
    e.preventDefault();
    if (!cancelDoc) return;
    if (cancelReason.trim().length < 15) {
      setCancelError("A justificativa de cancelamento deve ter no mínimo 15 caracteres.");
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await fiscalApi.cancelDocument(cancelDoc.id, { reason: cancelReason.trim() });
      const cancelledNumber = cancelDoc.number;
      setCancelDoc(null);
      setCancelReason("");
      setActionSuccess(`Documento fiscal nº ${cancelledNumber} cancelado com sucesso.`);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setCancelError(errorMessage(err));
    } finally {
      setCancelSubmitting(false);
    }
  }

  function renderStatusBadge(status: FiscalDocumentStatus) {
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

  function renderTypeBadge(type: FiscalDocumentType) {
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

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Gestão Fiscal & Tributária</span>
          <h1>Faturamento e Documentos Fiscais</h1>
          <p className="page-description">
            Emissão eletrônica de NF-e (Modelo 55 com produtos pirotécnicos e NCM), NFC-e para consumidor e NFS-e para espetáculos e queima de fogos, homologados perante a SEFAZ e Prefeitura.
          </p>
        </div>
        <div className="button-group">
          <button
            type="button"
            className="action-button primary"
            onClick={() => setIsNFeModalOpen(true)}
            id="btn-emit-nfe"
          >
            <Icon name="receipt" /> Emitir NF-e (Venda)
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setIsNFCeModalOpen(true)}
            id="btn-emit-nfce"
          >
            <Icon name="receipt" /> Emitir NFC-e (Balcão)
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setIsNFSeModalOpen(true)}
            id="btn-emit-nfse"
          >
            <Icon name="spark" /> Emitir NFS-e (Serviço)
          </button>
        </div>
      </header>

      {actionSuccess && (
        <div className="alert alert-success" role="status">
          <p>{actionSuccess}</p>
          <button
            type="button"
            className="alert-dismiss"
            onClick={() => setActionSuccess(null)}
            aria-label="Fechar mensagem de sucesso"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="card filter-bar-card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label htmlFor="search-fiscal-input" className="form-label" style={{ marginBottom: "0.25rem", display: "block" }}>
              Buscar por Chave, Protocolo ou Número
            </label>
            <input
              id="search-fiscal-input"
              type="search"
              className="form-input"
              placeholder="Digite a chave ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ width: "160px" }}>
            <label htmlFor="filter-type-select" className="form-label" style={{ marginBottom: "0.25rem", display: "block" }}>
              Tipo de Documento
            </label>
            <select
              id="filter-type-select"
              className="form-input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="NFE">NF-e (Mod. 55)</option>
              <option value="NFCE">NFC-e (Mod. 65)</option>
              <option value="NFSE">NFS-e (Serviços)</option>
            </select>
          </div>

          <div style={{ width: "160px" }}>
            <label htmlFor="filter-status-select" className="form-label" style={{ marginBottom: "0.25rem", display: "block" }}>
              Status SEFAZ
            </label>
            <select
              id="filter-status-select"
              className="form-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="AUTORIZADO">AUTORIZADO</option>
              <option value="PROCESSANDO">PROCESSANDO</option>
              <option value="CANCELADO">CANCELADO</option>
              <option value="REJEITADO">REJEITADO</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", height: "100%", paddingTop: "1.5rem" }}>
            <button
              type="button"
              className="action-button secondary"
              onClick={() => {
                setSearchTerm("");
                setFilterType("");
                setFilterStatus("");
                setReloadTrigger((v) => v + 1);
              }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal de Documentos Fiscais */}
      <div className="card">
        {loading ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <p>Carregando documentos fiscais...</p>
          </div>
        ) : documents.data.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <h3>Nenhum documento fiscal encontrado</h3>
            <p>Emita a primeira NF-e para suas vendas faturadas ou NFS-e para suas ordens de serviço concluídas.</p>
          </div>
        ) : (
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
                {documents.data.map((doc: FiscalDocument) => {
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
                        <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                          Série {doc.series}
                        </div>
                      </td>
                      <td>{renderTypeBadge(doc.type)}</td>
                      <td>
                        <div><strong>{recipientName}</strong></div>
                        <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                          {recipientTaxId}
                        </div>
                      </td>
                      <td>
                        {doc.sale && (
                          <span className="badge">Venda #{doc.sale.code}</span>
                        )}
                        {doc.serviceOrder && (
                          <span className="badge">OS #{doc.serviceOrder.code}</span>
                        )}
                        {!doc.sale && !doc.serviceOrder && "-"}
                      </td>
                      <td>
                        <strong>{formatCurrency(Number(doc.totalAmount))}</strong>
                      </td>
                      <td>
                        {doc.accessKey ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.8rem",
                                wordBreak: "break-all",
                              }}
                              title={doc.accessKey}
                            >
                              {doc.accessKey.slice(0, 16)}...{doc.accessKey.slice(-6)}
                            </span>
                            <button
                              type="button"
                              className="action-button-mini"
                              onClick={() => copyAccessKey(doc.accessKey!)}
                              title="Copiar chave de acesso"
                              style={{ cursor: "pointer", padding: "2px 6px", fontSize: "0.75rem" }}
                            >
                              {copiedKey === doc.accessKey ? "Copiado!" : "Copiar"}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: "var(--color-muted, #718096)" }}>-</span>
                        )}
                        {doc.protocol && (
                          <div style={{ fontSize: "0.75rem", color: "var(--color-muted, #718096)" }}>
                            Prot: {doc.protocol}
                          </div>
                        )}
                      </td>
                      <td>{renderStatusBadge(doc.status)}</td>
                      <td>
                        {doc.issuedAt ? formatDateOnly(doc.issuedAt) : formatDateOnly(doc.createdAt)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          {doc.danfeUrl && (
                            <a
                              href={doc.danfeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="action-button secondary"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                              title="Imprimir DANFE / Documento Auxiliar"
                            >
                              DANFE
                            </a>
                          )}
                          {doc.xmlUrl && (
                            <a
                              href={doc.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="action-button secondary"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                              title="Baixar arquivo XML assinado"
                            >
                              XML
                            </a>
                          )}
                          {doc.status === "AUTORIZADO" && (
                            <button
                              type="button"
                              className="action-button danger"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                              onClick={() => {
                                setCancelDoc(doc);
                                setCancelReason("");
                                setCancelError(null);
                              }}
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
        )}
      </div>

      {/* Modal Emissão NF-e */}
      {isNFeModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="nfe-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nfe-modal-title"
          >
            <div className="modal-header">
              <h2 id="nfe-modal-title">Emitir NF-e (Modelo 55 - Mercadorias)</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsNFeModalOpen(false)}
                aria-label="Fechar modal"
                disabled={nfeSubmitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEmitNFe}>
              <div className="modal-body">
                {nfeError && (
                  <div className="alert alert-danger" role="alert">
                    <p>{nfeError}</p>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="nfe-sale-select" className="form-label">
                    Venda a Faturar *
                  </label>
                  <select
                    id="nfe-sale-select"
                    className="form-input"
                    value={nfeSaleId}
                    onChange={(e) => setNfeSaleId(e.target.value)}
                    required
                  >
                    <option value="">Selecione uma venda...</option>
                    {sales.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        Venda {sale.id.slice(0, 8)} - {sale.customer?.legalName || "Cliente não cadastrado"} - {formatCurrency(Number(sale.total))}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="nfe-nature-input" className="form-label">
                    Natureza da Operação *
                  </label>
                  <input
                    id="nfe-nature-input"
                    type="text"
                    className="form-input"
                    value={nfeNature}
                    onChange={(e) => setNfeNature(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nfe-notes-input" className="form-label">
                    Informações Complementares de Interesse do Contribuinte
                  </label>
                  <textarea
                    id="nfe-notes-input"
                    className="form-input"
                    rows={3}
                    placeholder="Ex: Produtos controlados pelo Exército Brasileiro. Venda sujeita à apresentação de CR."
                    value={nfeNotes}
                    onChange={(e) => setNfeNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => setIsNFeModalOpen(false)}
                  disabled={nfeSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="action-button primary"
                  disabled={nfeSubmitting}
                >
                  {nfeSubmitting ? "Autorizando na SEFAZ..." : "Autorizar NF-e"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Emissão NFC-e */}
      {isNFCeModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="nfce-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nfce-modal-title"
          >
            <div className="modal-header">
              <h2 id="nfce-modal-title">Emitir NFC-e (Modelo 65 - Venda Balcão)</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsNFCeModalOpen(false)}
                aria-label="Fechar modal"
                disabled={nfceSubmitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEmitNFCe}>
              <div className="modal-body">
                {nfceError && (
                  <div className="alert alert-danger" role="alert">
                    <p>{nfceError}</p>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="nfce-sale-select" className="form-label">
                    Venda de Balcão *
                  </label>
                  <select
                    id="nfce-sale-select"
                    className="form-input"
                    value={nfceSaleId}
                    onChange={(e) => setNfceSaleId(e.target.value)}
                    required
                  >
                    <option value="">Selecione uma venda...</option>
                    {sales.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        Venda {sale.id.slice(0, 8)} - {formatCurrency(Number(sale.total))}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => setIsNFCeModalOpen(false)}
                  disabled={nfceSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="action-button primary"
                  disabled={nfceSubmitting}
                >
                  {nfceSubmitting ? "Emitindo cupom fiscal..." : "Emitir NFC-e"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Emissão NFS-e */}
      {isNFSeModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="nfse-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nfse-modal-title"
          >
            <div className="modal-header">
              <h2 id="nfse-modal-title">Emitir NFS-e (Serviços Pirotécnicos)</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsNFSeModalOpen(false)}
                aria-label="Fechar modal"
                disabled={nfseSubmitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEmitNFSe}>
              <div className="modal-body">
                {nfseError && (
                  <div className="alert alert-danger" role="alert">
                    <p>{nfseError}</p>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="nfse-order-select" className="form-label">
                    Ordem de Serviço (OS) *
                  </label>
                  <select
                    id="nfse-order-select"
                    className="form-input"
                    value={nfseOrderId}
                    onChange={(e) => setNfseOrderId(e.target.value)}
                    required
                  >
                    <option value="">Selecione uma ordem de serviço...</option>
                    {serviceOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        OS #{order.code} - {order.customer?.legalName || "Cliente"} - {order.eventLocation} ({formatCurrency(Number(order.contractedAmount || 0))})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="nfse-desc-input" className="form-label">
                    Discriminação dos Serviços Prestados
                  </label>
                  <textarea
                    id="nfse-desc-input"
                    className="form-input"
                    rows={3}
                    placeholder="Deixe em branco para preenchimento automático com dados da OS, ART e Blaster responsável."
                    value={nfseDescription}
                    onChange={(e) => setNfseDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => setIsNFSeModalOpen(false)}
                  disabled={nfseSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="action-button primary"
                  disabled={nfseSubmitting}
                >
                  {nfseSubmitting ? "Emitindo nota na Prefeitura..." : "Emitir NFS-e"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cancelamento com Justificativa */}
      {cancelDoc && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div className="modal-header">
              <h2 id="cancel-modal-title">Cancelar Documento Fiscal #{cancelDoc.number}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCancelDoc(null)}
                aria-label="Fechar modal"
                disabled={cancelSubmitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCancelDocument}>
              <div className="modal-body">
                {cancelError && (
                  <div className="alert alert-danger" role="alert">
                    <p>{cancelError}</p>
                  </div>
                )}
                <p style={{ marginBottom: "1rem" }}>
                  Atenção: O cancelamento será transmitido diretamente à SEFAZ/Prefeitura e é irreversível. A legislação exige justificativa legal com no mínimo 15 caracteres.
                </p>
                <div className="form-group">
                  <label htmlFor="cancel-reason-input" className="form-label">
                    Justificativa do Cancelamento * (Mínimo 15 caracteres)
                  </label>
                  <textarea
                    id="cancel-reason-input"
                    className="form-input"
                    rows={3}
                    placeholder="Ex: Venda cancelada por desacordo comercial antes da circulação da mercadoria."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)", marginTop: "0.25rem" }}>
                    Caracteres digitados: {cancelReason.length}/15 mínimo
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => setCancelDoc(null)}
                  disabled={cancelSubmitting}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="action-button danger"
                  disabled={cancelSubmitting || cancelReason.trim().length < 15}
                >
                  {cancelSubmitting ? "Cancelando na SEFAZ..." : "Confirmar Cancelamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
