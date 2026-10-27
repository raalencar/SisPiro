"use client";

import type { FormEvent } from "react";

interface LoginFormProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  submitting: boolean;
  error: string | null;
  sessionError: string | null;
  success: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onForgotPassword: () => void;
  onHaveToken: () => void;
}

export function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  submitting,
  error,
  sessionError,
  success,
  onSubmit,
  onForgotPassword,
  onHaveToken,
}: LoginFormProps) {
  return (
    <>
      <p className="eyebrow">Acesso seguro</p>
      <h1 id="login-title">Entre na sua conta</h1>
      <p className="login-panel__description">
        Use seu usuário cadastrado na API. Sua sessão é protegida por
        cookies HttpOnly e não fica armazenada no navegador em formato legível.
      </p>

      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">
          <span>E-mail</span>
          <input
            autoComplete="username"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
          />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={128}
            required
          />
        </label>

        {success && (
          <p className="form-success" role="status">
            {success}
          </p>
        )}

        {(error || sessionError) && (
          <p className="form-error" role="alert">
            {error || sessionError}
          </p>
        )}

        <div className="login-panel__actions flex items-center justify-between gap-2 pt-1">
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Verificando..." : "Entrar"}
          </button>
          <button
            className="button button--ghost text-xs"
            type="button"
            onClick={onForgotPassword}
            disabled={submitting}
          >
            Esqueci minha senha
          </button>
        </div>

        <div className="border-t border-slate-200 pt-3 text-center">
          <button
            className="button button--ghost text-xs text-slate-500 hover:text-slate-700"
            type="button"
            onClick={onHaveToken}
            disabled={submitting}
          >
            Já tem um token de recuperação? Redefina aqui
          </button>
        </div>
      </form>
    </>
  );
}
