const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_API_PREFIX = "/api/v1";
const REQUEST_TIMEOUT_MS = 5_000;

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
  const origin = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const prefix = (process.env.NEXT_PUBLIC_API_PREFIX || DEFAULT_API_PREFIX)
    .replace(/^\/+|\/+$/g, "");

  return `${origin}/${prefix}`;
}

export function getApiEndpoint(path: string): string {
  return `${apiBaseUrl()}/${path.replace(/^\/+/, "")}`;
}

async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(getApiEndpoint(path), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
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

    if (!response.ok) {
      throw new ApiError(
        `A API respondeu com erro HTTP ${response.status}.`,
        "http",
        response.status,
      );
    }

    try {
      return (await response.json()) as unknown;
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
  } finally {
    clearTimeout(timeout);
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

async function getHealth(path: "health/live" | "health/ready"): Promise<HealthResponse> {
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
