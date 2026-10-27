"use client";

import type { ServiceOrder } from "@/lib/api";
import { formatCurrency, formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";
import { OrderStepper } from "./lifecycle-ruler";
import { STATUS_LABELS, STATUS_TONES } from "./types";

interface OrderDetailsPaneProps {
  order: ServiceOrder;
  pixLoading: boolean;
  onOpenEditOrder: (order: ServiceOrder) => void;
  onOpenAction: (action: "approve" | "start" | "cancel" | "close") => void;
  onOpenGtModal: () => void;
  onOpenNfseModal: () => void;
  onOpenPixModal: () => void;
  onOpenBurningOrderModal: () => void;
  onSetFiredQuantities: (fired: Record<string, string>) => void;
}

export function OrderDetailsPane({
  order,
  pixLoading,
  onOpenEditOrder,
  onOpenAction,
  onOpenGtModal,
  onOpenNfseModal,
  onOpenPixModal,
  onOpenBurningOrderModal,
  onSetFiredQuantities,
}: OrderDetailsPaneProps) {
  return (
    <section
      className="operations-panel panel operations-detail"
      aria-labelledby="order-detail-heading"
    >
      <div className="operations-toolbar">
        <div>
          <p className="eyebrow">Detalhes da ordem</p>
          <h2 id="order-detail-heading">Ordem #{order.code}</h2>
        </div>
        <div className="operations-detail__actions">
          <span className={`status-pill status-pill--${STATUS_TONES[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          {order.status === "ORCAMENTO" && (
            <>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => onOpenEditOrder(order)}
              >
                Editar orçamento
              </button>
              <button
                className="button button--primary"
                type="button"
                onClick={() => onOpenAction("approve")}
              >
                Aprovar orçamento
              </button>
            </>
          )}
          {order.status === "APROVADO" && (
            <button
              className="button button--primary"
              type="button"
              onClick={() => onOpenAction("start")}
            >
              Iniciar montagem
            </button>
          )}
          {(order.status === "ORCAMENTO" ||
            order.status === "APROVADO" ||
            order.status === "EM_MONTAGEM") && (
            <button
              className="button button--danger"
              type="button"
              onClick={() => onOpenAction("cancel")}
            >
              Cancelar
            </button>
          )}
          {order.status === "EM_MONTAGEM" && (
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                onSetFiredQuantities(
                  Object.fromEntries(
                    order.items.map((item) => [
                      item.id,
                      item.plannedQuantity,
                    ]),
                  ),
                );
                onOpenAction("close");
              }}
            >
              Concluir ordem
            </button>
          )}
          {/* Elo 1: Emitir GT a partir de OS Aprovada ou em Montagem */}
          {(order.status === "APROVADO" ||
            order.status === "EM_MONTAGEM") && (
            <button
              className="button button--secondary border-blue-500/40 text-blue-300 hover:bg-blue-500/10 flex items-center gap-1.5"
              type="button"
              onClick={onOpenGtModal}
              title="Emitir Guia de Tráfego do Exército Brasileiro para transporte dos PCEs desta OS"
            >
              <span>🚚</span> Emitir Guia de Tráfego (GT)
            </button>
          )}
          {/* Elo 2 e 3: Faturamento e Liquidação de OS Concluída */}
          {order.status === "CONCLUIDO" && (
            <>
              <button
                className="button button--secondary border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-1.5"
                type="button"
                onClick={onOpenNfseModal}
                title="Emitir Nota Fiscal de Serviços Pirotécnicos (NFS-e)"
              >
                <span>📄</span> Emitir NFS-e
              </button>
              <button
                className="button button--secondary border-teal-500/40 text-teal-300 hover:bg-teal-500/10 flex items-center gap-1.5"
                type="button"
                onClick={onOpenPixModal}
                disabled={pixLoading}
                title="Cobrança Instantânea via QR Code PIX"
              >
                <span>📱</span> Receber via PIX
              </button>
            </>
          )}
          {/* Ordem de Queima e Ficha Técnica de Campo Impressa */}
          <button
            className="button button--secondary border-amber-500/40 text-amber-300 hover:bg-amber-500/10 flex items-center gap-1.5"
            type="button"
            onClick={onOpenBurningOrderModal}
            title="Visualizar e Imprimir Ficha Técnica de Montagem e Ordem de Queima para a Equipe de Campo"
          >
            <span>📋</span> Ordem de Queima (Campo)
          </button>
        </div>
      </div>

      <OrderStepper order={order} />

      <dl className="operations-detail__facts">
        <div>
          <dt>Cliente</dt>
          <dd>{order.customer.legalName}</dd>
        </div>
        <div>
          <dt>Evento</dt>
          <dd>{formatDateTime(order.eventAt)}</dd>
        </div>
        <div>
          <dt>Local</dt>
          <dd>{order.eventLocation}</dd>
        </div>
        <div>
          <dt>Valor contratado</dt>
          <dd>{formatCurrency(Number(order.contractedAmount))}</dd>
        </div>
        <div>
          <dt>Blaster responsável</dt>
          <dd>
            {order.responsibleBlaster?.name ?? "Ainda não definido"}
          </dd>
        </div>
        <div>
          <dt>CR do cliente</dt>
          <dd>
            {order.customer.hasCr
              ? `Cadastrado · validade ${
                  order.customer.crExpiresAt
                    ? formatDateOnly(order.customer.crExpiresAt)
                    : "não informada"
                }`
              : "Não cadastrado"}
          </dd>
        </div>
        {(order.customer.authorizedPceClasses?.length ?? 0) > 0 && (
          <div>
            <dt>Classes PCE autorizadas</dt>
            <dd>{order.customer.authorizedPceClasses.join(", ")}</dd>
          </div>
        )}
        <div>
          <dt>Reserva NEQ</dt>
          <dd>
            {formatNumber(Number(order.reservedNeqKg))} kg{" "}
            {order.reservationActive ? "· ativa" : "· inativa"}
          </dd>
        </div>
        {order.artNumber && (
          <div>
            <dt>ART</dt>
            <dd>{order.artNumber}</dd>
          </div>
        )}
        {order.dueDate && (
          <div>
            <dt>Vencimento</dt>
            <dd>{formatDateOnly(order.dueDate)}</dd>
          </div>
        )}
      </dl>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Produto / lote</th>
              <th>Paiol</th>
              <th>Planejado</th>
              <th>Disparado</th>
              <th>NEQ</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.product.name}</strong>
                  <small>Lote {item.productLot.lotNumber}</small>
                </td>
                <td>{item.productLot.magazine.name}</td>
                <td>
                  {formatNumber(Number(item.plannedQuantity))}{" "}
                  {item.product.unit}
                </td>
                <td>
                  {item.firedQuantity === null
                    ? "—"
                    : `${formatNumber(Number(item.firedQuantity))} ${item.product.unit}`}
                </td>
                <td>{formatNumber(Number(item.neqKg))} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {order.reportNotes && (
        <p className="operations-notes">
          <strong>Notas de encerramento:</strong> {order.reportNotes}
        </p>
      )}
    </section>
  );
}
