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
import { formatDateOnly, formatNumber } from "@/lib/format";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação de compliance.";
}

export function ComplianceWorkspace() {
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
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 16));
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 16);
  });
  const [originCity, setOriginCity] = useState("Ribeirão Preto");
  const [originState, setOriginState] = useState("SP");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationState, setDestinationState] = useState("SP");
  const [routeDescription, setRouteDescription] = useState("Rodovias principais conforme trajeto autorizado");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehiclePlateState, setVehiclePlateState] = useState("SP");
  const [vehicleModel, setVehicleModel] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverCpf, setDriverCpf] = useState("");
  const [driverLicense, setDriverLicense] = useState("");
  const [hasMopp, setHasMopp] = useState(true);
  const [blasterId, setBlasterId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<
    Array<{ productId: string; productLotId: string; quantity: number }>
  >([{ productId: "", productLotId: "", quantity: 1 }]);
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
    field: "productId" | "productLotId" | "quantity",
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

  async function handleCreateGuide(e: FormEvent) {
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
      setActionSuccess(`Guia de Tráfego militar ${created.number} emitida com sucesso!`);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setModalError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus(e: FormEvent) {
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
      setActionSuccess(`Status da Guia de Tráfego ${num} atualizado para ${newStatus}.`);
      setReloadTrigger((v) => v + 1);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusSubmitting(false);
    }
  }

  function renderStatusBadge(status: TrafficGuideStatus) {
    switch (status) {
      case "EMITIDA":
        return <span className="status-badge status-badge-info">EMITIDA</span>;
      case "EM_TRANSITO":
        return <span className="status-badge status-badge-warning">EM TRÂNSITO</span>;
      case "CONCLUIDA":
        return <span className="status-badge status-badge-success">CONCLUÍDA</span>;
      case "CANCELADA":
        return <span className="status-badge status-badge-danger">CANCELADA</span>;
      default:
        return <span className="status-badge">{status}</span>;
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
        {loading ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <p>Carregando Guias de Tráfego...</p>
          </div>
        ) : guides.data.length === 0 ? (
          <div className="empty-state" style={{ padding: "3rem" }}>
            <h3>Nenhuma Guia de Tráfego emitida</h3>
            <p>Emita a primeira Guia de Tráfego para autorizar o deslocamento legal de produtos controlados pelo Exército.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº da GT</th>
                  <th>Itinerário (Origem → Destino)</th>
                  <th>Veículo / Placa</th>
                  <th>Motorista / MOPP</th>
                  <th>Blaster Técnico</th>
                  <th>Carga NEQ (kg)</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {guides.data.map((gt) => (
                  <tr key={gt.id}>
                    <td>
                      <strong>{gt.number}</strong>
                      {gt.fiscalDocument && (
                        <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                          NF-e #{gt.fiscalDocument.number}
                        </div>
                      )}
                      {gt.serviceOrder && (
                        <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                          OS #{gt.serviceOrder.code}
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{gt.originCity}/{gt.originState} → {gt.destinationCity}/{gt.destinationState}</strong>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                        {gt.routeDescription}
                      </div>
                    </td>
                    <td>
                      <strong>{gt.vehiclePlate} ({gt.vehiclePlateState})</strong>
                      {gt.vehicleModel && (
                        <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                          {gt.vehicleModel}
                        </div>
                      )}
                    </td>
                    <td>
                      <div><strong>{gt.driverName}</strong></div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                        CNH: {gt.driverLicense} {gt.hasMopp ? "• MOPP Ativo" : ""}
                      </div>
                    </td>
                    <td>
                      {gt.blaster ? (
                        <div>
                          <strong>{gt.blaster.name}</strong>
                          <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                            CR: {gt.blaster.licenseNumber}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--color-muted, #718096)" }}>Não se aplica</span>
                      )}
                    </td>
                    <td>
                      <span className="badge">
                        {formatNumber(Number(gt.totalNeqKg), 3)} kg NEQ
                      </span>
                    </td>
                    <td>{renderStatusBadge(gt.status)}</td>
                    <td>
                      <div style={{ fontSize: "0.8rem" }}>
                        De: {formatDateOnly(gt.validFrom)}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-muted, #718096)" }}>
                        Até: {formatDateOnly(gt.validUntil)}
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="action-button secondary"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                          onClick={() => setViewGuide(gt)}
                          title="Visualizar espelho oficial da Guia de Tráfego do Exército"
                        >
                          Espelho GT
                        </button>
                        {gt.status !== "CONCLUIDA" && gt.status !== "CANCELADA" && (
                          <button
                            type="button"
                            className="action-button secondary"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                            onClick={() => {
                              setStatusDoc(gt);
                              setNewStatus(gt.status === "EMITIDA" ? "EM_TRANSITO" : "CONCLUIDA");
                              setStatusReason("");
                              setStatusError(null);
                            }}
                            title="Atualizar status da viagem"
                          >
                            Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Emissão Nova Guia de Tráfego */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="create-gt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-gt-title"
            style={{ maxWidth: "800px" }}
          >
            <div className="modal-header">
              <h2 id="create-gt-title">Emitir Guia de Tráfego (Exército Brasileiro)</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Fechar modal"
                disabled={submitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateGuide}>
              <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                {modalError && (
                  <div className="alert alert-danger" role="alert">
                    <p>{modalError}</p>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label htmlFor="gt-magazine-select" className="form-label">
                      Paiol de Origem *
                    </label>
                    <select
                      id="gt-magazine-select"
                      className="form-input"
                      value={sourceMagazineId}
                      onChange={(e) => setSourceMagazineId(e.target.value)}
                      required
                    >
                      <option value="">Selecione o paiol...</option>
                      {magazines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Capacidade: {m.maxNeqCapacityKg} kg NEQ)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="gt-fiscal-select" className="form-label">
                      NF-e Autorizada Vinculada
                    </label>
                    <select
                      id="gt-fiscal-select"
                      className="form-input"
                      value={fiscalDocumentId}
                      onChange={(e) => setFiscalDocumentId(e.target.value)}
                    >
                      <option value="">Nenhuma / Transporte de OS</option>
                      {fiscalDocs.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          NF-e #{doc.number} - {doc.sale?.customer?.legalName || "Cliente"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label htmlFor="gt-os-select" className="form-label">
                      Ordem de Serviço Vinculada (Espetáculo)
                    </label>
                    <select
                      id="gt-os-select"
                      className="form-input"
                      value={serviceOrderId}
                      onChange={(e) => setServiceOrderId(e.target.value)}
                    >
                      <option value="">Nenhuma / Venda Direta</option>
                      {serviceOrders.map((os) => (
                        <option key={os.id} value={os.id}>
                          OS #{os.code} - {os.eventLocation}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="gt-blaster-select" className="form-label">
                      Blaster Responsável Técnico
                    </label>
                    <select
                      id="gt-blaster-select"
                      className="form-input"
                      value={blasterId}
                      onChange={(e) => setBlasterId(e.target.value)}
                    >
                      <option value="">Selecione o blaster responsável...</option>
                      {blasters.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} (Validade: {formatDateOnly(b.licenseExpiresAt)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label htmlFor="gt-valid-from" className="form-label">
                      Início da Viagem *
                    </label>
                    <input
                      id="gt-valid-from"
                      type="datetime-local"
                      className="form-input"
                      value={validFrom}
                      onChange={(e) => setValidFrom(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="gt-valid-until" className="form-label">
                      Data Limite de Validade *
                    </label>
                    <input
                      id="gt-valid-until"
                      type="datetime-local"
                      className="form-input"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 3fr 1fr", gap: "0.5rem" }}>
                  <div className="form-group">
                    <label htmlFor="gt-orig-city" className="form-label">Origem (Cidade) *</label>
                    <input id="gt-orig-city" className="form-input" value={originCity} onChange={(e) => setOriginCity(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-orig-uf" className="form-label">UF *</label>
                    <input id="gt-orig-uf" className="form-input" maxLength={2} value={originState} onChange={(e) => setOriginState(e.target.value.toUpperCase())} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-dest-city" className="form-label">Destino (Cidade) *</label>
                    <input id="gt-dest-city" className="form-input" placeholder="Ex: Campinas" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-dest-uf" className="form-label">UF *</label>
                    <input id="gt-dest-uf" className="form-input" maxLength={2} value={destinationState} onChange={(e) => setDestinationState(e.target.value.toUpperCase())} required />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="gt-route" className="form-label">Itinerário Detalhado (Rodovias Principais) *</label>
                  <input id="gt-route" className="form-input" value={routeDescription} onChange={(e) => setRouteDescription(e.target.value)} required />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label htmlFor="gt-plate" className="form-label">Placa do Veículo *</label>
                    <input id="gt-plate" className="form-input" placeholder="ABC1D23" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-plate-uf" className="form-label">UF da Placa *</label>
                    <input id="gt-plate-uf" className="form-input" maxLength={2} value={vehiclePlateState} onChange={(e) => setVehiclePlateState(e.target.value.toUpperCase())} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-model" className="form-label">Modelo do Veículo</label>
                    <input id="gt-model" className="form-input" placeholder="Ex: MB Sprinter" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "1rem" }}>
                  <div className="form-group">
                    <label htmlFor="gt-driver-name" className="form-label">Nome do Motorista *</label>
                    <input id="gt-driver-name" className="form-input" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-driver-cpf" className="form-label">CPF *</label>
                    <input id="gt-driver-cpf" className="form-input" placeholder="000.000.000-00" value={driverCpf} onChange={(e) => setDriverCpf(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-driver-cnh" className="form-label">CNH *</label>
                    <input id="gt-driver-cnh" className="form-input" value={driverLicense} onChange={(e) => setDriverLicense(e.target.value)} required />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem", alignItems: "center" }}>
                  <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      id="gt-has-mopp"
                      type="checkbox"
                      checked={hasMopp}
                      onChange={(e) => setHasMopp(e.target.checked)}
                    />
                    <label htmlFor="gt-has-mopp" className="form-label" style={{ margin: 0 }}>
                      Condutor com MOPP Ativo
                    </label>
                  </div>
                  <div className="form-group">
                    <label htmlFor="gt-notes" className="form-label">Observações Regulatórias</label>
                    <input
                      id="gt-notes"
                      className="form-input"
                      placeholder="Ex: Carga escoltada e autorizada pelo DFPC"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Itens Controlados */}
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-color, #e2e8f0)", paddingTop: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>Produtos Controlados a Transportar</h3>
                    <button type="button" className="action-button secondary" onClick={handleAddItem}>
                      + Adicionar Produto
                    </button>
                  </div>

                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 3fr 1fr auto", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                      <select
                        className="form-input"
                        value={item.productId}
                        onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                        required
                        aria-label={`Produto item ${idx + 1}`}
                      >
                        <option value="">Selecione o produto PCE...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.neqGrams}g NEQ)
                          </option>
                        ))}
                      </select>

                      <select
                        className="form-input"
                        value={item.productLotId}
                        onChange={(e) => handleItemChange(idx, "productLotId", e.target.value)}
                        required
                        aria-label={`Lote item ${idx + 1}`}
                      >
                        <option value="">Selecione o lote do paiol...</option>
                        {lots
                          .filter((l) => !item.productId || l.productId === item.productId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              Lote {l.lotNumber} (Saldo: {l.quantity})
                            </option>
                          ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                        required
                        aria-label={`Quantidade item ${idx + 1}`}
                      />

                      {items.length > 1 && (
                        <button
                          type="button"
                          className="action-button danger"
                          onClick={() => handleRemoveItem(idx)}
                          style={{ padding: "0.4rem 0.6rem" }}
                          aria-label={`Remover item ${idx + 1}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{ marginTop: "0.5rem", textAlign: "right", fontWeight: "bold" }}>
                    Carga Explosiva Estimada:{" "}
                    <span style={{ color: "var(--color-primary, #2b6cb0)" }}>
                      {estimatedNeqKg.toFixed(4)} kg NEQ
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="action-button primary"
                  disabled={submitting}
                >
                  {submitting ? "Homologando GT..." : "Homologar e Emitir Guia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Espelho de Impressão Militar da Guia de Tráfego */}
      {viewGuide && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="view-gt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-gt-title"
            style={{ maxWidth: "850px" }}
          >
            <div className="modal-header">
              <h2 id="view-gt-title">Espelho Oficial - Guia de Tráfego #{viewGuide.number}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewGuide(null)}
                aria-label="Fechar visualização"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", fontFamily: "serif" }}>
              <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: 0, textTransform: "uppercase", fontSize: "1.1rem" }}>
                  República Federativa do Brasil
                </h3>
                <h4 style={{ margin: "4px 0", textTransform: "uppercase", fontSize: "1rem" }}>
                  Ministério da Defesa • Exército Brasileiro
                </h4>
                <div style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
                  Comando Logístico (COLOG) • Diretoria de Fiscalização de Produtos Controlados (DFPC)
                </div>
                <div style={{ marginTop: "0.5rem", fontSize: "1.2rem", fontWeight: "bold" }}>
                  GUIA DE TRÁFEGO PARA TRANSPORTE DE PCE (R-105)
                </div>
                <div style={{ fontSize: "1rem", color: "#444" }}>
                  Nº {viewGuide.number} • Status: {viewGuide.status}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
                <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
                  <strong>EXPEDIDOR / ORIGEM:</strong>
                  <div>Casa de Fogos SisPiro ERP</div>
                  <div>Paiol: {viewGuide.sourceMagazine?.name || "Paiol Central"}</div>
                  <div>Município: {viewGuide.originCity} / {viewGuide.originState}</div>
                </div>

                <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
                  <strong>DESTINATÁRIO / FINALIDADE:</strong>
                  <div>Destino: {viewGuide.destinationCity} / {viewGuide.destinationState}</div>
                  <div>Itinerário: {viewGuide.routeDescription}</div>
                  {viewGuide.fiscalDocument && <div>NF-e Vinculada: #{viewGuide.fiscalDocument.number}</div>}
                  {viewGuide.serviceOrder && <div>OS de Queima: #{viewGuide.serviceOrder.code}</div>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
                <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
                  <strong>DADOS DO TRANSPORTE:</strong>
                  <div>Veículo: Placa {viewGuide.vehiclePlate} ({viewGuide.vehiclePlateState})</div>
                  <div>Motorista: {viewGuide.driverName}</div>
                  <div>CPF: {viewGuide.driverCpf} • CNH: {viewGuide.driverLicense}</div>
                  <div>Certificação MOPP: {viewGuide.hasMopp ? "SIM (Habilitado)" : "NÃO"}</div>
                </div>

                <div style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
                  <strong>RESPONSABILIDADE TÉCNICA:</strong>
                  {viewGuide.blaster ? (
                    <>
                      <div>Blaster: {viewGuide.blaster.name}</div>
                      <div>Carteira de Blaster: {viewGuide.blaster.licenseNumber}</div>
                    </>
                  ) : (
                    <div>Transporte regular sob responsabilidade do expedidor</div>
                  )}
                  <div style={{ marginTop: "0.25rem", fontWeight: "bold" }}>
                    Massa Líquida de Explosivo Total: {formatNumber(Number(viewGuide.totalNeqKg), 4)} kg NEQ
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <strong>DISCRIMINAÇÃO DOS MATERIAIS CONTROLADOS (PCE):</strong>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0.5rem", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #000" }}>
                      <th style={{ textAlign: "left", padding: "4px" }}>Item / Descrição</th>
                      <th style={{ textAlign: "left", padding: "4px" }}>Nº Lote</th>
                      <th style={{ textAlign: "center", padding: "4px" }}>Classe ONU</th>
                      <th style={{ textAlign: "right", padding: "4px" }}>Qtd</th>
                      <th style={{ textAlign: "right", padding: "4px" }}>NEQ (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewGuide.items?.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "4px" }}>{it.product?.name || "Produto PCE"}</td>
                        <td style={{ padding: "4px" }}>{it.productLot?.lotNumber || "-"}</td>
                        <td style={{ textAlign: "center", padding: "4px" }}>{it.unNumber} ({it.riskClass})</td>
                        <td style={{ textAlign: "right", padding: "4px" }}>{it.quantity}</td>
                        <td style={{ textAlign: "right", padding: "4px" }}>
                          {(Number(it.neqGrams) / 1000).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: "2rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", textAlign: "center", fontSize: "0.85rem" }}>
                <div style={{ borderTop: "1px solid #000", paddingTop: "0.5rem" }}>
                  Assinatura do Motorista Transportador
                </div>
                <div style={{ borderTop: "1px solid #000", paddingTop: "0.5rem" }}>
                  Assinatura do Blaster / Responsável Técnico
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="action-button secondary"
                onClick={() => setViewGuide(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="action-button primary"
                onClick={() => window.print()}
              >
                Imprimir Guia Oficial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atualização de Status */}
      {statusDoc && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            id="status-gt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-gt-title"
          >
            <div className="modal-header">
              <h2 id="status-gt-title">Atualizar Status - {statusDoc.number}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setStatusDoc(null)}
                aria-label="Fechar modal"
                disabled={statusSubmitting}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateStatus}>
              <div className="modal-body">
                {statusError && (
                  <div className="alert alert-danger" role="alert">
                    <p>{statusError}</p>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="new-status-select" className="form-label">
                    Novo Status Regulatório *
                  </label>
                  <select
                    id="new-status-select"
                    className="form-input"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TrafficGuideStatus)}
                    required
                  >
                    <option value="EM_TRANSITO">EM TRÂNSITO (Carga Liberada)</option>
                    <option value="CONCLUIDA">CONCLUÍDA (Chegada Confirmada no Destino)</option>
                    <option value="CANCELADA">CANCELADA (Viagem Suspensa/Revogada)</option>
                  </select>
                </div>

                {newStatus === "CANCELADA" && (
                  <div className="form-group">
                    <label htmlFor="status-reason-input" className="form-label">
                      Justificativa Militar do Cancelamento * (Mínimo 10 caracteres)
                    </label>
                    <textarea
                      id="status-reason-input"
                      className="form-input"
                      rows={3}
                      placeholder="Ex: Cancelamento do espetáculo por intempéries climáticas."
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={() => setStatusDoc(null)}
                  disabled={statusSubmitting}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="action-button primary"
                  disabled={statusSubmitting}
                >
                  {statusSubmitting ? "Atualizando..." : "Confirmar Alteração"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
