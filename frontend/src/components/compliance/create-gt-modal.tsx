"use client";

import type { FormEvent } from "react";
import type {
  FiscalDocument,
  Magazine,
  OperationalBlaster,
  OperationalLot,
  Product,
  ServiceOrder,
} from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

export interface GtDraftItem {
  productId: string;
  productLotId: string;
  quantity: number;
}

interface CreateGtModalProps {
  isOpen: boolean;
  submitting: boolean;
  modalError: string | null;
  magazines: Magazine[];
  fiscalDocs: FiscalDocument[];
  serviceOrders: ServiceOrder[];
  blasters: OperationalBlaster[];
  products: Product[];
  lots: OperationalLot[];
  sourceMagazineId: string;
  fiscalDocumentId: string;
  serviceOrderId: string;
  blasterId: string;
  validFrom: string;
  validUntil: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  routeDescription: string;
  vehiclePlate: string;
  vehiclePlateState: string;
  vehicleModel: string;
  driverName: string;
  driverCpf: string;
  driverLicense: string;
  hasMopp: boolean;
  notes: string;
  items: GtDraftItem[];
  estimatedNeqKg: number;
  onSourceMagazineIdChange: (id: string) => void;
  onFiscalDocumentIdChange: (id: string) => void;
  onServiceOrderIdChange: (id: string) => void;
  onBlasterIdChange: (id: string) => void;
  onValidFromChange: (val: string) => void;
  onValidUntilChange: (val: string) => void;
  onOriginCityChange: (val: string) => void;
  onOriginStateChange: (val: string) => void;
  onDestinationCityChange: (val: string) => void;
  onDestinationStateChange: (val: string) => void;
  onRouteChange: (val: string) => void;
  onVehiclePlateChange: (val: string) => void;
  onVehiclePlateStateChange: (val: string) => void;
  onVehicleModelChange: (val: string) => void;
  onDriverNameChange: (val: string) => void;
  onDriverCpfChange: (val: string) => void;
  onDriverLicenseChange: (val: string) => void;
  onHasMoppChange: (val: boolean) => void;
  onNotesChange: (val: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onItemChange: (
    index: number,
    field: keyof GtDraftItem,
    value: string | number,
  ) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function CreateGtModal({
  isOpen,
  submitting,
  modalError,
  magazines,
  fiscalDocs,
  serviceOrders,
  blasters,
  products,
  lots,
  sourceMagazineId,
  fiscalDocumentId,
  serviceOrderId,
  blasterId,
  validFrom,
  validUntil,
  originCity,
  originState,
  destinationCity,
  destinationState,
  routeDescription,
  vehiclePlate,
  vehiclePlateState,
  vehicleModel,
  driverName,
  driverCpf,
  driverLicense,
  hasMopp,
  notes,
  items,
  estimatedNeqKg,
  onSourceMagazineIdChange,
  onFiscalDocumentIdChange,
  onServiceOrderIdChange,
  onBlasterIdChange,
  onValidFromChange,
  onValidUntilChange,
  onOriginCityChange,
  onOriginStateChange,
  onDestinationCityChange,
  onDestinationStateChange,
  onRouteChange,
  onVehiclePlateChange,
  onVehiclePlateStateChange,
  onVehicleModelChange,
  onDriverNameChange,
  onDriverCpfChange,
  onDriverLicenseChange,
  onHasMoppChange,
  onNotesChange,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onClose,
  onSubmit,
}: CreateGtModalProps) {
  if (!isOpen) return null;

  return (
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
          <h2 id="create-gt-title">
            Emitir Guia de Tráfego (Exército Brasileiro)
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div
            className="modal-body"
            style={{ maxHeight: "75vh", overflowY: "auto" }}
          >
            {modalError && (
              <div className="alert alert-danger" role="alert">
                <p>{modalError}</p>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="form-group">
                <label htmlFor="gt-magazine-select" className="form-label">
                  Paiol de Origem *
                </label>
                <select
                  id="gt-magazine-select"
                  className="form-input"
                  value={sourceMagazineId}
                  onChange={(e) => onSourceMagazineIdChange(e.target.value)}
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
                  onChange={(e) => onFiscalDocumentIdChange(e.target.value)}
                >
                  <option value="">Nenhuma / Transporte de OS</option>
                  {fiscalDocs.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      NF-e #{doc.number} -{" "}
                      {doc.sale?.customer?.legalName || "Cliente"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="form-group">
                <label htmlFor="gt-os-select" className="form-label">
                  Ordem de Serviço Vinculada (Espetáculo)
                </label>
                <select
                  id="gt-os-select"
                  className="form-input"
                  value={serviceOrderId}
                  onChange={(e) => onServiceOrderIdChange(e.target.value)}
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
                  onChange={(e) => onBlasterIdChange(e.target.value)}
                >
                  <option value="">
                    Selecione o blaster responsável...
                  </option>
                  {blasters.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (Validade:{" "}
                      {formatDateOnly(b.licenseExpiresAt)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="form-group">
                <label htmlFor="gt-valid-from" className="form-label">
                  Início da Viagem *
                </label>
                <input
                  id="gt-valid-from"
                  type="datetime-local"
                  className="form-input"
                  value={validFrom}
                  onChange={(e) => onValidFromChange(e.target.value)}
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
                  onChange={(e) => onValidUntilChange(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "3fr 1fr 3fr 1fr",
                gap: "0.5rem",
              }}
            >
              <div className="form-group">
                <label htmlFor="gt-orig-city" className="form-label">
                  Origem (Cidade) *
                </label>
                <input
                  id="gt-orig-city"
                  className="form-input"
                  value={originCity}
                  onChange={(e) => onOriginCityChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-orig-uf" className="form-label">
                  UF *
                </label>
                <input
                  id="gt-orig-uf"
                  className="form-input"
                  maxLength={2}
                  value={originState}
                  onChange={(e) =>
                    onOriginStateChange(e.target.value.toUpperCase())
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-dest-city" className="form-label">
                  Destino (Cidade) *
                </label>
                <input
                  id="gt-dest-city"
                  className="form-input"
                  placeholder="Ex: Campinas"
                  value={destinationCity}
                  onChange={(e) => onDestinationCityChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-dest-uf" className="form-label">
                  UF *
                </label>
                <input
                  id="gt-dest-uf"
                  className="form-input"
                  maxLength={2}
                  value={destinationState}
                  onChange={(e) =>
                    onDestinationStateChange(e.target.value.toUpperCase())
                  }
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="gt-route" className="form-label">
                Itinerário Detalhado (Rodovias Principais) *
              </label>
              <input
                id="gt-route"
                className="form-input"
                value={routeDescription}
                onChange={(e) => onRouteChange(e.target.value)}
                required
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="form-group">
                <label htmlFor="gt-plate" className="form-label">
                  Placa do Veículo *
                </label>
                <input
                  id="gt-plate"
                  className="form-input"
                  placeholder="ABC1D23"
                  value={vehiclePlate}
                  onChange={(e) =>
                    onVehiclePlateChange(e.target.value.toUpperCase())
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-plate-uf" className="form-label">
                  UF da Placa *
                </label>
                <input
                  id="gt-plate-uf"
                  className="form-input"
                  maxLength={2}
                  value={vehiclePlateState}
                  onChange={(e) =>
                    onVehiclePlateStateChange(e.target.value.toUpperCase())
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-model" className="form-label">
                  Modelo do Veículo
                </label>
                <input
                  id="gt-model"
                  className="form-input"
                  placeholder="Ex: MB Sprinter"
                  value={vehicleModel}
                  onChange={(e) => onVehicleModelChange(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="form-group">
                <label htmlFor="gt-driver-name" className="form-label">
                  Nome do Motorista *
                </label>
                <input
                  id="gt-driver-name"
                  className="form-input"
                  value={driverName}
                  onChange={(e) => onDriverNameChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-driver-cpf" className="form-label">
                  CPF *
                </label>
                <input
                  id="gt-driver-cpf"
                  className="form-input"
                  placeholder="000.000.000-00"
                  value={driverCpf}
                  onChange={(e) => onDriverCpfChange(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="gt-driver-cnh" className="form-label">
                  CNH *
                </label>
                <input
                  id="gt-driver-cnh"
                  className="form-input"
                  value={driverLicense}
                  onChange={(e) => onDriverLicenseChange(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <div
                className="form-group"
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <input
                  id="gt-has-mopp"
                  type="checkbox"
                  checked={hasMopp}
                  onChange={(e) => onHasMoppChange(e.target.checked)}
                />
                <label
                  htmlFor="gt-has-mopp"
                  className="form-label"
                  style={{ margin: 0 }}
                >
                  Condutor com MOPP Ativo
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="gt-notes" className="form-label">
                  Observações Regulatórias
                </label>
                <input
                  id="gt-notes"
                  className="form-input"
                  placeholder="Ex: Carga escoltada e autorizada pelo DFPC"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                />
              </div>
            </div>

            {/* Itens Controlados */}
            <div
              style={{
                marginTop: "1rem",
                borderTop: "1px solid var(--border-color, #e2e8f0)",
                paddingTop: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem" }}>
                  Produtos Controlados a Transportar
                </h3>
                <button
                  type="button"
                  className="action-button secondary"
                  onClick={onAddItem}
                >
                  + Adicionar Produto
                </button>
              </div>

              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3fr 3fr 1fr auto",
                    gap: "0.5rem",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <select
                    className="form-input"
                    value={item.productId}
                    onChange={(e) =>
                      onItemChange(idx, "productId", e.target.value)
                    }
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
                    onChange={(e) =>
                      onItemChange(idx, "productLotId", e.target.value)
                    }
                    required
                    aria-label={`Lote item ${idx + 1}`}
                  >
                    <option value="">Selecione o lote do paiol...</option>
                    {lots
                      .filter(
                        (l) =>
                          !item.productId || l.productId === item.productId,
                      )
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
                    onChange={(e) =>
                      onItemChange(idx, "quantity", Number(e.target.value))
                    }
                    required
                    aria-label={`Quantidade item ${idx + 1}`}
                  />

                  {items.length > 1 && (
                    <button
                      type="button"
                      className="action-button danger"
                      onClick={() => onRemoveItem(idx)}
                      style={{ padding: "0.4rem 0.6rem" }}
                      aria-label={`Remover item ${idx + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <div
                style={{
                  marginTop: "0.5rem",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
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
              onClick={onClose}
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
  );
}
