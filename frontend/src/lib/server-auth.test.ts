import { afterEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name)
        ? { name, value: cookieStore.get(name)! }
        : undefined,
  }),
}));

const { proxyAuthenticatedRequest } = await import("./server-auth");

afterEach(() => {
  vi.unstubAllGlobals();
  cookieStore.clear();
});

describe("proxyAuthenticatedRequest", () => {
  it("forwards the request body to the backend on PATCH", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = JSON.stringify({ legalName: "Novo nome" });
    const request = new Request("https://app.example.test/api/customers/abc", {
      method: "PATCH",
      body: payload,
    });

    await proxyAuthenticatedRequest(request, "customers/abc", "PATCH", false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(payload);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });

  it("forwards the request body to the backend on PUT", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = JSON.stringify({ items: [] });
    const request = new Request("https://app.example.test/api/operations/orders/abc", {
      method: "PUT",
      body: payload,
    });

    await proxyAuthenticatedRequest(request, "operations/orders/abc", "PUT", false);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(payload);
  });

  it("does not attach a body for GET requests", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://app.example.test/api/customers", {
      method: "GET",
    });

    await proxyAuthenticatedRequest(request, "customers", "GET", false);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
  });
});
