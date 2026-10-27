"use client";

import type { Magazine, Product } from "@/lib/api";

interface CreateLotFormProps {
  availableProducts: Product[];
  magazines: Magazine[];
}

export function CreateLotForm({
  availableProducts,
  magazines,
}: CreateLotFormProps) {
  if (availableProducts.length === 0 || magazines.length === 0) {
    return (
      <p className="form-hint">
        Cadastre ao menos um produto que não seja serviço e um paiol
        antes de receber um lote.
      </p>
    );
  }

  return (
    <>
      <div className="form-grid">
        <label className="field">
          <span>Produto</span>
          <select name="productId" required defaultValue="">
            <option value="" disabled>Selecione</option>
            {availableProducts.map((product) => (
              <option value={product.id} key={product.id}>
                {product.sku} · {product.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Paiol de destino</span>
          <select name="magazineId" required defaultValue="">
            <option value="" disabled>Selecione</option>
            {magazines.map((magazine) => (
              <option value={magazine.id} key={magazine.id}>
                {magazine.name} · {magazine.remainingNeqKg} kg NEQ livres
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Número do lote</span>
          <input name="lotNumber" maxLength={50} required />
        </label>
        <label className="field">
          <span>Quantidade recebida</span>
          <input
            name="quantity"
            type="number"
            min="0.01"
            max="99999999.99"
            step="0.01"
            required
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Data de fabricação</span>
          <input name="manufacturedAt" type="date" required />
        </label>
        <label className="field">
          <span>Data de validade</span>
          <input name="expiresAt" type="date" required />
        </label>
      </div>
      <label className="field">
        <span>Fabricante ou importador</span>
        <input name="manufacturerOrImporter" maxLength={150} required />
      </label>
      <p className="form-hint">
        O recebimento valida licença e capacidade NEQ do paiol e
        registra automaticamente a movimentação inicial.
      </p>
    </>
  );
}
