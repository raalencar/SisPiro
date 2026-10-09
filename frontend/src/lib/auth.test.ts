import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi, isMfaChallenge } from "./auth";
import { clearSessionFreshness } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  clearSessionFreshness();
});

describe("authApi", () => {
  describe("isMfaChallenge", () => {
    it("identifies valid MFA challenge payload", () => {
      expect(isMfaChallenge({ mfaRequired: true, mfaToken: "challenge-123" })).toBe(true);
      expect(isMfaChallenge({ mfaRequired: false })).toBe(false);
      expect(isMfaChallenge(null)).toBe(false);
      expect(isMfaChallenge({ id: "user-1", name: "Admin" })).toBe(false);
    });
  });

  describe("password reset", () => {
    it("dispatches password reset request with trimmed and lowercased email", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message:
              "Se o e-mail informado estiver cadastrado, as instruções para redefinição de senha foram enviadas.",
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await authApi.requestPasswordReset("operador@local.test");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/auth/password-reset/request");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        email: "operador@local.test",
      });
      expect(result.message).toContain("as instruções para redefinição de senha foram enviadas");
    });

    it("confirms password reset with token and new password", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Senha redefinida com sucesso. Faça login com a nova senha.",
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const rawToken = "a".repeat(32);
      const newPassword = "NewSecretPassword2026!";
      const result = await authApi.confirmPasswordReset(rawToken, newPassword);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/auth/password-reset/confirm");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        token: rawToken,
        newPassword,
      });
      expect(result.message).toContain("Senha redefinida com sucesso");
    });

    it("surfaces validation error when confirm fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              message: "Token de recuperação de senha inválido ou expirado.",
            }),
            { status: 400 },
          ),
        ),
      );

      await expect(
        authApi.confirmPasswordReset("invalid-token", "NewSecretPassword2026!"),
      ).rejects.toMatchObject({
        name: "ApiError",
        status: 400,
        message: "Token de recuperação de senha inválido ou expirado.",
      });
    });
  });

  describe("login and MFA", () => {
    it("handles login returning user", async () => {
      const mockUser = { id: "u-1", name: "User", email: "u@test.com", roles: ["ADMIN"] };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockUser), { status: 200 })),
      );

      const result = await authApi.login("u@test.com", "pass123");
      expect(result).toEqual(mockUser);
    });

    it("handles login returning MFA challenge", async () => {
      const challenge = { mfaRequired: true, mfaToken: "tok-abc" };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify(challenge), { status: 200 })),
      );

      const result = await authApi.login("u@test.com", "pass123");
      expect(result).toEqual(challenge);
    });

    it("verifies MFA token and code", async () => {
      const mockUser = { id: "u-1", name: "User", email: "u@test.com", roles: ["ADMIN"] };
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify(mockUser), { status: 200 })),
      );

      const result = await authApi.verifyMfa("tok-abc", "123456");
      expect(result).toEqual(mockUser);
    });
  });
});

