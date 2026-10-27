"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  commercialApi,
  fiscalApi,
  operationsApi,
  type FiscalDocument,
  type PageResult,
  type Sale,
  type ServiceOrder,
} from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import { useToast } from "@/components/toast-provider";
import {
  FiscalTable,
  EmitNfeModal,
  EmitNfceModal,
  EmitNfseModal,
  CancelFiscalModal,
  DanfeViewModal,
} from "./fiscal";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação fiscal.";
}

export function FiscalWorkspace() {
  const toast = useToast();
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
  const [nfeNature, setNfeNature] = useState(
    "Venda de mercadoria adquirida de terceiros",
  );
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

  // Modal Visualização DANFE
  const [viewDanfeDoc, setViewDanfeDoc] = useState<FiscalDocument | null>(null);

  // Cópia de chave
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEscapeToClose(isNFeModalOpen, () => !nfeSubmitting && setIsNFeModalOpen(false));
  useModalFocusTrap(isNFeModalOpen);

  useEscapeToClose(isNFCeModalOpen, () => !nfceSubmitting && setIsNFCeModalOpen(false));
  useModalFocusTrap(isNFCeModalOpen);

  useEscapeToClose(isNFSeModalOpen, () => !nfseSubmitting && setIsNFSeModalOpen(false));
  useModalFocusTrap(isNFSeModalOpen);

  useEscapeToClose(Boolean(cancelDoc), () => !cancelSubmitting && setCancelDoc(null));
  useModalFocusTrap(Boolean(cancelDoc));

  useEscapeToClose(Boolean(viewDanfeDoc), () => setViewDanfeDoc(null));
  useModalFocusTrap(Boolean(viewDanfeDoc));

  useEffect(() => {
    let current = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [docsRes, salesRes, osRes] = await Promise.all([
          fiscalApi.getDocuments({
            page: 1,
            limit: 50,
            type: filterType || undefined,
            status: filterStatus || undefined,
            search: searchTerm ? searchTerm.trim() : undefined,
          }),
          commercialApi.getSales(1),
          operationsApi.getOrders(1),
        ]);

        if (current) {
          setDocuments(docsRes);
          setSales(salesRes.data);
          // Filtrar ordens concluídas para emissão de NFS-e
          setServiceOrders(
            osRes.data.filter((o: ServiceOrder) => o.status === "CONCLUIDO"),
          );
        }
      } catch (err) {
        if (current) {
          setError(errorMessage(err));
        }
      } finally {
        if (current) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      current = false;
    };
  }, [filterType, filterStatus, searchTerm, reloadTrigger]);

  function copyAccessKey(key: string) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(key);
      setCopiedKey(key);
      toast.info("Chave de acesso copiada para a área de transferência.");
      setTimeout(() => setCopiedKey(null), 3000);
    }
  }

  async function handleEmitNFe(e: FormEvent<HTMLFormElement>) {
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
      const nfeMsg = `NF-e nº ${doc.number} emitida e autorizada com sucesso pela SEFAZ!`;
      setActionSuccess(nfeMsg);
      toast.success(nfeMsg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNfeError(errorMessage(err));
    } finally {
      setNfeSubmitting(false);
    }
  }

  async function handleEmitNFCe(e: FormEvent<HTMLFormElement>) {
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
      const nfceMsg = `NFC-e nº ${doc.number} emitida com sucesso!`;
      setActionSuccess(nfceMsg);
      toast.success(nfceMsg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNfceError(errorMessage(err));
    } finally {
      setNfceSubmitting(false);
    }
  }

  async function handleEmitNFSe(e: FormEvent<HTMLFormElement>) {
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
      const nfseMsg = `NFS-e de Serviços Pirotécnicos nº ${doc.number} autorizada!`;
      setActionSuccess(nfseMsg);
      toast.success(nfseMsg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setNfseError(errorMessage(err));
    } finally {
      setNfseSubmitting(false);
    }
  }

  async function handleCancelDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cancelDoc) return;
    if (cancelReason.trim().length < 15) {
      setCancelError(
        "A justificativa de cancelamento deve ter no mínimo 15 caracteres.",
      );
      return;
    }
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await fiscalApi.cancelDocument(cancelDoc.id, {
        reason: cancelReason.trim(),
      });
      const cancelledNumber = cancelDoc.number;
      setCancelDoc(null);
      setCancelReason("");
      const cancelMsg = `Documento fiscal nº ${cancelledNumber} cancelado com sucesso.`;
      setActionSuccess(cancelMsg);
      toast.success(cancelMsg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setCancelError(errorMessage(err));
    } finally {
      setCancelSubmitting(false);
    }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Gestão Fiscal & Tributária</span>
          <h1>Faturamento e Documentos Fiscais</h1>
          <p className="page-description">
            Emissão eletrônica de NF-e (Modelo 55 com produtos pirotécnicos e
            NCM), NFC-e para consumidor e NFS-e para espetáculos e queima de
            fogos, homologados perante a SEFAZ e Prefeitura.
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
      <div
        className="card filter-bar-card"
        style={{ marginBottom: "1.5rem", padding: "1rem" }}
      >
        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ flex: "1 1 240px" }}>
            <label
              htmlFor="search-fiscal-input"
              className="form-label"
              style={{ marginBottom: "0.25rem", display: "block" }}
            >
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
            <label
              htmlFor="filter-type-select"
              className="form-label"
              style={{ marginBottom: "0.25rem", display: "block" }}
            >
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
            <label
              htmlFor="filter-status-select"
              className="form-label"
              style={{ marginBottom: "0.25rem", display: "block" }}
            >
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

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              height: "100%",
              paddingTop: "1.5rem",
            }}
          >
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
        <FiscalTable
          documents={documents.data}
          loading={loading}
          copiedKey={copiedKey}
          onCopyKey={copyAccessKey}
          onViewDanfe={(doc) => setViewDanfeDoc(doc)}
          onOpenCancelModal={(doc) => {
            setCancelDoc(doc);
            setCancelReason("");
            setCancelError(null);
          }}
        />
      </div>

      {/* Modais Fiscais */}
      <EmitNfeModal
        isOpen={isNFeModalOpen}
        sales={sales}
        saleId={nfeSaleId}
        nature={nfeNature}
        notes={nfeNotes}
        submitting={nfeSubmitting}
        error={nfeError}
        onSaleIdChange={setNfeSaleId}
        onNatureChange={setNfeNature}
        onNotesChange={setNfeNotes}
        onClose={() => setIsNFeModalOpen(false)}
        onSubmit={handleEmitNFe}
      />

      <EmitNfceModal
        isOpen={isNFCeModalOpen}
        sales={sales}
        saleId={nfceSaleId}
        submitting={nfceSubmitting}
        error={nfceError}
        onSaleIdChange={setNfceSaleId}
        onClose={() => setIsNFCeModalOpen(false)}
        onSubmit={handleEmitNFCe}
      />

      <EmitNfseModal
        isOpen={isNFSeModalOpen}
        serviceOrders={serviceOrders}
        orderId={nfseOrderId}
        description={nfseDescription}
        submitting={nfseSubmitting}
        error={nfseError}
        onOrderIdChange={setNfseOrderId}
        onDescriptionChange={setNfseDescription}
        onClose={() => setIsNFSeModalOpen(false)}
        onSubmit={handleEmitNFSe}
      />

      <CancelFiscalModal
        doc={cancelDoc}
        reason={cancelReason}
        submitting={cancelSubmitting}
        error={cancelError}
        onReasonChange={setCancelReason}
        onClose={() => setCancelDoc(null)}
        onSubmit={handleCancelDocument}
      />

      <DanfeViewModal
        doc={viewDanfeDoc}
        onClose={() => setViewDanfeDoc(null)}
      />
    </section>
  );
}
