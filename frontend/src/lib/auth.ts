import {
  clearSessionFreshness,
  markSessionFresh,
  requestJson,
} from "@/lib/api";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

export type MfaChallenge = {
  mfaRequired: true;
  mfaToken: string;
};

export type LoginResult = AuthUser | MfaChallenge;

export function isMfaChallenge(result: unknown): result is MfaChallenge {
  return (
    typeof result === "object" &&
    result !== null &&
    "mfaRequired" in result &&
    (result as { mfaRequired: unknown }).mfaRequired === true &&
    "mfaToken" in result &&
    typeof (result as { mfaToken: unknown }).mfaToken === "string"
  );
}

export type PasswordResetResponse = {
  message: string;
};

export const authApi = {
  login: async (email: string, password: string, mfaCode?: string) => {
    const result = await requestJson<LoginResult>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, mfaCode }),
    });
    if (!isMfaChallenge(result)) {
      markSessionFresh();
    }
    return result;
  },
  verifyMfa: async (mfaToken: string, code: string) => {
    const user = await requestJson<AuthUser>("/api/auth/login/mfa", {
      method: "POST",
      body: JSON.stringify({ mfaToken, code }),
    });
    markSessionFresh();
    return user;
  },
  requestPasswordReset: async (email: string) => {
    return await requestJson<PasswordResetResponse>(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
  },
  confirmPasswordReset: async (token: string, newPassword: string) => {
    return await requestJson<PasswordResetResponse>(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      },
    );
  },
  session: async () => {
    const user = await requestJson<AuthUser>("/api/auth/session");
    markSessionFresh();
    return user;
  },
  logout: async () => {
    try {
      return await requestJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      clearSessionFreshness();
    }
  },
};

