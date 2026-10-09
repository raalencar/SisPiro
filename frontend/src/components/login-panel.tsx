"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { authApi, isMfaChallenge } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { Icon } from "@/components/icon";

type PanelMode = "login" | "mfa" | "forgot-request" | "forgot-confirm";

export function LoginPanel() {
  const { login, verifyMfa, error: sessionError } = useAuth();

  const [mode, setMode] = useState<PanelMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || params.get("reset_token");
    if (token && token.trim().length > 0) {
      queueMicrotask(() => {
        setResetToken(token.trim());
        setMode("forgot-confirm");
      });
    }
  }, []);

  function handleSwitchMode(targetMode: PanelMode) {
    setError(null);
    setSuccess(null);
    if (targetMode === "forgot-request" && !resetEmail && email) {
      setResetEmail(email);
    }
    setMode(targetMode);
  }

  function handleCancelMfa() {
    setMfaToken(null);
    setMfaCode("");
    setError(null);
    setMode("login");
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await login(email, password);
      if (isMfaChallenge(result)) {
        setMfaToken(result.mfaToken);
        setMfaCode("");
        setMode("mfa");
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

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaToken) return;
    setSubmitting(true);
    setError(null);
    try {
      await verifyMfa(mfaToken, mfaCode);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível autenticar com o código MFA informado.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authApi.requestPasswordReset(resetEmail.trim());
      setSuccess(res.message);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível solicitar a recuperação de senha.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotConfirmSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (resetToken.trim().length < 32) {
      setError("O token de recuperação informado é inválido ou incompleto.");
      return;
    }
    if (newPassword.length < 12) {
      setError("A nova senha deve ter no mínimo 12 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("A confirmação da nova senha não confere com a senha digitada.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.confirmPasswordReset(
        resetToken.trim(),
        newPassword,
      );
      setSuccess(res.message);
      setNewPassword("");
      setConfirmNewPassword("");
      setResetToken("");
      setPassword("");
      if (resetEmail) {
        setEmail(resetEmail);
      }
      setMode("login");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Não foi possível redefinir a senha com o token informado.",
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

      {mode === "login" && (
        <>
          <p className="eyebrow">Acesso seguro</p>
          <h1 id="login-title">Entre na sua conta</h1>
          <p className="login-panel__description">
            Use seu usuário cadastrado na API. Sua sessão é protegida por
            cookies HttpOnly e não fica armazenada no navegador em formato legível.
          </p>

          <form className="form-stack" onSubmit={handleLoginSubmit}>
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
                onClick={() => handleSwitchMode("forgot-request")}
                disabled={submitting}
              >
                Esqueci minha senha
              </button>
            </div>

            <div className="border-t border-slate-200 pt-3 text-center">
              <button
                className="button button--ghost text-xs text-slate-500 hover:text-slate-700"
                type="button"
                onClick={() => handleSwitchMode("forgot-confirm")}
                disabled={submitting}
              >
                Já tem um token de recuperação? Redefina aqui
              </button>
            </div>
          </form>
        </>
      )}

      {mode === "mfa" && (
        <>
          <p className="eyebrow">Segundo fator</p>
          <h1 id="login-title">Autenticação em duas etapas</h1>
          <p className="login-panel__description">
            Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador
            ou utilize um dos seus códigos de backup de uso único.
          </p>

          <form className="form-stack" onSubmit={handleMfaSubmit}>
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
                onClick={handleCancelMfa}
                disabled={submitting}
              >
                Voltar
              </button>
            </div>
          </form>
        </>
      )}

      {mode === "forgot-request" && (
        <>
          <p className="eyebrow">Recuperação de acesso</p>
          <h1 id="login-title">Esqueci minha senha</h1>
          <p className="login-panel__description">
            Informe o e-mail cadastrado. Se o usuário existir, as instruções e
            o token seguro de redefinição serão despachados.
          </p>

          <form className="form-stack" onSubmit={handleForgotRequestSubmit}>
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
                  onClick={() => handleSwitchMode("forgot-confirm")}
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
                onClick={() => handleSwitchMode("login")}
                disabled={submitting}
              >
                Voltar ao login
              </button>
            </div>

            <div className="border-t border-slate-200 pt-3 text-center">
              <button
                className="button button--ghost text-xs text-slate-500 hover:text-slate-700"
                type="button"
                onClick={() => handleSwitchMode("forgot-confirm")}
                disabled={submitting}
              >
                Já possui o token? Clique aqui para redefinir
              </button>
            </div>
          </form>
        </>
      )}

      {mode === "forgot-confirm" && (
        <>
          <p className="eyebrow">Redefinição de senha</p>
          <h1 id="login-title">Definir nova senha</h1>
          <p className="login-panel__description">
            Informe o token de uso único recebido e defina sua nova senha de
            acesso (mínimo de 12 caracteres).
          </p>

          <form className="form-stack" onSubmit={handleForgotConfirmSubmit}>
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
                onClick={() => handleSwitchMode("login")}
                disabled={submitting}
              >
                Voltar ao login
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
