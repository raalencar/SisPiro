"use client";

import type { FormEvent } from "react";
import { Icon } from "@/components/icon";
import type {
  OperationalBlaster,
  OperationalCustomer,
  OperationalLot,
  ServiceOrder,
} from "@/lib/api";
import { formatDateOnly, formatNumber } from "@/lib/format";
import {
  isUsableLot,
  localDateTime,
  type OrderAction,
  type OrderDraftItem,
} from "./types";

interface OrderActionCardProps {
  action: OrderAction | null;
  selected: ServiceOrder | null;
  onClose: () => void;
  referencesLoading: boolean;
  actionError: string | null;
  onReloadReferences: () => Promise<void>;
  // Create / Edit
  customerId: string;
  onCustomerIdChange: (id: string) => void;
  selectedCustomer?: OperationalCustomer;
  customers: OperationalCustomer[];
  contractedAmount: string;
  onContractedAmountChange: (amount: string) => void;
  eventAt: string;
  onEventAtChange: (at: string) => void;
  eventLocation: string;
  onEventLocationChange: (loc: string) => void;
  draftItems: OrderDraftItem[];
  onDraftItemsChange: React.Dispatch<React.SetStateAction<OrderDraftItem[]>>;
  lots: OperationalLot[];
  selectedLotIds: string[];
  onSubmitCreate: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onSubmitEdit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  // Approve
  blasterId: string;
  onBlasterIdChange: (id: string) => void;
  blasters: OperationalBlaster[];
  artNumber: string;
  onArtNumberChange: (art: string) => void;
  onSubmitApprove: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  // Transition (Start / Cancel / Close)
  dueDate: string;
  onDueDateChange: (date: string) => void;
  reportNotes: string;
  onReportNotesChange: (notes: string) => void;
  firedQuantities: Record<string, string>;
  onFiredQuantitiesChange: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  onSubmitTransition: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  submitting: boolean;
}

export function OrderActionCard({
  action,
  selected,
  onClose,
  referencesLoading,
  actionError,
  onReloadReferences,
  customerId,
  onCustomerIdChange,
  selectedCustomer,
  customers,
  contractedAmount,
  onContractedAmountChange,
  eventAt,
  onEventAtChange,
  eventLocation,
  onEventLocationChange,
  draftItems,
  onDraftItemsChange,
  lots,
  selectedLotIds,
  onSubmitCreate,
  onSubmitEdit,
  blasterId,
  onBlasterIdChange,
  blasters,
  artNumber,
  onArtNumberChange,
  onSubmitApprove,
  dueDate,
  onDueDateChange,
  reportNotes,
  onReportNotesChange,
  firedQuantities,
  onFiredQuantitiesChange,
  onSubmitTransition,
  submitting,
}: OrderActionCardProps) {
  if (!action) return null;

  return (
    <section
      className="operations-action panel"
      aria-labelledby="operations-action-heading"
    >
      <div className="operations-toolbar">
        <div>
          <p className="eyebrow">Ação da ordem</p>
          <h2 id="operations-action-heading">
            {action === "create"
              ? "Criar orçamento de serviço"
              : action === "edit"
                ? `Editar orçamento #${selected?.code}`
                : action === "approve"
                  ? `Aprovar ordem #${selected?.code}`
                  : action === "start"
                    ? `Iniciar montagem da ordem #${selected?.code}`
                    : action === "cancel"
                      ? `Cancelar ordem #${selected?.code}`
                      : `Concluir ordem #${selected?.code}`}
          </h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Fechar formulário"
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      {referencesLoading && (
        <p className="table-empty" role="status">
          Carregando clientes, blasters e lotes...
        </p>
      )}
      {actionError && (
        <div
          className="inventory-alert inventory-alert--error"
          role="alert"
        >
          <span>{actionError}</span>
          {(action === "create" || action === "edit" || action === "approve") && (
            <button
              className="button button--quiet"
              type="button"
              onClick={() => void onReloadReferences()}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {(action === "create" || action === "edit") && !referencesLoading && (
        <form
          className="operations-form"
          onSubmit={(event) => void (action === "edit" ? onSubmitEdit(event) : onSubmitCreate(event))}
        >
          <div className="operations-form__grid">
            <label className="operations-form__wide">
              Cliente
              <select
                required
                value={customerId}
                onChange={(event) => onCustomerIdChange(event.target.value)}
              >
                <option value="">Selecione um cliente ativo</option>
                {customers
                  .filter((customer) => customer.active)
                  .map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.legalName}
                      {customer.hasCr ? " · CR cadastrado" : " · sem CR"}
                    </option>
                  ))}
              </select>
            </label>
            {selectedCustomer && (
              <p className="operations-form__wide operations-form__hint">
                {selectedCustomer.hasCr
                  ? `CR cadastrado${
                      selectedCustomer.crExpiresAt
                        ? ` · válido até ${formatDateOnly(
                            selectedCustomer.crExpiresAt,
                          )}`
                        : ""
                    }. Classes autorizadas: ${
                      selectedCustomer.authorizedPceClasses.join(", ") ||
                      "não informadas"
                    }.`
                  : "Cliente sem CR cadastrado; o backend validará a elegibilidade antes de reservar itens PCE."}
              </p>
            )}
            <label>
              Valor contratado (R$)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={contractedAmount}
                onChange={(event) =>
                  onContractedAmountChange(event.target.value)
                }
              />
            </label>
            <label>
              Data e hora do evento
              <input
                type="datetime-local"
                required
                min={localDateTime(0)}
                value={eventAt}
                onChange={(event) => onEventAtChange(event.target.value)}
              />
            </label>
            <label className="operations-form__wide">
              Local do evento
              <input
                maxLength={500}
                required
                value={eventLocation}
                onChange={(event) => onEventLocationChange(event.target.value)}
              />
            </label>
          </div>
          <div className="operations-form__section">
            <div className="operations-toolbar">
              <h3>Produtos e lotes</h3>
              <button
                className="button button--quiet"
                type="button"
                onClick={() =>
                  onDraftItemsChange((current) => [...current, { lotId: "", quantity: "" }])
                }
              >
                Adicionar item
              </button>
            </div>
            {draftItems.map((item, index) => {
              const lot = lots.find((entry) => entry.id === item.lotId);
              return (
                <div
                  className="operations-item-form"
                  key={`draft-${index}`}
                >
                  <label>
                    Lote
                    <select
                      required
                      value={item.lotId}
                      onChange={(event) =>
                        onDraftItemsChange((current) =>
                          current.map((line, row) =>
                            row === index
                              ? { ...line, lotId: event.target.value }
                              : line,
                          ),
                        )
                      }
                    >
                      <option value="">Selecione um lote</option>
                      {lots
                        .filter(
                          (candidate) =>
                            isUsableLot(candidate) &&
                            (candidate.id === item.lotId ||
                              !selectedLotIds.includes(candidate.id)),
                        )
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.product.name} · {candidate.lotNumber}{" "}
                            · {candidate.magazine.name} · físico{" "}
                            {formatNumber(Number(candidate.quantity))}{" "}
                            {candidate.product.unit}
                          </option>
                        ))}
                    </select>
                    {lot && (
                      <small>
                        Quantidade física do lote. A aprovação validará o
                        saldo realmente reservável e a validade.
                      </small>
                    )}
                  </label>
                  <label>
                    Quantidade planejada
                    <input
                      type="number"
                      min="0.01"
                      max={lot?.quantity}
                      step="0.01"
                      required
                      value={item.quantity}
                      onChange={(event) =>
                        onDraftItemsChange((current) =>
                          current.map((line, row) =>
                            row === index
                              ? { ...line, quantity: event.target.value }
                              : line,
                          ),
                        )
                      }
                    />
                  </label>
                  {draftItems.length > 1 && (
                    <button
                      className="button button--quiet"
                      type="button"
                      aria-label={`Remover item ${index + 1}`}
                      onClick={() =>
                        onDraftItemsChange((current) =>
                          current.filter((_, row) => row !== index),
                        )
                      }
                    >
                      Remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="operations-form__footer">
            <button
              className="button button--quiet"
              type="button"
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={submitting || referencesLoading}
            >
              {submitting
                ? "Salvando..."
                : action === "edit"
                  ? "Salvar alterações"
                  : "Criar orçamento"}
            </button>
          </div>
        </form>
      )}
      {action === "approve" && selected && !referencesLoading && (
        <form
          className="operations-form"
          onSubmit={(event) => void onSubmitApprove(event)}
        >
          <p>
            A aprovação verifica elegibilidade do cliente e do blaster e
            reserva os lotes de forma atômica.
          </p>
          <div className="operations-form__grid">
            <label className="operations-form__wide">
              Blaster responsável
              <select
                required
                value={blasterId}
                onChange={(event) => onBlasterIdChange(event.target.value)}
              >
                <option value="">Selecione um blaster ativo</option>
                {blasters
                  .filter((blaster) => blaster.active)
                  .map((blaster) => (
                    <option key={blaster.id} value={blaster.id}>
                      {blaster.name} · licença até{" "}
                      {formatDateOnly(blaster.licenseExpiresAt)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="operations-form__wide">
              Número da ART (opcional)
              <input
                maxLength={50}
                value={artNumber}
                onChange={(event) => onArtNumberChange(event.target.value)}
              />
            </label>
          </div>
          <div className="operations-form__footer">
            <button
              className="button button--quiet"
              type="button"
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Validando..." : "Aprovar e reservar"}
            </button>
          </div>
        </form>
      )}
      {(action === "start" || action === "cancel") && selected && (
        <form
          className="operations-form"
          onSubmit={(event) => void onSubmitTransition(event)}
        >
          <p>
            {action === "start"
              ? "A OS passará para montagem e manterá a reserva de estoque."
              : "A ordem será cancelada e, se houver reserva, o estoque será liberado."}
          </p>
          <div className="operations-form__footer">
            <button
              className="button button--quiet"
              type="button"
              onClick={onClose}
            >
              Voltar
            </button>
            <button
              className={
                action === "cancel"
                  ? "button button--danger"
                  : "button button--primary"
              }
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Processando..."
                : action === "start"
                  ? "Confirmar início"
                  : "Confirmar cancelamento"}
            </button>
          </div>
        </form>
      )}
      {action === "close" && selected && (
        <form
          className="operations-form"
          onSubmit={(event) => void onSubmitTransition(event)}
        >
          <p>
            Informe a quantidade efetivamente disparada. O backend baixa o
            consumo real, libera sobras e cria uma conta a receber pelo
            valor contratado.
          </p>
          <div className="operations-form__grid">
            <label>
              Vencimento da conta a receber
              <input
                type="date"
                required
                value={dueDate}
                onChange={(event) => onDueDateChange(event.target.value)}
              />
            </label>
            <label className="operations-form__wide">
              Notas do relatório
              <textarea
                maxLength={2000}
                rows={3}
                value={reportNotes}
                onChange={(event) => onReportNotesChange(event.target.value)}
              />
            </label>
          </div>
          <div className="operations-form__section">
            <h3>Quantidades disparadas</h3>
            {selected.items.map((item) => (
              <label className="operations-close-item" key={item.id}>
                <span>
                  <strong>{item.product.name}</strong>
                  <small>
                    Planejado: {formatNumber(Number(item.plannedQuantity))}{" "}
                    {item.product.unit}
                  </small>
                </span>
                <span>
                  {item.product.unit}
                  <input
                    type="number"
                    min="0"
                    max={item.plannedQuantity}
                    step="0.01"
                    required
                    value={firedQuantities[item.id] ?? item.plannedQuantity}
                    onChange={(event) =>
                      onFiredQuantitiesChange((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                  />
                </span>
              </label>
            ))}
          </div>
          <div className="operations-form__footer">
            <button
              className="button button--quiet"
              type="button"
              onClick={onClose}
            >
              Fechar
            </button>
            <button
              className="button button--primary"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Concluindo..."
                : "Concluir e registrar consumo"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
