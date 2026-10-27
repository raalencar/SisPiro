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
import { GtRouteSection } from "./gt-route-section";
import { GtVehicleSection } from "./gt-vehicle-section";
import { GtItemsSection } from "./gt-items-section";

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
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-gt-title"
    >
      <div
        className="modal-container"
        style={{ maxWidth: "800px", width: "95%" }}
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

            <GtRouteSection
              magazines={magazines}
              fiscalDocs={fiscalDocs}
              serviceOrders={serviceOrders}
              blasters={blasters}
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
              onSourceMagazineIdChange={onSourceMagazineIdChange}
              onFiscalDocumentIdChange={onFiscalDocumentIdChange}
              onServiceOrderIdChange={onServiceOrderIdChange}
              onBlasterIdChange={onBlasterIdChange}
              onValidFromChange={onValidFromChange}
              onValidUntilChange={onValidUntilChange}
              onOriginCityChange={onOriginCityChange}
              onOriginStateChange={onOriginStateChange}
              onDestinationCityChange={onDestinationCityChange}
              onDestinationStateChange={onDestinationStateChange}
              onRouteChange={onRouteChange}
            />

            <GtVehicleSection
              vehiclePlate={vehiclePlate}
              vehiclePlateState={vehiclePlateState}
              vehicleModel={vehicleModel}
              driverName={driverName}
              driverCpf={driverCpf}
              driverLicense={driverLicense}
              hasMopp={hasMopp}
              notes={notes}
              onVehiclePlateChange={onVehiclePlateChange}
              onVehiclePlateStateChange={onVehiclePlateStateChange}
              onVehicleModelChange={onVehicleModelChange}
              onDriverNameChange={onDriverNameChange}
              onDriverCpfChange={onDriverCpfChange}
              onDriverLicenseChange={onDriverLicenseChange}
              onHasMoppChange={onHasMoppChange}
              onNotesChange={onNotesChange}
            />

            <GtItemsSection
              products={products}
              lots={lots}
              items={items}
              estimatedNeqKg={estimatedNeqKg}
              onAddItem={onAddItem}
              onRemoveItem={onRemoveItem}
              onItemChange={onItemChange}
            />
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
