import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as requestRoute } from "./request/route";
import { POST as confirmRoute } from "./confirm/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Password Reset BFF Routes", () => {
  describe("POST /api/auth/password-reset/request", () => {
    it("rejects cross-origin requests with 403", async () => {
      const request = new Request("https://app.example.test/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          origin: "https://malicious.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "user@example.test" }),
      });

      const response = await requestRoute(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toBe("Origem da requisição não permitida.");
    });

    it("rejects invalid payloads with 400", async () => {
      const request = new Request("https://app.example.test/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "" }),
      });

      const response = await requestRoute(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe("Informe um e-mail válido.");
    });

    it("forwards valid request to backend and returns response", async () => {
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

      const request = new Request("https://app.example.test/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: " User@Example.Test " }),
      });

      const response = await requestRoute(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain("as instruções para redefinição de senha foram enviadas");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("auth/password-reset/request");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({
        email: "user@example.test",
      });
    });

    it("handles backend error when requesting reset", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Backend offline")));

      const request = new Request("https://app.example.test/api/auth/password-reset/request", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "user@example.test" }),
      });

      const response = await requestRoute(request);
      expect(response.status).toBe(502);
      const data = await response.json();
      expect(data.message).toBe("Backend offline");
    });
  });

  describe("POST /api/auth/password-reset/confirm", () => {
    it("rejects cross-origin requests with 403", async () => {
      const request = new Request("https://app.example.test/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          origin: "https://malicious.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: "a".repeat(32), newPassword: "password12345" }),
      });

      const response = await confirmRoute(request);
      expect(response.status).toBe(403);
    });

    it("rejects invalid payloads with 400", async () => {
      const request = new Request("https://app.example.test/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: "", newPassword: "" }),
      });

      const response = await confirmRoute(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe("Informe o token de recuperação e a nova senha.");
    });

    it("forwards confirmation to backend and returns response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "Senha redefinida com sucesso. Faça login com a nova senha.",
          }),
          { status: 200 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const request = new Request("https://app.example.test/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: " " + "a".repeat(32) + " ",
          newPassword: "NewSecretPassword2026!",
        }),
      });

      const response = await confirmRoute(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain("Senha redefinida com sucesso");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("auth/password-reset/confirm");
      expect(JSON.parse(init.body as string)).toEqual({
        token: "a".repeat(32),
        newPassword: "NewSecretPassword2026!",
      });
    });

    it("forwards 400 when backend rejects invalid or expired token", async () => {
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

      const request = new Request("https://app.example.test/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          origin: "https://app.example.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "a".repeat(32),
          newPassword: "NewSecretPassword2026!",
        }),
      });

      const response = await confirmRoute(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe("Token de recuperação de senha inválido ou expirado.");
    });
  });
});

