"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Icon } from "@/components/icon";

export function LoginPanel() {
  const { login, error: sessionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível entrar. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="login-panel panel" aria-labelledby="login-title">
      <div className="login-panel__icon" aria-hidden="true">
        <Icon name="shield" size={24} />
      </div>
      <p className="eyebrow">Acesso seguro</p>
      <h1 id="login-title">Entre na sua conta</h1>
      <p className="login-panel__description">
        Use seu usuário cadastrado na API. Sua sessão é protegida por cookies
        HttpOnly e não fica armazenada no navegador em formato legível.
      </p>
      <form className="form-stack" onSubmit={handleSubmit}>
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
        {(error || sessionError) && (
          <p className="form-error" role="alert">{error || sessionError}</p>
        )}
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}
