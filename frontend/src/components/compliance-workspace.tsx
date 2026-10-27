"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
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
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import { useToast } from "@/components/toast-provider";
import {
  CreateGtModal,
  GtTable,
  PrintGtModal,
  UpdateGtStatusModal,
  type GtDraftItem,
} from "./compliance";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação de compliance.";
}

export function ComplianceWorkspace() {
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

  // Acessibilidade
  useEscapeToClose(isCreateModalOpen, () => !submitting && setIsCreateModalOpen(false));
  useModalFocusTrap(isCreateModalOpen);

  useEscapeToClose(Boolean(viewGuide), () => setViewGuide(null));
  useModalFocusTrap(Boolean(viewGuide));

  useEscapeToClose(Boolean(statusDoc), () => !statusSubmitting && setStatusDoc(null));
  useModalFocusTrap(Boolean(statusDoc));

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

  async function handleQuickDispatch(guide: TrafficGuide) {
    try {
      await complianceApi.updateTrafficGuideStatus(guide.id, {
        status: "EM_TRANSITO",
      });
      const msg = `Guia de Tráfego ${guide.number} atualizada para EM TRÂNSITO com sucesso!`;
      setActionSuccess(msg);
      toast.success(msg);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="eyebrow">Governança & Controle Militar (DFPC / SFPC)</span>
          <h1>Compliance e Guias de Tráfego (GT)</h1>
          <p className="page-description">
            Emissão oficial e fiscalização de Guias de Tráfego para transporte terrestre de Produtos Controlados pelo Exército (PCE), cálculo de carga líquida de explosivos (NEQ) e controle de motoristas com certificação MOPP.
          </p>
        </div>
        <div className="button-group">
          <button
            type="button"
            className="action-button primary"
            onClick={() => setIsCreateModalOpen(true)}
            id="btn-new-gt"
          >
            <Icon name="shield" /> Emitir Guia de Tráfego (GT)
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
          <div style={{ flex: "1 1 260px" }}>
            <label htmlFor="search-gt-input" className="form-label" style={{ marginBottom: "0.25rem", display: "block" }}>
              Buscar por Número, Placa, Motorista ou Destino
            </label>
            <input
              id="search-gt-input"
              type="search"
              className="form-input"
              placeholder="Digite a GT, placa ou motorista..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ width: "180px" }}>
            <label htmlFor="filter-gt-status-select" className="form-label" style={{ marginBottom: "0.25rem", display: "block" }}>
              Status da Viagem
            </label>
            <select
              id="filter-gt-status-select"
              className="form-input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="EMITIDA">EMITIDA</option>
              <option value="EM_TRANSITO">EM TRÂNSITO</option>
              <option value="CONCLUIDA">CONCLUÍDA</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", height: "100%", paddingTop: "1.5rem" }}>
            <button
              type="button"
              className="action-button secondary"
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("");
                setReloadTrigger((v) => v + 1);
              }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Guias de Tráfego */}
      <div className="card">
        <GtTable
          guides={guides.data}
          loading={loading}
          onViewGuide={(gt) => setViewGuide(gt)}
          onQuickDispatch={handleQuickDispatch}
          onOpenStatusModal={(gt) => {
            setStatusDoc(gt);
            setNewStatus(
              gt.status === "EMITIDA" ? "EM_TRANSITO" : "CONCLUIDA",
            );
            setStatusReason("");
            setStatusError(null);
          }}
        />
      </div>

      {/* Modal Emissão Nova Guia de Tráfego */}
      <CreateGtModal
        isOpen={isCreateModalOpen}
        submitting={submitting}
        modalError={modalError}
        magazines={magazines}
        fiscalDocs={fiscalDocs}
        serviceOrders={serviceOrders}
        blasters={blasters}
        products={products}
        lots={lots}
        sourceMagazineId={sourceMagazineId}
        fiscalDocumentId={fiscalDocumentId}
        serviceOrderId={serviceOrderId}
        blasterId={blasterId}
        validFrom={validFrom}
        validUntil={validUntil}
        originCity={originCity}
        originState={originState}
        destinationCity={destinationCity}
        destinationState={destinationState}
        routeDescription={routeDescription}
        vehiclePlate={vehiclePlate}
        vehiclePlateState={vehiclePlateState}
        vehicleModel={vehicleModel}
        driverName={driverName}
        driverCpf={driverCpf}
        driverLicense={driverLicense}
        hasMopp={hasMopp}
        notes={notes}
        items={items}
        estimatedNeqKg={estimatedNeqKg}
        onSourceMagazineIdChange={setSourceMagazineId}
        onFiscalDocumentIdChange={setFiscalDocumentId}
        onServiceOrderIdChange={setServiceOrderId}
        onBlasterIdChange={setBlasterId}
        onValidFromChange={setValidFrom}
        onValidUntilChange={setValidUntil}
        onOriginCityChange={setOriginCity}
        onOriginStateChange={setOriginState}
        onDestinationCityChange={setDestinationCity}
        onDestinationStateChange={setDestinationState}
        onRouteChange={setRouteDescription}
        onVehiclePlateChange={setVehiclePlate}
        onVehiclePlateStateChange={setVehiclePlateState}
        onVehicleModelChange={setVehicleModel}
        onDriverNameChange={setDriverName}
        onDriverCpfChange={setDriverCpf}
        onDriverLicenseChange={setDriverLicense}
        onHasMoppChange={setHasMopp}
        onNotesChange={setNotes}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onItemChange={handleItemChange}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateGuide}
      />

      {/* Modal Espelho de Impressão Militar da Guia de Tráfego */}
      <PrintGtModal
        guide={viewGuide}
        onClose={() => setViewGuide(null)}
      />

      {/* Modal Atualização de Status */}
      <UpdateGtStatusModal
        guide={statusDoc}
        newStatus={newStatus}
        statusReason={statusReason}
        statusSubmitting={statusSubmitting}
        statusError={statusError}
        onNewStatusChange={setNewStatus}
        onStatusReasonChange={setStatusReason}
        onClose={() => setStatusDoc(null)}
        onSubmit={handleUpdateStatus}
      />
    </section>
  );
}
