import { afterEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
  }),
}));

const { GET, POST } = await import("./route");

const ITEM_ID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function params(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  cookieStore.clear();
});

describe("GET /api/procurement/supplier-catalog", () => {
  it("maps list, categories and detail to /procurement/supplier-catalog, keeping the query", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await GET(
      new Request("https://app.example.test/api/procurement/supplier-catalog?page=2&linked=false"),
      params(["supplier-catalog"]),
    );
    await GET(
      new Request("https://app.example.test/api/procurement/supplier-catalog/categories"),
      params(["supplier-catalog", "categories"]),
    );
    await GET(
      new Request(`https://app.example.test/api/procurement/supplier-catalog/${ITEM_ID}`),
      params(["supplier-catalog", ITEM_ID]),
    );

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toMatch(/\/procurement\/supplier-catalog\?page=2&linked=false$/);
    expect(urls[1]).toMatch(/\/procurement\/supplier-catalog\/categories$/);
    expect(urls[2]).toMatch(new RegExp(`/procurement/supplier-catalog/${ITEM_ID}$`));
  });

  it("streams the image bytes with the backend Content-Type and Cache-Control", async () => {
    cookieStore.set("erp_access_token", "token-123");
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=86400",
          "Content-Length": String(bytes.length),
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`https://app.example.test/api/procurement/supplier-catalog/${ITEM_ID}/images/0`),
      params(["supplier-catalog", ITEM_ID, "images", "0"]),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(new RegExp(`/procurement/supplier-catalog/${ITEM_ID}/images/0$`));
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("passes backend JSON errors through for images (e.g. 403 for profiles without catalog access)", async () => {
    cookieStore.set("erp_access_token", "token-123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Acesso negado." }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const response = await GET(
      new Request(`https://app.example.test/api/procurement/supplier-catalog/${ITEM_ID}/images/1`),
      params(["supplier-catalog", ITEM_ID, "images", "1"]),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Acesso negado." });
  });

  it("rejects non-image content from the backend with 502", async () => {
    cookieStore.set("erp_access_token", "token-123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
      ),
    );

    const response = await GET(
      new Request(`https://app.example.test/api/procurement/supplier-catalog/${ITEM_ID}/images/0`),
      params(["supplier-catalog", ITEM_ID, "images", "0"]),
    );

    expect(response.status).toBe(502);
  });

  it.each([
    [["supplier-catalog", "not-a-uuid"]],
    [["supplier-catalog", "not-a-uuid", "images", "0"]],
    [["supplier-catalog", ITEM_ID, "images", "-1"]],
    [["supplier-catalog", ITEM_ID, "images", "1.5"]],
    [["supplier-catalog", ITEM_ID, "images", "..%2F"]],
    [["supplier-catalog", ITEM_ID, "other"]],
  ])("rejects invalid path %j with 404 without calling the API", async (path) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://app.example.test/api/procurement/x"),
      params(path),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 for images without a session cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(`https://app.example.test/api/procurement/supplier-catalog/${ITEM_ID}/images/0`),
      params(["supplier-catalog", ITEM_ID, "images", "0"]),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/procurement/supplier-catalog", () => {
  it("does not allow writes to the read-only catalog", async () => {
    const request = new Request("https://app.example.test/api/procurement/supplier-catalog", {
      method: "POST",
      headers: { origin: "https://app.example.test" },
      body: "{}",
    });
    const response = await POST(request, params(["supplier-catalog"]));
    expect(response.status).toBe(404);
  });
});
