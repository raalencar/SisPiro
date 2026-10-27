"use client";

import type { FormEvent } from "react";

interface MfaChallengeFormProps {
  mfaCode: string;
  setMfaCode: (val: string) => void;
  submitting: boolean;
  error: string | null;
  sessionError: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export function MfaChallengeForm({
  mfaCode,
  setMfaCode,
  submitting,
  error,
  sessionError,
  onSubmit,
  onCancel,
}: MfaChallengeFormProps) {
  return (
    <>
      <p className="eyebrow">Segundo fator</p>
      <h1 id="login-title">Autenticação em duas etapas</h1>
      <p className="login-panel__description">
        Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador
        ou utilize um dos seus códigos de backup de uso único.
      </p>

      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Código de autenticação (TOTP ou Backup)</span>
          <input
            autoComplete="one-time-code"
            type="text"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value.trim())}
            placeholder="Ex: 123456 ou cód. de 8 caracteres"
            maxLength={16}
            required
            autoFocus
          />
        </label>

        {(error || sessionError) && (
          <p className="form-error" role="alert">
            {error || sessionError}
          </p>
        )}

        <div className="login-panel__actions flex gap-2">
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Verificando..." : "Confirmar código"}
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            Voltar
          </button>
        </div>
      </form>
    </>
  );
}
