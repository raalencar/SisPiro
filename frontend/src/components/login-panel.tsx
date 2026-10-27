"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { authApi, isMfaChallenge } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { Icon } from "@/components/icon";
import {
  LoginForm,
  MfaChallengeForm,
  PasswordResetRequestForm,
  PasswordResetConfirmForm,
} from "@/components/auth";

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
        <LoginForm
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          submitting={submitting}
          error={error}
          sessionError={sessionError}
          success={success}
          onSubmit={handleLoginSubmit}
          onForgotPassword={() => handleSwitchMode("forgot-request")}
          onHaveToken={() => handleSwitchMode("forgot-confirm")}
        />
      )}

      {mode === "mfa" && (
        <MfaChallengeForm
          mfaCode={mfaCode}
          setMfaCode={setMfaCode}
          submitting={submitting}
          error={error}
          sessionError={sessionError}
          onSubmit={handleMfaSubmit}
          onCancel={handleCancelMfa}
        />
      )}

      {mode === "forgot-request" && (
        <PasswordResetRequestForm
          resetEmail={resetEmail}
          setResetEmail={setResetEmail}
          submitting={submitting}
          error={error}
          success={success}
          onSubmit={handleForgotRequestSubmit}
          onGoToConfirm={() => handleSwitchMode("forgot-confirm")}
          onBackToLogin={() => handleSwitchMode("login")}
        />
      )}

      {mode === "forgot-confirm" && (
        <PasswordResetConfirmForm
          resetToken={resetToken}
          setResetToken={setResetToken}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          submitting={submitting}
          error={error}
          onSubmit={handleForgotConfirmSubmit}
          onBackToLogin={() => handleSwitchMode("login")}
        />
      )}
    </section>
  );
}
