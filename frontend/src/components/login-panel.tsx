"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { isMfaChallenge } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { Icon } from "@/components/icon";

export function LoginPanel() {
  const { login, verifyMfa, error: sessionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mfaToken) {
        await verifyMfa(mfaToken, mfaCode);
      } else {
        const result = await login(email, password);
        if (isMfaChallenge(result)) {
          setMfaToken(result.mfaToken);
          setMfaCode("");
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível autenticar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelMfa() {
    setMfaToken(null);
    setMfaCode("");
    setError(null);
  }

  return (
    <section className="login-panel panel" aria-labelledby="login-title">
      <div className="login-panel__icon" aria-hidden="true">
        <Icon name="shield" size={24} />
      </div>
      <p className="eyebrow">{mfaToken ? "Segundo fator" : "Acesso seguro"}</p>
      <h1 id="login-title">
        {mfaToken ? "Autenticação em duas etapas" : "Entre na sua conta"}
      </h1>
      <p className="login-panel__description">
        {mfaToken
          ? "Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador ou utilize um dos seus códigos de backup."
          : "Use seu usuário cadastrado na API. Sua sessão é protegida por cookies HttpOnly e não fica armazenada no navegador em formato legível."}
      </p>

      <form className="form-stack" onSubmit={handleSubmit}>
        {!mfaToken ? (
          <>
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
          </>
        ) : (
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
        )}

        {(error || sessionError) && (
          <p className="form-error" role="alert">{error || sessionError}</p>
        )}

        <div className="login-panel__actions flex gap-2">
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting
              ? "Verificando..."
              : mfaToken
                ? "Confirmar código"
                : "Entrar"}
          </button>
          {mfaToken && (
            <button
              className="button button--ghost"
              type="button"
              onClick={handleCancelMfa}
              disabled={submitting}
            >
              Voltar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
