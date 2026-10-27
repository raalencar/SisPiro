"use client";

import type { FormEvent } from "react";

interface PasswordResetConfirmFormProps {
  resetToken: string;
  setResetToken: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (val: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onBackToLogin: () => void;
}

export function PasswordResetConfirmForm({
  resetToken,
  setResetToken,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  submitting,
  error,
  onSubmit,
  onBackToLogin,
}: PasswordResetConfirmFormProps) {
  return (
    <>
      <p className="eyebrow">Redefinição de senha</p>
      <h1 id="login-title">Definir nova senha</h1>
      <p className="login-panel__description">
        Informe o token de uso único recebido e defina sua nova senha de
        acesso (mínimo de 12 caracteres).
      </p>

      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Token de recuperação</span>
          <input
            type="text"
            value={resetToken}
            onChange={(event) => setResetToken(event.target.value.trim())}
            placeholder="Cole o token de recuperação"
            minLength={32}
            maxLength={128}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Nova senha (mínimo 12 caracteres)</span>
          <input
            autoComplete="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
        </label>

        <label className="field">
          <span>Confirmar nova senha</span>
          <input
            autoComplete="new-password"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
          />
        </label>

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
            {submitting ? "Redefinindo..." : "Salvar nova senha"}
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
      </form>
    </>
  );
}
