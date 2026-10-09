"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  customersApi,
  type Customer,
  type CustomerEligibility,
  type PageResult,
} from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

const PCE_CLASSES = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function CustomersWorkspace() {
  const [customers, setCustomers] = useState<PageResult<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Modal de criação / edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hasCr, setHasCr] = useState(false);
  const [crNumber, setCrNumber] = useState("");
  const [crExpiresAt, setCrExpiresAt] = useState("");
  const [authorizedClasses, setAuthorizedClasses] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Verificador de elegibilidade PCE
  const [eligibilityCustomer, setEligibilityCustomer] = useState<Customer | null>(null);
  const [classesToCheck, setClassesToCheck] = useState<string[]>([]);
  const [eligibilityResult, setEligibilityResult] = useState<CustomerEligibility | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const [currentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let current = true;
    void customersApi
      .getCustomers(page, search)
      .then((result) => {
        if (current) setCustomers(result);
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
  }, [page, search, reloadTrigger]);

  function handleOpenCreate() {
    setEditingCustomer(null);
    setLegalName("");
    setTradeName("");
    setTaxId("");
    setEmail("");
    setPhone("");
    setHasCr(false);
    setCrNumber("");
    setCrExpiresAt("");
    setAuthorizedClasses([]);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(customer: Customer) {
    setEditingCustomer(customer);
    setLegalName(customer.legalName);
    setTradeName(customer.tradeName || "");
    setTaxId(customer.taxId);
    setEmail(customer.email || "");
    setPhone(customer.phone || "");
    setHasCr(customer.hasCr);
    setCrNumber(customer.crNumber || "");
    setCrExpiresAt(customer.crExpiresAt ? customer.crExpiresAt.slice(0, 10) : "");
    setAuthorizedClasses(customer.authorizedPceClasses || []);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSaveCustomer(event: FormEvent) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<Customer> = {
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || null,
        taxId: taxId.replace(/\D/g, ""),
        email: email.trim() || null,
        phone: phone.trim() || null,
        hasCr,
        crNumber: hasCr ? crNumber.trim() : null,
        crExpiresAt: hasCr && crExpiresAt ? crExpiresAt : null,
        authorizedPceClasses: hasCr ? authorizedClasses : [],
      };

      if (editingCustomer) {
        await customersApi.updateCustomer(editingCustomer.id, payload);
      } else {
        await customersApi.createCustomer(payload);
      }

      setIsModalOpen(false);
      setReloadTrigger((prev) => prev + 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleCheckEligibility(event: FormEvent) {
    event.preventDefault();
    if (!eligibilityCustomer || classesToCheck.length === 0) return;
    setCheckingEligibility(true);
    try {
      const result = await customersApi.checkPceEligibility(
        eligibilityCustomer.id,
        classesToCheck,
      );
      setEligibilityResult(result);
    } catch (err) {
      setEligibilityResult({ eligible: false, reasons: [errorMessage(err)] });
    } finally {
      setCheckingEligibility(false);
    }
  }

  function toggleClass(pceClass: string) {
    setAuthorizedClasses((prev) =>
      prev.includes(pceClass)
        ? prev.filter((item) => item !== pceClass)
        : [...prev, pceClass],
    );
  }

  function toggleCheckClass(pceClass: string) {
    setClassesToCheck((prev) =>
      prev.includes(pceClass)
        ? prev.filter((item) => item !== pceClass)
        : [...prev, pceClass],
    );
  }

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão de Clientes</p>
          <h1 className="text-2xl font-bold">Clientes e Controle de CR</h1>
          <p className="text-sm text-neutral-400">
            Cadastros com controle de Certificado de Registro (CR) do Exército e habilitação de classes PCE.
          </p>
        </div>
        <button
          className="button button--primary flex items-center gap-2"
          onClick={handleOpenCreate}
        >
          <Icon name="users" size={18} />
          Novo cliente
        </button>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Barra de busca e filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            type="search"
            placeholder="Buscar por razão social, fantasia ou CPF/CNPJ..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input w-full"
          />
        </div>
      </div>

      {/* Tabela de clientes */}
      <div className="panel p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Carregando clientes...</div>
        ) : !customers || customers.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-800/50 text-neutral-300">
                <tr>
                  <th className="p-3">Razão Social / Nome</th>
                  <th className="p-3">CPF/CNPJ</th>
                  <th className="p-3">Certificado de Registro (CR)</th>
                  <th className="p-3">Classes PCE</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {customers.data.map((c) => {
                  const crExpired =
                    Boolean(c.hasCr &&
                    c.crExpiresAt &&
                    c.crExpiresAt.slice(0, 10) < currentDate);
                  return (
                    <tr key={c.id} className="hover:bg-neutral-800/30">
                      <td className="p-3">
                        <div className="font-semibold text-neutral-100">
                          {c.legalName}
                        </div>
                        {c.tradeName && (
                          <div className="text-xs text-neutral-400">
                            {c.tradeName}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">{c.taxId}</td>
                      <td className="p-3">
                        {c.hasCr ? (
                          <div>
                            <span className="font-mono text-xs text-emerald-400">
                              {c.crNumber || "CR s/ nº"}
                            </span>
                            {c.crExpiresAt && (
                              <div
                                className={`text-xs ${
                                  crExpired ? "text-rose-400 font-bold" : "text-neutral-400"
                                }`}
                              >
                                Vence: {formatDateOnly(c.crExpiresAt)}
                                {crExpired && " (EXPIRADO)"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500">Sem CR</span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.authorizedPceClasses && c.authorizedPceClasses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.authorizedPceClasses.map((cls) => (
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
                            c.active ? "status-pill--available" : "status-pill--neutral"
                          }`}
                        >
                          {c.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="button button--ghost text-xs py-1 px-2"
                            onClick={() => {
                              setEligibilityCustomer(c);
                              setClassesToCheck(["1.3G"]);
                              setEligibilityResult(null);
                            }}
                            title="Validar elegibilidade PCE"
                          >
                            Checar CR
                          </button>
                          <button
                            className="button button--secondary text-xs py-1 px-2"
                            onClick={() => handleOpenEdit(c)}
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de cadastro / edição */}
      {isModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-bold">
              {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <form className="form-stack space-y-3" onSubmit={handleSaveCustomer}>
              <label className="field">
                <span>Razão Social / Nome completo *</span>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Nome Fantasia</span>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                />
              </label>

              <label className="field">
                <span>CPF ou CNPJ (apenas dígitos) *</span>
                <input
                  type="text"
                  required
                  maxLength={18}
                  disabled={Boolean(editingCustomer)}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Telefone</span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
              </div>

              {/* Seção de CR */}
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-md space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasCr}
                    onChange={(e) => setHasCr(e.target.checked)}
                  />
                  <span>Possui Certificado de Registro (CR) do Exército</span>
                </label>

                {hasCr && (
                  <div className="space-y-3 pt-2 border-t border-neutral-800">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="field">
                        <span>Número do CR *</span>
                        <input
                          type="text"
                          required={hasCr}
                          value={crNumber}
                          onChange={(e) => setCrNumber(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Validade do CR *</span>
                        <input
                          type="date"
                          required={hasCr}
                          value={crExpiresAt}
                          onChange={(e) => setCrExpiresAt(e.target.value)}
                        />
                      </label>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-neutral-400 block mb-1">
                        Classes PCE Autorizadas:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {PCE_CLASSES.map((cls) => {
                          const selected = authorizedClasses.includes(cls);
                          return (
                            <button
                              type="button"
                              key={cls}
                              onClick={() => toggleClass(cls)}
                              className={`px-2 py-1 text-xs rounded border ${
                                selected
                                  ? "bg-primary-600 border-primary-500 text-white font-bold"
                                  : "bg-neutral-800 border-neutral-700 text-neutral-300"
                              }`}
                            >
                              Classe {cls}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {formError && <p className="form-error text-xs" role="alert">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button button--primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Salvando..." : "Salvar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de checagem de elegibilidade */}
      {eligibilityCustomer && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">Verificar Elegibilidade PCE</h2>
            <p className="text-xs text-neutral-400">
              Avalia o CR de <strong>{eligibilityCustomer.legalName}</strong> contra classes controladas específicas:
            </p>
            <form onSubmit={handleCheckEligibility} className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PCE_CLASSES.map((cls) => {
                  const selected = classesToCheck.includes(cls);
                  return (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => toggleCheckClass(cls)}
                      className={`px-2 py-1 text-xs rounded border ${
                        selected
                          ? "bg-amber-600 border-amber-500 text-white font-bold"
                          : "bg-neutral-800 border-neutral-700 text-neutral-300"
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>

              {eligibilityResult && (
                <div
                  className={`p-3 rounded text-xs border ${
                    eligibilityResult.eligible
                      ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                      : "bg-rose-950/40 border-rose-700 text-rose-300"
                  }`}
                >
                  <div className="font-bold mb-1">
                    {eligibilityResult.eligible
                      ? "✓ Cliente Elegível para compra de PCE"
                      : "✗ Cliente NÃO Elegível"}
                  </div>
                  {eligibilityResult.reasons.length > 0 && (
                    <ul className="list-disc pl-4 space-y-0.5">
                      {eligibilityResult.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setEligibilityCustomer(null)}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="button button--secondary"
                  disabled={checkingEligibility || classesToCheck.length === 0}
                >
                  {checkingEligibility ? "Validando..." : "Testar Classes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
