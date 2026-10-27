"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  complianceApi,
  fiscalApi,
  inventoryApi,
  operationsApi,
  type FiscalDocument,
  type Magazine,
  type OperationalBlaster,
  type OperationalLot,
  type PageResult,
  type Product,
  type ServiceOrder,
  type TrafficGuide,
  type TrafficGuideStatus,
} from "@/lib/api";
import { useToast } from "@/components/toast-provider";
import type { GtDraftItem } from "./create-gt-modal";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação de compliance.";
}

export function useComplianceState() {
  const toast = useToast();
  const [guides, setGuides] = useState<PageResult<TrafficGuide>>({
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Filtros
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Dados auxiliares de apoio
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [blasters, setBlasters] = useState<OperationalBlaster[]>([]);
  const [fiscalDocs, setFiscalDocs] = useState<FiscalDocument[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lots, setLots] = useState<OperationalLot[]>([]);

  // Modal Nova Guia de Tráfego
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sourceMagazineId, setSourceMagazineId] = useState("");
  const [fiscalDocumentId, setFiscalDocumentId] = useState("");
  const [serviceOrderId, setServiceOrderId] = useState("");
  const [validFrom, setValidFrom] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });
  const [originCity, setOriginCity] = useState("Ribeirão Preto");
  const [originState, setOriginState] = useState("SP");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationState, setDestinationState] = useState("SP");
  const [routeDescription, setRouteDescription] = useState(
    "Rodovias principais conforme trajeto autorizado",
  );
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePlateState, setVehiclePlateState] = useState("SP");
  const [vehicleModel, setVehicleModel] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverCpf, setDriverCpf] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [hasMopp, setHasMopp] = useState(true);
  const [blasterId, setBlasterId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<GtDraftItem[]>([
    { productId: "", productLotId: "", quantity: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal Espelho de Impressão Militar
  const [viewGuide, setViewGuide] = useState<TrafficGuide | null>(null);

  // Modal Atualização de Status
  const [statusDoc, setStatusDoc] = useState<TrafficGuide | null>(null);
  const [newStatus, setNewStatus] = useState<TrafficGuideStatus>("EM_TRANSITO");
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Carrega Guias de Tráfego
  useEffect(() => {
    let active = true;

    complianceApi
      .getTrafficGuides({
        page: 1,
        limit: 50,
        status: filterStatus || undefined,
        search: searchTerm || undefined,
      })
      .then((res) => {
        if (!active) return;
        setGuides(res);
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
  }, [reloadTrigger, filterStatus, searchTerm]);

  // Carrega dados de apoio para a emissão da GT
  useEffect(() => {
    inventoryApi.getMagazines(1).then((res) => setMagazines(res.data)).catch(() => {});
    inventoryApi.getProducts(1).then((res) => setProducts(res.data)).catch(() => {});
    inventoryApi.getLots(1).then((res) => setLots(res.data)).catch(() => {});
    operationsApi.getBlasters(1).then((res) => setBlasters(res.data)).catch(() => {});
    operationsApi.getOrders(1).then((res) => setServiceOrders(res.data)).catch(() => {});
    fiscalApi.getDocuments({ status: "AUTORIZADO", limit: 50 }).then((res) => setFiscalDocs(res.data)).catch(() => {});
  }, [reloadTrigger]);

  function handleAddItem() {
    setItems((prev) => [...prev, { productId: "", productLotId: "", quantity: 1 }]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleItemChange(
    index: number,
    field: keyof GtDraftItem,
    val: string | number,
  ) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  // Cálculo estimativo em tela da Massa NEQ Total da carga
  const estimatedNeqKg = items.reduce((acc, it) => {
    const prod = products.find((p) => p.id === it.productId);
    const neqGrams = prod ? Number(prod.neqGrams || 0) : 0;
    return acc + (neqGrams * Number(it.quantity || 0)) / 1000;
  }, 0);

  async function handleCreateGuide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sourceMagazineId) {
      setModalError("Selecione o paiol de origem da carga.");
      return;
    }
    if (!vehiclePlate.trim()) {
      setModalError("Informe a placa do veículo transportador.");
      return;
    }
    if (!driverName.trim() || !driverCpf.trim() || !driverLicense.trim()) {
      setModalError("Informe todos os dados obrigatórios do motorista.");
      return;
    }
    if (items.some((it) => !it.productId || !it.productLotId || it.quantity <= 0)) {
      setModalError("Preencha todos os itens com produto, lote e quantidade válida.");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const created = await complianceApi.createTrafficGuide({
        sourceMagazineId,
        fiscalDocumentId: fiscalDocumentId || undefined,
        serviceOrderId: serviceOrderId || undefined,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        originCity,
        originState,
        destinationCity,
        destinationState,
        routeDescription,
        vehiclePlate,
        vehiclePlateState,
        vehicleModel: vehicleModel || undefined,
        driverName,
        driverCpf,
        driverLicense,
        hasMopp,
        blasterId: blasterId || undefined,
        notes: notes || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          productLotId: it.productLotId,
          quantity: Number(it.quantity),
        })),
      });

      setIsCreateModalOpen(false);
      const msg = `Guia de Tráfego militar ${created.number} emitida com sucesso!`;
      setActionSuccess(msg);
      toast.success(msg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!statusDoc) return;
    if (newStatus === "CANCELADA" && statusReason.trim().length < 10) {
      setStatusError("O cancelamento exige justificativa legal de no mínimo 10 caracteres.");
      return;
    }

    setStatusSubmitting(true);
    setStatusError(null);

    try {
      await complianceApi.updateTrafficGuideStatus(statusDoc.id, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
      });

      const num = statusDoc.number;
      setStatusDoc(null);
      setStatusReason("");
      const statusMsg = `Status da Guia de Tráfego ${num} atualizado para ${newStatus}.`;
      setActionSuccess(statusMsg);
      toast.success(statusMsg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusSubmitting(false);
    }
  }

  return {
    guides,
    loading,
    error,
    actionSuccess,
    filterStatus,
    setFilterStatus,
    searchTerm,
    setSearchTerm,
    magazines,
    blasters,
    fiscalDocs,
    serviceOrders,
    products,
    lots,
    isCreateModalOpen,
    setIsCreateModalOpen,
    sourceMagazineId,
    setSourceMagazineId,
    fiscalDocumentId,
    setFiscalDocumentId,
    serviceOrderId,
    setServiceOrderId,
    validFrom,
    setValidFrom,
    validUntil,
    setValidUntil,
    originCity,
    setOriginCity,
    originState,
    setOriginState,
    destinationCity,
    setDestinationCity,
    destinationState,
    setDestinationState,
    routeDescription,
    setRouteDescription,
    vehiclePlate,
    setVehiclePlate,
    vehiclePlateState,
    setVehiclePlateState,
    vehicleModel,
    setVehicleModel,
    driverName,
    setDriverName,
    driverCpf,
    setDriverCpf,
    driverLicense,
    setDriverLicense,
    hasMopp,
    setHasMopp,
    blasterId,
    setBlasterId,
    notes,
    setNotes,
    items,
    submitting,
    modalError,
    viewGuide,
    setViewGuide,
    statusDoc,
    setStatusDoc,
    newStatus,
    setNewStatus,
    statusReason,
    setStatusReason,
    statusSubmitting,
    statusError,
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    estimatedNeqKg,
    handleCreateGuide,
    handleUpdateStatus,
    setReloadTrigger,
  };
}
