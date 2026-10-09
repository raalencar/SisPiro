"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api";
import {
  authApi,
  isMfaChallenge,
  type AuthUser,
  type LoginResult,
} from "@/lib/auth";

type AuthStatus = "checking" | "authenticated" | "anonymous" | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string, mfaCode?: string) => Promise<LoginResult>;
  verifyMfa: (mfaToken: string, code: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação de autenticação.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setStatus("checking");
    setError(null);
    try {
      const sessionUser = await authApi.session();
      setUser(sessionUser);
      setStatus("authenticated");
    } catch (requestError) {
      setUser(null);
      if (requestError instanceof ApiError && requestError.status === 401) {
        setStatus("anonymous");
        return;
      }
      setError(messageFor(requestError));
      setStatus("error");
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      setStatus("checking");
      setError(null);
      try {
        const result = await authApi.login(email, password, mfaCode);
        if (isMfaChallenge(result)) {
          setStatus("anonymous");
          return result;
        }
        setUser(result);
        setStatus("authenticated");
        return result;
      } catch (requestError) {
        setUser(null);
        setStatus("anonymous");
        throw requestError;
      }
    },
    [],
  );

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    setStatus("checking");
    setError(null);
    try {
      const sessionUser = await authApi.verifyMfa(mfaToken, code);
      setUser(sessionUser);
      setStatus("authenticated");
      return sessionUser;
    } catch (requestError) {
      setUser(null);
      setStatus("anonymous");
      throw requestError;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      setUser(null);
      setError(null);
      setStatus("anonymous");
    } catch (requestError) {
      setError(messageFor(requestError));
      if (
        requestError instanceof ApiError &&
        requestError.kind === "http" &&
        requestError.status !== 403
      ) {
        setUser(null);
        setStatus("anonymous");
      }
      throw requestError;
    }
  }, []);

  useEffect(() => {
    let current = true;
    const handleSessionExpired = () => {
      setUser(null);
      setError("Sua sessão expirou. Entre novamente.");
      setStatus("anonymous");
    };
    window.addEventListener("erp:session-expired", handleSessionExpired);
    void authApi.session()
      .then((sessionUser) => {
        if (!current) return;
        setUser(sessionUser);
        setStatus("authenticated");
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setUser(null);
        if (requestError instanceof ApiError && requestError.status === 401) {
          setStatus("anonymous");
          return;
        }
        setError(messageFor(requestError));
        setStatus("error");
      });

    return () => {
      current = false;
      window.removeEventListener("erp:session-expired", handleSessionExpired);
    };
  }, []);

  const value = useMemo(
    () => ({ status, user, error, refreshSession, login, verifyMfa, logout }),
    [status, user, error, refreshSession, login, verifyMfa, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa ser usado dentro de AuthProvider.");
  }
  return context;
}
