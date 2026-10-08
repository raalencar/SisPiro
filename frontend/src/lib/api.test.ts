import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getApiEndpoint, getLiveness, getReadiness } from "./api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
