"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  inventoryApi,
  procurementApi,
  type Magazine,
  type PageResult,
  type Product,
  type Purchase,
  type PurchaseStatus,
  type Supplier,
} from "@/lib/api";
import { formatCurrency, formatDateOnly, formatNumber } from "@/lib/format";

const PCE_CLASSES = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];

const STATUS_LABELS: Record<PurchaseStatus, string> = {
  PENDENTE: "Pendente",
  PARCIAL: "Parcial",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
};

const STATUS_TONES: Record<PurchaseStatus, string> = {
  PENDENTE: "neutral",
  PARCIAL: "warning",
  RECEBIDO: "available",
  CANCELADO: "error",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function PurchasesWorkspace() {
  const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");

  // Dados de Compras
  const [purchases, setPurchases] = useState<PageResult<Purchase> | null>(null);
  const [suppliers, setSuppliers] = useState<PageResult<Supplier> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [magazines, setMagazines] = useState<Magazine[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Modal Novo Fornecedor
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supLegalName, setSupLegalName] = useState("");
  const [supTaxId, setSupTaxId] = useState("");
  const [supHasCr, setSupHasCr] = useState(false);
  const [supCrNumber, setSupCrNumber] = useState("");
  const [supCrExpiresAt, setSupCrExpiresAt] = useState("");
  const [supAuthorizedClasses, setSupAuthorizedClasses] = useState<string[]>([]);
  const [supSubmitting, setSupSubmitting] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);

  // Modal Novo Pedido de Compra
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{ productId: string; quantity: number; unitCost: number }>
  >([{ productId: "", quantity: 1, unitCost: 0 }]);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Modal de Recebimento de Compra
  const [receivingPurchase, setReceivingPurchase] = useState<Purchase | null>(null);
  const [receiveDueDate, setReceiveDueDate] = useState("");
  const [receiveInvoiceRef, setReceiveInvoiceRef] = useState("");
  const [receiveBatches, setReceiveBatches] = useState<
    Array<{
      productId: string;
      magazineId: string;
      lotNumber: string;
      quantity: number;
      manufacturedAt: string;
      expiresAt: string;
      manufacturerOrImporter: string;
    }>
  >([]);
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  // Carregamento de dados
  useEffect(() => {
    let current = true;
    const reqs: [
      Promise<PageResult<Purchase>>,
      Promise<PageResult<Supplier>>,
      Promise<PageResult<Product>>,
      Promise<PageResult<Magazine>>,
    ] = [
      procurementApi.getPurchases(page, statusFilter || undefined),
      procurementApi.getSuppliers(1, search),
      inventoryApi.getProducts(1),
      inventoryApi.getMagazines(1),
    ];

    void Promise.allSettled(reqs)
      .then(([purchasesRes, suppliersRes, productsRes, magazinesRes]) => {
        if (!current) return;
        if (purchasesRes.status === "fulfilled") setPurchases(purchasesRes.value);
        if (suppliersRes.status === "fulfilled") setSuppliers(suppliersRes.value);
        if (productsRes.status === "fulfilled") setProducts(productsRes.value.data);
        if (magazinesRes.status === "fulfilled") setMagazines(magazinesRes.value.data);
      })
      .catch((err: unknown) => {
        if (current) setError(errorMessage(err));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [page, statusFilter, search, reloadTrigger]);

  function handleOpenNewSupplier() {
    setSupLegalName("");
    setSupTaxId("");
    setSupHasCr(false);
    setSupCrNumber("");
    setSupCrExpiresAt("");
    setSupAuthorizedClasses([]);
    setSupError(null);
    setIsSupplierModalOpen(true);
  }

  async function handleSaveSupplier(e: FormEvent) {
    e.preventDefault();
    setSupSubmitting(true);
    setSupError(null);
    try {
      await procurementApi.createSupplier({
        legalName: supLegalName.trim(),
        taxId: supTaxId.replace(/\D/g, ""),
        hasCr: supHasCr,
        crNumber: supHasCr ? supCrNumber.trim() : null,
        crExpiresAt: supHasCr && supCrExpiresAt ? supCrExpiresAt : null,
        authorizedPceClasses: supHasCr ? supAuthorizedClasses : [],
      });
      setIsSupplierModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setSupError(errorMessage(err));
    } finally {
      setSupSubmitting(false);
    }
  }

  function handleOpenNewOrder() {
    setSelectedSupplierId(suppliers?.data[0]?.id || "");
    setOrderNotes("");
    setOrderItems([{ productId: products[0]?.id || "", quantity: 1, unitCost: 0 }]);
    setOrderError(null);
    setIsOrderModalOpen(true);
  }

  async function handleSaveOrder(e: FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId || orderItems.length === 0) return;
    setOrderSubmitting(true);
    setOrderError(null);
    try {
      await procurementApi.createPurchase({
        supplierId: selectedSupplierId,
        notes: orderNotes.trim() || undefined,
        items: orderItems.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitCost: Number(item.unitCost),
        })),
      });
      setIsOrderModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setOrderError(errorMessage(err));
    } finally {
      setOrderSubmitting(false);
    }
  }

  function handleOpenReceive(p: Purchase) {
    setReceivingPurchase(p);
    const today = new Date().toISOString().slice(0, 10);
    setReceiveDueDate(today);
    setReceiveInvoiceRef("");
    // Sugere recebimento para os itens que faltam receber
    const defaultBatches = p.items
      .filter((item) => Number(item.quantity) > Number(item.receivedQuantity))
      .map((item) => ({
        productId: item.productId,
        magazineId: magazines[0]?.id || "",
        lotNumber: `LOTE-${Date.now().toString().slice(-6)}`,
        quantity: Number(item.quantity) - Number(item.receivedQuantity),
        manufacturedAt: today,
        expiresAt: today,
        manufacturerOrImporter: p.supplier?.legalName || "Fabricante",
      }));
    setReceiveBatches(defaultBatches);
    setReceiveError(null);
  }

  async function handleConfirmReceive(e: FormEvent) {
    e.preventDefault();
    if (!receivingPurchase || receiveBatches.length === 0) return;
    setReceiveSubmitting(true);
    setReceiveError(null);
    try {
      await procurementApi.receivePurchase(receivingPurchase.id, {
        dueDate: receiveDueDate,
        invoiceReference: receiveInvoiceRef.trim() || undefined,
        batches: receiveBatches,
      });
      setReceivingPurchase(null);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setReceiveError(errorMessage(err));
    } finally {
      setReceiveSubmitting(false);
    }
  }

  async function handleCancelOrder(id: string) {
    if (!window.confirm("Deseja realmente cancelar este pedido de compra?")) return;
    try {
      await procurementApi.cancelPurchase(id);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão de Suprimentos</p>
          <h1 className="text-2xl font-bold">Compras e Fornecedores</h1>
          <p className="text-sm text-neutral-400">
            Pedidos de compra de insumos e mercadorias, fornecedores auditados e recebimento físico em paióis.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "purchases" ? (
            <button
              className="button button--primary flex items-center gap-2"
              onClick={handleOpenNewOrder}
            >
              <Icon name="briefcase" size={18} />
              Novo pedido de compra
            </button>
          ) : (
            <button
              className="button button--primary flex items-center gap-2"
              onClick={handleOpenNewSupplier}
            >
              <Icon name="users" size={18} />
              Novo fornecedor
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 gap-4">
        <button
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "purchases"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
          onClick={() => setTab("purchases")}
        >
          Pedidos de Compra
        </button>
        <button
          className={`pb-3 font-medium text-sm border-b-2 transition-colors ${
            tab === "suppliers"
              ? "border-primary-500 text-primary-400"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
          onClick={() => setTab("suppliers")}
        >
          Fornecedores
        </button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {tab === "purchases" ? (
        <div className="space-y-4">
          {/* Filtros de compras */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as PurchaseStatus | "");
                setPage(1);
              }}
              className="input w-48 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="PENDENTE">Pendente</option>
              <option value="PARCIAL">Recebimento Parcial</option>
              <option value="RECEBIDO">Recebido Total</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Tabela de Compras */}
          <div className="panel p-0 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-neutral-400">Carregando pedidos de compra...</div>
            ) : !purchases || purchases.data.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">Nenhum pedido de compra encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Fornecedor</th>
                      <th className="p-3">Itens</th>
                      <th className="p-3">Valor Total</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {purchases.data.map((p) => (
                      <tr key={p.id} className="hover:bg-neutral-800/30">
                        <td className="p-3 text-xs text-neutral-400">
                          {formatDateOnly(p.createdAt)}
                        </td>
                        <td className="p-3 font-semibold text-neutral-100">
                          {p.supplier?.legalName || "Fornecedor s/ nome"}
                        </td>
                        <td className="p-3 text-xs">
                          {p.items.map((it, i) => (
                            <div key={i} className="text-neutral-300">
                              {it.product?.name || "Produto"}: {formatNumber(Number(it.receivedQuantity))}/
                              {formatNumber(Number(it.quantity))} {it.product?.unit}
                            </div>
                          ))}
                        </td>
                        <td className="p-3 font-mono font-bold text-neutral-100">
                          {formatCurrency(Number(p.totalAmount))}
                        </td>
                        <td className="p-3">
                          <span className={`status-pill status-pill--${STATUS_TONES[p.status]}`}>
                            {STATUS_LABELS[p.status]}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(p.status === "PENDENTE" || p.status === "PARCIAL") && (
                              <>
                                <button
                                  className="button button--primary text-xs py-1 px-2.5"
                                  onClick={() => handleOpenReceive(p)}
                                >
                                  Receber Lote
                                </button>
                                {p.status === "PENDENTE" && (
                                  <button
                                    className="button button--ghost text-xs py-1 px-2 text-rose-400"
                                    onClick={() => handleCancelOrder(p.id)}
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Aba Fornecedores */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Buscar fornecedores por razão social ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full max-w-md"
            />
          </div>

          <div className="panel p-0 overflow-hidden">
            {!suppliers || suppliers.data.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">Nenhum fornecedor cadastrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full text-left text-sm">
                  <thead className="bg-neutral-800/50 text-neutral-300">
                    <tr>
                      <th className="p-3">Razão Social</th>
                      <th className="p-3">CNPJ / CPF</th>
                      <th className="p-3">Certificado de Registro (CR)</th>
                      <th className="p-3">Classes PCE</th>
                      <th className="p-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {suppliers.data.map((s) => (
                      <tr key={s.id} className="hover:bg-neutral-800/30">
                        <td className="p-3 font-semibold text-neutral-100">{s.legalName}</td>
                        <td className="p-3 font-mono text-xs">{s.taxId}</td>
                        <td className="p-3">
                          {s.hasCr ? (
                            <div>
                              <span className="font-mono text-xs text-emerald-400">
                                {s.crNumber || "CR s/ nº"}
                              </span>
                              {s.crExpiresAt && (
                                <div className="text-xs text-neutral-400">
                                  Vence: {formatDateOnly(s.crExpiresAt)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-500">Sem CR</span>
                          )}
                        </td>
                        <td className="p-3">
                          {s.authorizedPceClasses && s.authorizedPceClasses.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.authorizedPceClasses.map((cls) => (
                                <span
                                  key={cls}
                                  className="px-1.5 py-0.5 text-[11px] rounded bg-neutral-800 border border-neutral-700"
                                >
                                  {cls}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`status-pill ${
                              s.active ? "status-pill--available" : "status-pill--neutral"
                            }`}
                          >
                            {s.active ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Novo Fornecedor */}
      {isSupplierModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full space-y-4">
            <h2 className="text-xl font-bold">Novo Fornecedor</h2>
            <form className="form-stack space-y-3" onSubmit={handleSaveSupplier}>
              <label className="field">
                <span>Razão Social *</span>
                <input
                  type="text"
                  required
                  value={supLegalName}
                  onChange={(e) => setSupLegalName(e.target.value)}
                />
              </label>

              <label className="field">
                <span>CNPJ ou CPF (apenas dígitos) *</span>
                <input
                  type="text"
                  required
                  maxLength={18}
                  value={supTaxId}
                  onChange={(e) => setSupTaxId(e.target.value)}
                />
              </label>

              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-md space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={supHasCr}
                    onChange={(e) => setSupHasCr(e.target.checked)}
                  />
                  <span>Fornecedor possui Certificado de Registro (CR)</span>
                </label>

                {supHasCr && (
                  <div className="space-y-3 pt-2 border-t border-neutral-800">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="field">
                        <span>Nº do CR *</span>
                        <input
                          type="text"
                          required={supHasCr}
                          value={supCrNumber}
                          onChange={(e) => setSupCrNumber(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Validade do CR *</span>
                        <input
                          type="date"
                          required={supHasCr}
                          value={supCrExpiresAt}
                          onChange={(e) => setSupCrExpiresAt(e.target.value)}
                        />
                      </label>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-neutral-400 block mb-1">
                        Classes PCE Autorizadas:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {PCE_CLASSES.map((cls) => {
                          const selected = supAuthorizedClasses.includes(cls);
                          return (
                            <button
                              type="button"
                              key={cls}
                              onClick={() =>
                                setSupAuthorizedClasses((prev) =>
                                  prev.includes(cls)
                                    ? prev.filter((item) => item !== cls)
                                    : [...prev, cls],
                                )
                              }
                              className={`px-2 py-1 text-xs rounded border ${
                                selected
                                  ? "bg-primary-600 border-primary-500 text-white font-bold"
                                  : "bg-neutral-800 border-neutral-700 text-neutral-300"
                              }`}
                            >
                              {cls}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {supError && <p className="form-error text-xs" role="alert">{supError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsSupplierModalOpen(false)}
                  disabled={supSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={supSubmitting}
                >
                  {supSubmitting ? "Salvando..." : "Salvar Fornecedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Pedido de Compra */}
      {isOrderModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold">Novo Pedido de Compra</h2>
            <form className="form-stack space-y-3" onSubmit={handleSaveOrder}>
              <label className="field">
                <span>Fornecedor *</span>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="input"
                >
                  {suppliers?.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.legalName} ({s.taxId})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Observações / Instruções</span>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </label>

              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Itens do Pedido:</span>
                  <button
                    type="button"
                    className="button button--ghost text-xs py-1 px-2"
                    onClick={() =>
                      setOrderItems((prev) => [
                        ...prev,
                        { productId: products[0]?.id || "", quantity: 1, unitCost: 0 },
                      ])
                    }
                  >
                    + Adicionar item
                  </button>
                </div>

                {orderItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-2 p-2 bg-neutral-900 border border-neutral-800 rounded items-center"
                  >
                    <div className="col-span-6">
                      <select
                        value={item.productId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOrderItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, productId: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOrderItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, quantity: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Custo"
                        value={item.unitCost}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setOrderItems((prev) =>
                            prev.map((it, idx) =>
                              idx === index ? { ...it, unitCost: val } : it,
                            ),
                          );
                        }}
                        className="input text-xs w-full"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      {orderItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setOrderItems((prev) =>
                              prev.filter((_, idx) => idx !== index),
                            )
                          }
                          className="text-rose-400 hover:text-rose-300 font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {orderError && <p className="form-error text-xs" role="alert">{orderError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsOrderModalOpen(false)}
                  disabled={orderSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={orderSubmitting}
                >
                  {orderSubmitting ? "Emitindo..." : "Emitir Pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Recebimento de Compra */}
      {receivingPurchase && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold">Recebimento Físico de Lotes</h2>
            <p className="text-xs text-neutral-400">
              Registrar entrada de mercadorias no estoque e criar automaticamente a respectiva conta a pagar.
            </p>
            <form className="form-stack space-y-3" onSubmit={handleConfirmReceive}>
              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Vencimento da Conta a Pagar *</span>
                  <input
                    type="date"
                    required
                    value={receiveDueDate}
                    onChange={(e) => setReceiveDueDate(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Nota Fiscal / Chave de Acesso</span>
                  <input
                    type="text"
                    placeholder="Ex: NF-e 001.234"
                    value={receiveInvoiceRef}
                    onChange={(e) => setReceiveInvoiceRef(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-800">
                <span className="text-sm font-semibold block">Lotes a Dar Entrada:</span>
                {receiveBatches.map((batch, index) => {
                  const product = products.find((p) => p.id === batch.productId);
                  return (
                    <div
                      key={index}
                      className="p-3 bg-neutral-900 border border-neutral-800 rounded space-y-2 text-xs"
                    >
                      <div className="font-semibold text-neutral-200">
                        Produto: {product?.name || batch.productId}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="field">
                          <span>Nº do Lote *</span>
                          <input
                            type="text"
                            required
                            value={batch.lotNumber}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveBatches((prev) =>
                                prev.map((b, idx) =>
                                  idx === index ? { ...b, lotNumber: val } : b,
                                ),
                              );
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Quantidade *</span>
                          <input
                            type="number"
                            min="1"
                            required
                            value={batch.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setReceiveBatches((prev) =>
                                prev.map((b, idx) =>
                                  idx === index ? { ...b, quantity: val } : b,
                                ),
                              );
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Paiol de Destino *</span>
                          <select
                            value={batch.magazineId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveBatches((prev) =>
                                prev.map((b, idx) =>
                                  idx === index ? { ...b, magazineId: val } : b,
                                ),
                              );
                            }}
                            className="input"
                          >
                            {magazines.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.remainingNeqKg} kg disp.)
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <label className="field">
                          <span>Fabricação *</span>
                          <input
                            type="date"
                            required
                            value={batch.manufacturedAt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveBatches((prev) =>
                                prev.map((b, idx) =>
                                  idx === index ? { ...b, manufacturedAt: val } : b,
                                ),
                              );
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Validade *</span>
                          <input
                            type="date"
                            required
                            value={batch.expiresAt}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveBatches((prev) =>
                                prev.map((b, idx) =>
                                  idx === index ? { ...b, expiresAt: val } : b,
                                ),
                              );
                            }}
                          />
                        </label>
                        <label className="field">
                          <span>Fabricante / Importador *</span>
                          <input
                            type="text"
                            required
                            value={batch.manufacturerOrImporter}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReceiveBatches((prev) =>
                                prev.map((b, idx) =>
                                  idx === index
                                    ? { ...b, manufacturerOrImporter: val }
                                    : b,
                                ),
                              );
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {receiveError && <p className="form-error text-xs" role="alert">{receiveError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setReceivingPurchase(null)}
                  disabled={receiveSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={receiveSubmitting}
                >
                  {receiveSubmitting ? "Recebendo..." : "Confirmar Recebimento e Gerar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

