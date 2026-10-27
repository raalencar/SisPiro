"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  customersApi,
  type Customer,
  type CustomerEligibility,
  type PageResult,
} from "@/lib/api";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { useModalFocusTrap } from "@/lib/use-modal-focus-trap";
import {
  CustomersTable,
  CustomerModal,
  CustomerEligibilityModal,
  errorMessage,
} from "./customers";

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
  const [taxId, setTaxId] = useState("");
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
    setTaxId("");
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
    setTaxId(customer.taxId);
    setHasCr(customer.hasCr);
    setCrNumber(customer.crNumber || "");
    setCrExpiresAt(customer.crExpiresAt ? customer.crExpiresAt.slice(0, 10) : "");
    setAuthorizedClasses(customer.authorizedPceClasses || []);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSaveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<Customer> = {
        legalName: legalName.trim(),
        taxId: taxId.replace(/\D/g, ""),
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
      setReloadTrigger((v) => v + 1);
    } catch (err: unknown) {
      setFormError(errorMessage(err));
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleCheckEligibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligibilityCustomer || classesToCheck.length === 0) return;
    setCheckingEligibility(true);
    try {
      const res = await customersApi.checkPceEligibility(
        eligibilityCustomer.id,
        classesToCheck,
      );
      setEligibilityResult(res);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setCheckingEligibility(false);
    }
  }

  useEscapeToClose(isModalOpen, () => setIsModalOpen(false));
  useModalFocusTrap(isModalOpen);
  useEscapeToClose(Boolean(eligibilityCustomer), () => setEligibilityCustomer(null));
  useModalFocusTrap(Boolean(eligibilityCustomer));

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão Comercial & Compliance</p>
          <h1 className="text-2xl font-bold">Clientes & Licenças PCE</h1>
          <p className="text-sm text-neutral-400">
            Cadastros de clientes, certificados de registro (CR) do Exército e verificação automática de elegibilidade.
          </p>
        </div>
        <button
          type="button"
          className="button button--primary flex items-center gap-2"
          onClick={handleOpenCreate}
        >
          <Icon name="users" size={18} />
          Novo cliente
        </button>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="field w-full max-w-md">
          <span className="sr-only">Buscar clientes</span>
          <input
            type="search"
            placeholder="Buscar por razão social, nome fantasia ou CNPJ/CPF..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input w-full"
          />
        </label>
      </div>

      {/* Grid Principal */}
      <CustomersTable
        customers={customers}
        loading={loading}
        onOpenEdit={handleOpenEdit}
        onCheckEligibility={(c) => {
          setEligibilityCustomer(c);
          setClassesToCheck(["1.3G"]);
          setEligibilityResult(null);
        }}
      />

      {/* Modal de cadastro / edição */}
      <CustomerModal
        isOpen={isModalOpen}
        editingCustomer={editingCustomer}
        legalName={legalName}
        taxId={taxId}
        hasCr={hasCr}
        crNumber={crNumber}
        crExpiresAt={crExpiresAt}
        authorizedClasses={authorizedClasses}
        submitting={formSubmitting}
        error={formError}
        onLegalNameChange={setLegalName}
        onTaxIdChange={setTaxId}
        onHasCrChange={setHasCr}
        onCrNumberChange={setCrNumber}
        onCrExpiresAtChange={setCrExpiresAt}
        onToggleClass={(cls) =>
          setAuthorizedClasses((prev) =>
            prev.includes(cls) ? prev.filter((item) => item !== cls) : [...prev, cls],
          )
        }
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveCustomer}
      />

      {/* Modal de checagem de elegibilidade */}
      <CustomerEligibilityModal
        customer={eligibilityCustomer}
        classesToCheck={classesToCheck}
        eligibilityResult={eligibilityResult}
        checkingEligibility={checkingEligibility}
        onToggleCheckClass={(cls) =>
          setClassesToCheck((prev) =>
            prev.includes(cls) ? prev.filter((item) => item !== cls) : [...prev, cls],
          )
        }
        onClose={() => setEligibilityCustomer(null)}
        onSubmit={handleCheckEligibility}
      />
    </div>
  );
}
