"use client";

import type { FormEvent } from "react";
import { Icon } from "@/components/icon";
import type {
  OperationalBlaster,
  OperationalCustomer,
  OperationalLot,
  ServiceOrder,
} from "@/lib/api";
import type { OrderAction, OrderDraftItem } from "./types";
import { OrderBudgetActionPane } from "./order-budget-action-pane";
import { OrderApproveActionPane } from "./order-approve-action-pane";
import { OrderTransitionActionPane } from "./order-transition-action-pane";
import { OrderClosingActionPane } from "./order-closing-action-pane";

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
        <OrderBudgetActionPane
          action={action}
          customerId={customerId}
          onCustomerIdChange={onCustomerIdChange}
          selectedCustomer={selectedCustomer}
          customers={customers}
          contractedAmount={contractedAmount}
          onContractedAmountChange={onContractedAmountChange}
          eventAt={eventAt}
          onEventAtChange={onEventAtChange}
          eventLocation={eventLocation}
          onEventLocationChange={onEventLocationChange}
          draftItems={draftItems}
          onDraftItemsChange={onDraftItemsChange}
          lots={lots}
          selectedLotIds={selectedLotIds}
          onSubmitCreate={onSubmitCreate}
          onSubmitEdit={onSubmitEdit}
          onClose={onClose}
          submitting={submitting}
          referencesLoading={referencesLoading}
        />
      )}

      {action === "approve" && selected && !referencesLoading && (
        <OrderApproveActionPane
          blasterId={blasterId}
          onBlasterIdChange={onBlasterIdChange}
          blasters={blasters}
          artNumber={artNumber}
          onArtNumberChange={onArtNumberChange}
          onSubmitApprove={onSubmitApprove}
          onClose={onClose}
          submitting={submitting}
        />
      )}

      {(action === "start" || action === "cancel") && selected && (
        <OrderTransitionActionPane
          action={action}
          onSubmitTransition={onSubmitTransition}
          onClose={onClose}
          submitting={submitting}
        />
      )}

      {action === "close" && selected && (
        <OrderClosingActionPane
          selected={selected}
          dueDate={dueDate}
          onDueDateChange={onDueDateChange}
          reportNotes={reportNotes}
          onReportNotesChange={onReportNotesChange}
          firedQuantities={firedQuantities}
          onFiredQuantitiesChange={onFiredQuantitiesChange}
          onSubmitTransition={onSubmitTransition}
          onClose={onClose}
          submitting={submitting}
        />
      )}
    </section>
  );
}
