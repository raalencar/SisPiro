"use client";

interface GtVehicleSectionProps {
  vehiclePlate: string;
  vehiclePlateState: string;
  vehicleModel: string;
  driverName: string;
  driverCpf: string;
  driverLicense: string;
  hasMopp: boolean;
  notes: string;
  onVehiclePlateChange: (val: string) => void;
  onVehiclePlateStateChange: (val: string) => void;
  onVehicleModelChange: (val: string) => void;
  onDriverNameChange: (val: string) => void;
  onDriverCpfChange: (val: string) => void;
  onDriverLicenseChange: (val: string) => void;
  onHasMoppChange: (val: boolean) => void;
  onNotesChange: (val: string) => void;
}

export function GtVehicleSection({
  vehiclePlate,
  vehiclePlateState,
  vehicleModel,
  driverName,
  driverCpf,
  driverLicense,
  hasMopp,
  notes,
  onVehiclePlateChange,
  onVehiclePlateStateChange,
  onVehicleModelChange,
  onDriverNameChange,
  onDriverCpfChange,
  onDriverLicenseChange,
  onHasMoppChange,
  onNotesChange,
}: GtVehicleSectionProps) {
  return (
    <>
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
    </>
  );
}
