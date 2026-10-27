"use client";

import type {
  FiscalDocument,
  Magazine,
  OperationalBlaster,
  ServiceOrder,
} from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

interface GtRouteSectionProps {
  magazines: Magazine[];
  fiscalDocs: FiscalDocument[];
  serviceOrders: ServiceOrder[];
  blasters: OperationalBlaster[];
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
}

export function GtRouteSection({
  magazines,
  fiscalDocs,
  serviceOrders,
  blasters,
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
}: GtRouteSectionProps) {
  return (
    <>
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
                NF-e #{doc.number} - {doc.sale?.customer?.legalName || "Cliente"}
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
            <option value="">Selecione o blaster responsável...</option>
            {blasters.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (Validade: {formatDateOnly(b.licenseExpiresAt)})
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
            onChange={(e) => onOriginStateChange(e.target.value.toUpperCase())}
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
    </>
  );
}
