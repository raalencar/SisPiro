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

const { GET, POST } = await import("./route");

afterEach(() => {
  vi.unstubAllGlobals();
  cookieStore.clear();
});

describe("GET /api/blasters", () => {
  it("lists blasters at the route root (regression: optional catch-all)", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request(
      "https://app.example.test/api/blasters?page=1&limit=100",
    );
    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/blasters?page=1&limit=100");
  });

  it("rejects unknown nested paths with 404", async () => {
    const request = new Request(
      "https://app.example.test/api/blasters/not-a-real-action",
    );
    const response = await GET(request, {
      params: Promise.resolve({ path: ["not-a-real-action"] }),
    });

    expect(response.status).toBe(404);
  });
});

describe("POST /api/blasters", () => {
  it("creates a blaster at the route root (regression: optional catch-all)", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "new" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://app.example.test/api/blasters", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Novo blaster" }),
    });
    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/blasters");
  });

  it("rejects cross-origin requests with 403", async () => {
    const request = new Request("https://app.example.test/api/blasters", {
      method: "POST",
      headers: { origin: "https://malicious.example.test" },
      body: JSON.stringify({}),
    });
    const response = await POST(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(403);
  });
});
