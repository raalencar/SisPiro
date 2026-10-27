const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_API_PREFIX = "/api/v1";
const REQUEST_TIMEOUT_MS = 5_000;
const BUSINESS_REQUEST_TIMEOUT_MS = 15_000;
const SESSION_VALIDITY_MS = 60_000;

let sessionValidatedAt = 0;
let sessionCheck: Promise<void> | null = null;

export type HealthResponse = {
  status: "ok";
};

export type ApiErrorKind = "http" | "network" | "timeout" | "invalid-response";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBaseUrl(): string {
  const origin = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(
    /\/+$/,
    "",
  );
  const prefix = (
    process.env.NEXT_PUBLIC_API_PREFIX || DEFAULT_API_PREFIX
  ).replace(/^\/+|\/+$/g, "");

  return `${origin}/${prefix}`;
}

export function getApiEndpoint(path: string): string {
  return `${apiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

function apiMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === "string")
    ) {
      return message.join(" ");
    }
  }
  return `A API respondeu com erro HTTP ${status}.`;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.body === undefined
            ? {}
            : { "Content-Type": "application/json" }),
          ...init.headers,
        },
        signal: controller.signal,
        cache: init.cache ?? "no-store",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          "A API demorou para responder. Tente novamente.",
          "timeout",
        );
      }
      throw new ApiError(
        "Não foi possível conectar à API. Verifique se o backend está em execução.",
        "network",
      );
    }

    let payload: unknown = null;
    try {
      const text = response.status === 204 ? "" : await response.text();
      if (text) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          if (response.ok) throw new Error("invalid-json");
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          "A API demorou para responder. Tente novamente.",
          "timeout",
        );
      }
      throw new ApiError(
        "A API retornou uma resposta inválida. Tente novamente mais tarde.",
        "invalid-response",
        response.status,
      );
    }

    if (!response.ok) {
      throw new ApiError(
        apiMessage(payload, response.status),
        "http",
        response.status,
      );
    }

    if (payload === null) {
      throw new ApiError(
        "A API retornou uma resposta vazia.",
        "invalid-response",
        response.status,
      );
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson(path: string): Promise<unknown> {
  return fetchJson(
    getApiEndpoint(path),
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
    REQUEST_TIMEOUT_MS,
  );
}

const BUSINESS_API_MODULES = [
  "inventory",
  "operations",
  "customers",
  "blasters",
  "procurement",
  "commercial",
  "finance",
  "compliance",
  "fiscal",
];

function isBusinessApiPath(path: string): boolean {
  return BUSINESS_API_MODULES.some((module) => {
    const prefix = `/api/${module}`;
    return (
      path === prefix ||
      path.startsWith(`${prefix}/`) ||
      path.startsWith(`${prefix}?`)
    );
  });
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const isBusinessRequest = isBusinessApiPath(path);
  if (isBusinessRequest) await ensureSessionAndNotify();

  let payload: unknown;
  try {
    payload = await fetchJson(
      path,
      {
        ...init,
        credentials: "same-origin",
      },
      BUSINESS_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (
      !isBusinessRequest ||
      !(error instanceof ApiError) ||
      error.status !== 401
    ) {
      throw error;
    }
    sessionValidatedAt = 0;
    await ensureSessionAndNotify();
    try {
      payload = await fetchJson(
        path,
        {
          ...init,
          credentials: "same-origin",
        },
        BUSINESS_REQUEST_TIMEOUT_MS,
      );
    } catch (retryError) {
      notifySessionExpired(retryError);
      throw retryError;
    }
  }
  return payload as T;
}

export function markSessionFresh(): void {
  sessionValidatedAt = Date.now();
}

export function clearSessionFreshness(): void {
  sessionValidatedAt = 0;
}

function isSessionPayload(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "roles" in value &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => typeof role === "string")
  );
}

async function ensureSession(): Promise<void> {
  if (Date.now() - sessionValidatedAt < SESSION_VALIDITY_MS) return;
  if (!sessionCheck) {
    sessionCheck = fetchJson(
      "/api/auth/session",
      { method: "GET", credentials: "same-origin" },
      BUSINESS_REQUEST_TIMEOUT_MS,
    )
      .then((payload) => {
        if (!isSessionPayload(payload)) {
          throw new ApiError(
            "A API retornou uma sessão em formato inesperado.",
            "invalid-response",
          );
        }
        markSessionFresh();
      })
      .finally(() => {
        sessionCheck = null;
      });
  }
  await sessionCheck;
}

async function ensureSessionAndNotify(): Promise<void> {
  try {
    await ensureSession();
  } catch (error) {
    notifySessionExpired(error);
    throw error;
  }
}

function notifySessionExpired(error: unknown): void {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event("erp:session-expired"));
  }
}

function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "ok"
  );
}

async function getHealth(
  path: "health/live" | "health/ready",
): Promise<HealthResponse> {
  const response = await getJson(path);
  if (!isHealthResponse(response)) {
    throw new ApiError(
      "A API retornou dados de saúde em formato inesperado.",
      "invalid-response",
    );
  }

  return response;
}

export function getLiveness(): Promise<HealthResponse> {
  return getHealth("health/live");
}

export function getReadiness(): Promise<HealthResponse> {
  return getHealth("health/ready");
}

export type PageResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
