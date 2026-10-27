"use client";

import { useState, type FormEvent } from "react";
import {
  ApiError,
  inventoryApi,
  type Magazine,
  type Product,
  type ProductLot,
} from "@/lib/api";
import {
  CreateProductForm,
  CreateMagazineForm,
  CreateLotForm,
  CreateMovementForm,
} from "./inventory";

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
    <div
      className="form-scrim"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
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
            <CreateProductForm
              productType={productType}
              isPce={isPce}
              onProductTypeChange={setProductType}
              onIsPceChange={setIsPce}
            />
          )}

          {type === "magazine" && <CreateMagazineForm />}

          {type === "lot" && (
            <CreateLotForm
              availableProducts={availableProducts}
              magazines={magazines}
            />
          )}

          {type === "movement" && (
            <CreateMovementForm
              lots={lots}
              destinationMagazines={destinationMagazines}
              selectedLot={selectedLot}
              selectedLotId={selectedLotId}
              movementType={movementType}
              movementQuantity={movementQuantity}
              onLotChange={setSelectedLotId}
              onMovementTypeChange={setMovementType}
              onQuantityChange={setMovementQuantity}
            />
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
              disabled={
                submitting ||
                (type === "lot" && (!availableProducts.length || !magazines.length)) ||
                (type === "movement" && !lots.length)
              }
            >
              {submitting
                ? "Salvando..."
                : type === "lot"
                  ? "Receber lote"
                  : type === "movement"
                    ? "Registrar movimentação"
                    : "Salvar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
