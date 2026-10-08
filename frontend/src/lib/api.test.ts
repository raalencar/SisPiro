import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  clearSessionFreshness,
  getApiEndpoint,
  getLiveness,
  getReadiness,
  inventoryApi,
  markSessionFresh,
  requestJson,
} from "./api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  clearSessionFreshness();
});

describe("API client", () => {
  it("uses the configured API origin and prefix", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test/");
    vi.stubEnv("NEXT_PUBLIC_API_PREFIX", "/v2/");

    expect(getApiEndpoint("/health/live")).toBe(
      "https://api.example.test/v2/health/live",
    );
  });

  it("uses the documented local API defaults", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_PREFIX", "");

    expect(getApiEndpoint("health/live")).toBe(
      "http://localhost:3000/api/v1/health/live",
    );
  });

  it("validates the liveness response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
      ),
    );

    await expect(getLiveness()).resolves.toEqual({ status: "ok" });
  });

  it("reports HTTP failures without treating them as success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(getReadiness()).rejects.toMatchObject({
      name: "ApiError",
      kind: "http",
      status: 503,
    });
  });

  it("rejects unexpected successful response shapes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "unknown" }), { status: 200 }),
      ),
    );

    await expect(getLiveness()).rejects.toMatchObject({
      name: "ApiError",
      kind: "invalid-response",
    } satisfies Partial<ApiError>);
  });

  it("reports network unavailability explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(getLiveness()).rejects.toMatchObject({
      name: "ApiError",
      kind: "network",
    });
  });

  it("uses the same-origin business API and sends JSON for inventory operations", async () => {
    markSessionFresh();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "product-id" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await inventoryApi.createProduct({
      sku: "SKU-1",
      name: "Produto teste",
      type: "MERCADORIA",
      isPce: false,
      unit: "UN",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/inventory/products",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: expect.objectContaining({
          Accept: "application/json",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      sku: "SKU-1",
      name: "Produto teste",
      type: "MERCADORIA",
      isPce: false,
      unit: "UN",
    });
  });

  it("validates the session before starting inventory requests", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "user-id", name: "User", email: "user@example.test", roles: ["ADMIN"] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await inventoryApi.getProducts();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/session",
      "/api/inventory/products?page=1&limit=100",
    ]);
  });

  it("renews an expired session once and retries the inventory request", async () => {
    markSessionFresh();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "user-id", name: "User", email: "user@example.test", roles: ["ADMIN"] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await inventoryApi.getProducts();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/inventory/products?page=1&limit=100",
      "/api/auth/session",
      "/api/inventory/products?page=1&limit=100",
    ]);
  });

  it("surfaces validation messages returned by the business API", async () => {
    markSessionFresh();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: ["Quantidade inválida.", "Lote vencido."] }), {
          status: 400,
        }),
      ),
    );

    await expect(requestJson("/api/inventory/movements", { method: "POST" }))
      .rejects.toMatchObject({
        name: "ApiError",
        kind: "http",
        status: 400,
        message: "Quantidade inválida. Lote vencido.",
      } satisfies Partial<ApiError>);
  });

  it("aborts requests that exceed the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
      ),
    );

    const request = getLiveness();
    const assertion = expect(request).rejects.toMatchObject({
      name: "ApiError",
      kind: "timeout",
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});
