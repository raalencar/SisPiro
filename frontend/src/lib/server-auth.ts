import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getApiEndpoint } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

const ACCESS_COOKIE = "erp_access_token";
const REFRESH_COOKIE = "erp_refresh_token";
const SERVER_REQUEST_TIMEOUT_MS = 15_000;

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresAt: string;
  user: AuthUser;
};

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    "roles" in value &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => typeof role === "string")
  );
}

export function isTokenBundle(value: unknown): value is TokenBundle {
  return (
    typeof value === "object" &&
    value !== null &&
    "accessToken" in value &&
    typeof value.accessToken === "string" &&
    "refreshToken" in value &&
    typeof value.refreshToken === "string" &&
    "expiresIn" in value &&
    typeof value.expiresIn === "number" &&
    Number.isFinite(value.expiresIn) &&
    value.expiresIn > 0 &&
    "refreshExpiresAt" in value &&
    typeof value.refreshExpiresAt === "string" &&
    Number.isFinite(Date.parse(value.refreshExpiresAt)) &&
    "user" in value &&
    isAuthUser(value.user)
  );
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export function setAuthCookies(response: NextResponse, tokens: TokenBundle): void {
  const secure = process.env.NODE_ENV === "production";
  const sharedOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/api",
  };
  const refreshExpiresAt = new Date(tokens.refreshExpiresAt);
  const refreshMaxAge = Math.floor(
    (refreshExpiresAt.getTime() - Date.now()) / 1000,
  );
  if (refreshMaxAge <= 0) {
    throw new Error("A API retornou uma sessão já expirada.");
  }

  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...sharedOptions,
    maxAge: tokens.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...sharedOptions,
    expires: refreshExpiresAt,
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const sharedOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api",
  };
  response.cookies.set(ACCESS_COOKIE, "", { ...sharedOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...sharedOptions, maxAge: 0 });
}

export async function readBackendPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("A API retornou uma resposta que não é JSON válido.");
  }
}

export async function requestBackend(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SERVER_REQUEST_TIMEOUT_MS,
  );
  try {
    return await fetch(getApiEndpoint(path), {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function renewSession(refreshToken: string): Promise<TokenBundle | null> {
  const response = await requestBackend("auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const payload = await readBackendPayload(response);
  if (!response.ok) return null;
  if (!isTokenBundle(payload)) {
    throw new Error("A API retornou tokens de sessão em formato inesperado.");
  }
  return payload;
}

async function sendAuthorizedRequest(
  path: string,
  method: "GET" | "POST",
  accessToken: string,
  body?: string,
): Promise<Response> {
  return requestBackend(path, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body }),
  });
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ message }, { status });
}

export async function proxyAuthenticatedRequest(
  request: Request,
  backendPath: string,
  method: "GET" | "POST",
  refreshOnUnauthorized = true,
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const currentAccessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const currentRefreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let accessToken = currentAccessToken;
  let renewedTokens: TokenBundle | null = null;
  let response: Response;

  try {
    if (!accessToken && currentRefreshToken && refreshOnUnauthorized) {
      renewedTokens = await renewSession(currentRefreshToken);
      accessToken = renewedTokens?.accessToken;
    }
    if (!accessToken) {
      const result = errorResponse("Sessão ausente ou expirada. Entre novamente.", 401);
      if (refreshOnUnauthorized) clearAuthCookies(result);
      return result;
    }

    const body = method === "POST" ? await request.text() : undefined;
    response = await sendAuthorizedRequest(
      backendPath,
      method,
      accessToken,
      body,
    );

    if (
      response.status === 401 &&
      currentRefreshToken &&
      !renewedTokens &&
      refreshOnUnauthorized
    ) {
      renewedTokens = await renewSession(currentRefreshToken);
      if (renewedTokens) {
        response = await sendAuthorizedRequest(
          backendPath,
          method,
          renewedTokens.accessToken,
          body,
        );
      }
    }

    const payload = await readBackendPayload(response);
    const result =
      payload === null && response.status === 204
        ? new NextResponse(null, { status: response.status })
        : NextResponse.json(payload, { status: response.status });
    if (renewedTokens) setAuthCookies(result, renewedTokens);
    if (response.status === 401 && refreshOnUnauthorized) {
      clearAuthCookies(result);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("A API demorou para responder. Tente novamente.", 504);
    }
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a comunicação com a API.",
      502,
    );
  }
}

export async function readRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value;
}
