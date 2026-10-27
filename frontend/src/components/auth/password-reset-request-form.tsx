"use client";

import type { FormEvent } from "react";

interface PasswordResetRequestFormProps {
  resetEmail: string;
  setResetEmail: (val: string) => void;
  submitting: boolean;
  error: string | null;
  success: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onGoToConfirm: () => void;
  onBackToLogin: () => void;
}

export function PasswordResetRequestForm({
  resetEmail,
  setResetEmail,
  submitting,
  error,
  success,
  onSubmit,
  onGoToConfirm,
  onBackToLogin,
}: PasswordResetRequestFormProps) {
  return (
    <>
      <p className="eyebrow">Recuperação de acesso</p>
      <h1 id="login-title">Esqueci minha senha</h1>
      <p className="login-panel__description">
        Informe o e-mail cadastrado. Se o usuário existir, as instruções e
        o token seguro de redefinição serão despachados.
      </p>

      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">
          <span>E-mail cadastrado</span>
          <input
            autoComplete="email"
            type="email"
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            maxLength={254}
            required
            autoFocus
          />
        </label>

        {success && (
          <div className="space-y-2">
            <p className="form-success" role="status">
              {success}
            </p>
            <button
              className="button button--primary w-full text-xs"
              type="button"
              onClick={onGoToConfirm}
            >
              Inserir token e redefinir senha &rarr;
            </button>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="login-panel__actions flex items-center justify-between gap-2 pt-1">
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Enviando..." : "Enviar instruções"}
          </button>
          <button
            className="button button--ghost text-xs"
            type="button"
            onClick={onBackToLogin}
            disabled={submitting}
          >
            Voltar ao login
          </button>
        </div>

        <div className="border-t border-slate-200 pt-3 text-center">
          <button
            className="button button--ghost text-xs text-slate-500 hover:text-slate-700"
            type="button"
            onClick={onGoToConfirm}
            disabled={submitting}
          >
            Já possui o token? Clique aqui para redefinir
          </button>
        </div>
      </form>
    </>
  );
}
