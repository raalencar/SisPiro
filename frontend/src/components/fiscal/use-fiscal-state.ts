"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  commercialApi,
  fiscalApi,
  operationsApi,
  type FiscalDocument,
  type PageResult,
  type Sale,
  type ServiceOrder,
} from "@/lib/api";
import { useToast } from "@/components/toast-provider";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação fiscal.";
}

export function useFiscalState() {
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

  return {
    documents,
    loading,
    error,
    actionSuccess,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    searchTerm,
    setSearchTerm,
    sales,
    serviceOrders,
    isNFeModalOpen,
    setIsNFeModalOpen,
    nfeSaleId,
    setNfeSaleId,
    nfeNature,
    setNfeNature,
    nfeNotes,
    setNfeNotes,
    nfeSubmitting,
    nfeError,
    isNFCeModalOpen,
    setIsNFCeModalOpen,
    nfceSaleId,
    setNfceSaleId,
    nfceSubmitting,
    nfceError,
    isNFSeModalOpen,
    setIsNFSeModalOpen,
    nfseOrderId,
    setNfseOrderId,
    nfseDescription,
    setNfseDescription,
    nfseSubmitting,
    nfseError,
    cancelDoc,
    setCancelDoc,
    cancelReason,
    setCancelReason,
    cancelSubmitting,
    cancelError,
    viewDanfeDoc,
    setViewDanfeDoc,
    copiedKey,
    copyAccessKey,
    handleEmitNFe,
    handleEmitNFCe,
    handleEmitNFSe,
    handleCancelDocument,
    setReloadTrigger,
  };
}
