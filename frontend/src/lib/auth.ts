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

export const authApi = {
  login: async (email: string, password: string) => {
    const user = await requestJson<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    markSessionFresh();
    return user;
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
