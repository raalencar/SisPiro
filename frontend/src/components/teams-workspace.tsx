"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icon";
import {
  blastersApi,
  type Blaster,
  type BlasterEligibility,
  type PageResult,
} from "@/lib/api";
import { formatDateOnly } from "@/lib/format";

const BLASTER_CLASSES = ["1.1", "1.2", "1.3", "1.4", "BLASTER_PIROTECNICO"];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

export function TeamsWorkspace() {
  const [blasters, setBlasters] = useState<PageResult<Blaster> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Modal de cadastro / edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlaster, setEditingBlaster] = useState<Blaster | null>(null);
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiresAt, setLicenseExpiresAt] = useState("");
  const [authorizedClasses, setAuthorizedClasses] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Checagem de elegibilidade para data de evento
  const [eligibilityBlaster, setEligibilityBlaster] = useState<Blaster | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eligibilityResult, setEligibilityResult] = useState<BlasterEligibility | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const [currentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let current = true;
    void blastersApi
      .getBlasters(page, search)
      .then((result) => {
        if (current) setBlasters(result);
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
    setEditingBlaster(null);
    setName("");
    setTaxId("");
    setLicenseNumber("");
    setLicenseExpiresAt("");
    setAuthorizedClasses(["BLASTER_PIROTECNICO"]);
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(b: Blaster) {
    setEditingBlaster(b);
    setName(b.name);
    setTaxId(b.taxId);
    setLicenseNumber(b.licenseNumber);
    setLicenseExpiresAt(b.licenseExpiresAt.slice(0, 10));
    setAuthorizedClasses(b.authorizedClasses || []);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSaveBlaster(event: FormEvent) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: Partial<Blaster> = {
        name: name.trim(),
        taxId: taxId.replace(/\D/g, ""),
        licenseNumber: licenseNumber.trim(),
        licenseExpiresAt,
        authorizedClasses,
      };

      if (editingBlaster) {
        await blastersApi.updateBlaster(editingBlaster.id, payload);
      } else {
        await blastersApi.createBlaster(payload);
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
    if (!eligibilityBlaster || !eventDate) return;
    setCheckingEligibility(true);
    try {
      const result = await blastersApi.checkEligibility(
        eligibilityBlaster.id,
        eventDate,
      );
      setEligibilityResult(result);
    } catch (err) {
      setEligibilityResult({ eligible: false, reasons: [errorMessage(err)] });
    } finally {
      setCheckingEligibility(false);
    }
  }

  function toggleClass(cls: string) {
    setAuthorizedClasses((prev) =>
      prev.includes(cls)
        ? prev.filter((item) => item !== cls)
        : [...prev, cls],
    );
  }

  return (
    <div className="workspace space-y-6">
      <header className="workspace-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Gestão Operacional</p>
          <h1 className="text-2xl font-bold">Blasters e Profissionais Habilitados</h1>
          <p className="text-sm text-neutral-400">
            Controle de habilitação técnica, carteira funcional e validade para execução de queimas pirotécnicas.
          </p>
        </div>
        <button
          className="button button--primary flex items-center gap-2"
          onClick={handleOpenCreate}
        >
          <Icon name="hardhat" size={18} />
          Novo blaster
        </button>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Busca */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            type="search"
            placeholder="Buscar por nome, CPF ou número da carteira..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input w-full"
          />
        </div>
      </div>

      {/* Tabela de Blasters */}
      <div className="panel p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-400">Carregando blasters...</div>
        ) : !blasters || blasters.data.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">
            Nenhum blaster cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-left text-sm">
              <thead className="bg-neutral-800/50 text-neutral-300">
                <tr>
                  <th className="p-3">Nome do Blaster</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Registro / Carteira</th>
                  <th className="p-3">Validade</th>
                  <th className="p-3">Classes</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {blasters.data.map((b) => {
                  const isExpired =
                    Boolean(b.licenseExpiresAt &&
                    b.licenseExpiresAt.slice(0, 10) < currentDate);
                  return (
                    <tr key={b.id} className="hover:bg-neutral-800/30">
                      <td className="p-3 font-semibold text-neutral-100">
                        {b.name}
                      </td>
                      <td className="p-3 font-mono text-xs">{b.taxId}</td>
                      <td className="p-3 font-mono text-xs text-amber-400">
                        {b.licenseNumber}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs ${
                            isExpired ? "text-rose-400 font-bold" : "text-neutral-300"
                          }`}
                        >
                          {formatDateOnly(b.licenseExpiresAt)}
                          {isExpired && " (VENCIDA)"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {b.authorizedClasses.map((cls) => (
                            <span
                              key={cls}
                              className="px-1.5 py-0.5 text-[11px] rounded bg-neutral-800 border border-neutral-700"
                            >
                              {cls}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`status-pill ${
                            b.active ? "status-pill--available" : "status-pill--neutral"
                          }`}
                        >
                          {b.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="button button--ghost text-xs py-1 px-2"
                            onClick={() => {
                              setEligibilityBlaster(b);
                              setEventDate(new Date().toISOString().slice(0, 10));
                              setEligibilityResult(null);
                            }}
                            title="Validar aptidão para data"
                          >
                            Aptidão
                          </button>
                          <button
                            className="button button--secondary text-xs py-1 px-2"
                            onClick={() => handleOpenEdit(b)}
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

      {/* Modal de criação / edição */}
      {isModalOpen && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-lg w-full space-y-4">
            <h2 className="text-xl font-bold">
              {editingBlaster ? "Editar Blaster" : "Novo Blaster"}
            </h2>
            <form className="form-stack space-y-3" onSubmit={handleSaveBlaster}>
              <label className="field">
                <span>Nome completo *</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="field">
                <span>CPF (apenas dígitos) *</span>
                <input
                  type="text"
                  required
                  maxLength={14}
                  disabled={Boolean(editingBlaster)}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="field">
                  <span>Nº da Carteira / Habilitação *</span>
                  <input
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Validade da Carteira *</span>
                  <input
                    type="date"
                    required
                    value={licenseExpiresAt}
                    onChange={(e) => setLicenseExpiresAt(e.target.value)}
                  />
                </label>
              </div>

              <div>
                <span className="text-xs font-medium text-neutral-400 block mb-1">
                  Classes Autorizadas:
                </span>
                <div className="flex flex-wrap gap-2">
                  {BLASTER_CLASSES.map((cls) => {
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
                        {cls}
                      </button>
                    );
                  })}
                </div>
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
                  {formSubmitting ? "Salvando..." : "Salvar Blaster"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de teste de aptidão para evento */}
      {eligibilityBlaster && (
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="modal-content panel max-w-md w-full space-y-4">
            <h2 className="text-lg font-bold">Validar Aptidão para Evento</h2>
            <p className="text-xs text-neutral-400">
              Verifica se a carteira de <strong>{eligibilityBlaster.name}</strong> estará válida na data do espetáculo:
            </p>
            <form onSubmit={handleCheckEligibility} className="space-y-3">
              <label className="field">
                <span>Data prevista do evento</span>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </label>

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
                      ? "✓ Blaster Apto para a data indicada"
                      : "✗ Blaster NÃO Apto para a data"}
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
                  onClick={() => setEligibilityBlaster(null)}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="button button--secondary"
                  disabled={checkingEligibility || !eventDate}
                >
                  {checkingEligibility ? "Validando..." : "Checar Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
