"use client";

export function CreateMagazineForm() {
  return (
    <>
      <label className="field">
        <span>Nome do paiol</span>
        <input name="name" maxLength={100} required />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Capacidade máxima (kg NEQ)</span>
          <input
            name="maxNeqCapacityKg"
            type="number"
            min="0.01"
            max="99999999.99"
            step="0.01"
            required
          />
        </label>
        <label className="field">
          <span>Validade da licença de fogo</span>
          <input name="fireLicenseExpiresAt" type="date" required />
        </label>
      </div>
    </>
  );
}
