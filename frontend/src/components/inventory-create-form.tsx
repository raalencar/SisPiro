"use client";

import { useState, type FormEvent } from "react";
import { ApiError, inventoryApi, type Magazine, type Product, type ProductLot } from "@/lib/api";

export type InventoryFormType = "product" | "magazine" | "lot" | "movement";

type Props = {
  type: InventoryFormType;
  products: Product[];
  magazines: Magazine[];
  lots: ProductLot[];
  onClose: () => void;
  onCreated: (message: string) => void;
};

const formTitles: Record<InventoryFormType, string> = {
  product: "Cadastrar produto",
  magazine: "Cadastrar paiol",
  lot: "Receber novo lote",
  movement: "Registrar movimentação",
};

function formErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error
    ? error.message
    : "Não foi possível salvar os dados.";
}

function stringField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function numberField(form: FormData, name: string): number {
  return Number(form.get(name));
}

export function InventoryCreateForm({
  type,
  products,
  magazines,
  lots,
  onClose,
  onCreated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPce, setIsPce] = useState(false);
  const [productType, setProductType] = useState("MERCADORIA");
  const [movementType, setMovementType] = useState("ENTRADA");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [movementQuantity, setMovementQuantity] = useState("");
  const selectedLot = lots.find((lot) => lot.id === selectedLotId);
  const availableProducts = products.filter((product) => product.type !== "SERVICO");
  const destinationMagazines = magazines.filter(
    (magazine) => magazine.id !== selectedLot?.magazineId,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      if (type === "product") {
        const body = {
          sku: stringField(form, "sku"),
          name: stringField(form, "name"),
          type: stringField(form, "type") as Product["type"],
          isPce,
          ...(isPce
            ? {
                riskClass: stringField(form, "riskClass"),
                neqGrams: numberField(form, "neqGrams"),
              }
            : {}),
          unit: stringField(form, "unit"),
        };
        await inventoryApi.createProduct(body);
        onCreated("Produto cadastrado.");
      } else if (type === "magazine") {
        await inventoryApi.createMagazine({
          name: stringField(form, "name"),
          maxNeqCapacityKg: numberField(form, "maxNeqCapacityKg"),
          fireLicenseExpiresAt: stringField(form, "fireLicenseExpiresAt"),
        });
        onCreated("Paiol cadastrado.");
      } else if (type === "lot") {
        const manufacturedAt = stringField(form, "manufacturedAt");
        const expiresAt = stringField(form, "expiresAt");
        if (expiresAt < manufacturedAt) {
          setError("A validade do lote não pode anteceder a fabricação.");
          return;
        }
        await inventoryApi.createLot({
          productId: stringField(form, "productId"),
          magazineId: stringField(form, "magazineId"),
          lotNumber: stringField(form, "lotNumber"),
          quantity: numberField(form, "quantity"),
          manufacturedAt,
          expiresAt,
          manufacturerOrImporter: stringField(form, "manufacturerOrImporter"),
        });
        onCreated("Lote recebido e movimentação inicial registrada.");
      } else {
        const selectedType = stringField(form, "type") as
          | "ENTRADA"
          | "SAIDA"
          | "TRANSFERENCIA"
          | "AJUSTE";
        const body = {
          type: selectedType,
          productLotId: stringField(form, "productLotId"),
          quantity: numberField(form, "quantity"),
          ...(selectedType === "TRANSFERENCIA"
            ? { destinationMagazineId: stringField(form, "destinationMagazineId") }
            : {}),
          ...(stringField(form, "reference")
            ? { reference: stringField(form, "reference") }
            : {}),
        };
        await inventoryApi.createMovement(body);
        onCreated("Movimentação registrada no histórico do estoque.");
      }
    } catch (requestError) {
      setError(formErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section
        className="inventory-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-form-title"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Estoque e WMS</p>
            <h2 id="inventory-form-title">{formTitles[type]}</h2>
          </div>
          <button
            className="button button--quiet"
            type="button"
            disabled={submitting}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>

        <form className="form-stack inventory-form" onSubmit={handleSubmit}>
          {type === "product" && (
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
                      setProductType(event.target.value);
                      if (event.target.value === "SERVICO") setIsPce(false);
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
                  onChange={(event) => setIsPce(event.target.checked)}
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
          )}

          {type === "magazine" && (
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
          )}

          {type === "lot" && (
            <>
              {availableProducts.length === 0 || magazines.length === 0 ? (
                <p className="form-hint">
                  Cadastre ao menos um produto que não seja serviço e um paiol
                  antes de receber um lote.
                </p>
              ) : (
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
              )}
            </>
          )}

          {type === "movement" && (
            <>
              {lots.length === 0 ? (
                <p className="form-hint">Cadastre e receba um lote antes de movimentar o estoque.</p>
              ) : (
                <>
                  <label className="field">
                    <span>Lote</span>
                    <select
                      name="productLotId"
                      required
                      value={selectedLotId}
                      onChange={(event) => {
                        const lotId = event.target.value;
                        setSelectedLotId(lotId);
                        if (movementType === "TRANSFERENCIA") {
                          setMovementQuantity(
                            lots.find((lot) => lot.id === lotId)?.quantity ?? "",
                          );
                        }
                      }}
                    >
                      <option value="" disabled>Selecione</option>
                      {lots.map((lot) => (
                        <option value={lot.id} key={lot.id}>
                          {lot.lotNumber} · {lot.product.name} · saldo {lot.quantity} {lot.product.unit}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      <span>Tipo de movimentação</span>
                      <select
                        name="type"
                        value={movementType}
                        onChange={(event) => {
                          setMovementType(event.target.value);
                          if (event.target.value === "TRANSFERENCIA") {
                            setMovementQuantity(selectedLot?.quantity ?? "");
                          } else {
                            setMovementQuantity("");
                          }
                        }}
                      >
                        <option value="ENTRADA">Entrada</option>
                        <option value="SAIDA">Saída</option>
                        <option value="TRANSFERENCIA">Transferência</option>
                        <option value="AJUSTE">Ajuste</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>
                        {movementType === "AJUSTE"
                          ? "Ajuste de quantidade (+ ou -)"
                          : movementType === "TRANSFERENCIA"
                            ? "Saldo integral a transferir"
                            : "Quantidade"}
                      </span>
                      <input
                        name="quantity"
                        type="number"
                        min={movementType === "AJUSTE" ? "-99999999.99" : "0.01"}
                        max="99999999.99"
                        step="0.01"
                        value={
                          movementType === "TRANSFERENCIA"
                            ? selectedLot?.quantity ?? ""
                            : movementQuantity
                        }
                        onChange={(event) => setMovementQuantity(event.target.value)}
                        readOnly={movementType === "TRANSFERENCIA"}
                        required
                      />
                    </label>
                  </div>
                  {movementType === "TRANSFERENCIA" && (
                    <label className="field">
                      <span>Paiol de destino</span>
                      <select name="destinationMagazineId" required defaultValue="">
                        <option value="" disabled>Selecione</option>
                        {destinationMagazines.map((magazine) => (
                          <option value={magazine.id} key={magazine.id}>
                            {magazine.name} · {magazine.remainingNeqKg} kg NEQ livres
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    <span>Referência (opcional)</span>
                    <input name="reference" maxLength={100} />
                  </label>
                  <p className="form-hint">
                    Ajustes e transferências preservam o histórico. Saídas e
                    transferências podem ser bloqueadas por reservas, validade
                    ou capacidade do destino.
                  </p>
                </>
              )}
            </>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button
              className="button button--quiet"
              type="button"
              disabled={submitting}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={submitting || (type === "lot" && (!availableProducts.length || !magazines.length)) || (type === "movement" && !lots.length)}
            >
              {submitting ? "Salvando..." : type === "lot" ? "Receber lote" : type === "movement" ? "Registrar movimentação" : "Salvar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
