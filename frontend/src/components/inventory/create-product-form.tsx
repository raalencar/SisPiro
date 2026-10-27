"use client";

interface CreateProductFormProps {
  productType: string;
  isPce: boolean;
  onProductTypeChange: (type: string) => void;
  onIsPceChange: (isPce: boolean) => void;
}

export function CreateProductForm({
  productType,
  isPce,
  onProductTypeChange,
  onIsPceChange,
}: CreateProductFormProps) {
  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span>SKU</span>
          <input name="sku" maxLength={50} required />
        </label>
        <label className="field">
          <span>Nome</span>
          <input name="name" maxLength={150} required />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Tipo</span>
          <select
            name="type"
            required
            value={productType}
            onChange={(event) => {
              onProductTypeChange(event.target.value);
              if (event.target.value === "SERVICO") onIsPceChange(false);
            }}
          >
            <option value="MERCADORIA">Mercadoria</option>
            <option value="INSUMO">Insumo</option>
            <option value="SERVICO">Serviço</option>
          </select>
        </label>
        <label className="field">
          <span>Unidade</span>
          <input name="unit" maxLength={10} placeholder="UN" required />
        </label>
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={isPce}
          disabled={productType === "SERVICO"}
          onChange={(event) => onIsPceChange(event.target.checked)}
        />
        Produto controlado (PCE)
      </label>
      {isPce && (
        <div className="form-grid">
          <label className="field">
            <span>Classe de risco</span>
            <input name="riskClass" maxLength={20} placeholder="1.3G" required />
          </label>
          <label className="field">
            <span>NEQ unitária (gramas)</span>
            <input
              name="neqGrams"
              type="number"
              min="0.001"
              max="9999999.999"
              step="0.001"
              required
            />
          </label>
        </div>
      )}
    </>
  );
}
