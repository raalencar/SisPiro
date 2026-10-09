import { NextResponse } from "next/server";
import {
  isAuthUser,
  isSameOriginRequest,
  isTokenBundle,
  readBackendPayload,
  requestBackend,
  setAuthCookies,
} from "@/lib/server-auth";

type MfaLoginRequest = {
  mfaToken: string;
  code: string;
};

function isMfaLoginRequest(value: unknown): value is MfaLoginRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "mfaToken" in value &&
    typeof value.mfaToken === "string" &&
    "code" in value &&
    typeof value.code === "string"
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origem da requisição não permitida." },
      { status: 403 },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Informe o token MFA e o código de autenticação." },
      { status: 400 },
    );
  }
  if (!isMfaLoginRequest(input)) {
    return NextResponse.json(
      { message: "Informe o token MFA e o código de autenticação." },
      { status: 400 },
    );
  }

  try {
    const upstream = await requestBackend("auth/login/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const payload = await readBackendPayload(upstream);
    if (!upstream.ok) {
      return NextResponse.json(payload, { status: upstream.status });
    }
    if (!isTokenBundle(payload) || !isAuthUser(payload.user)) {
      return NextResponse.json(
        { message: "A API retornou uma sessão em formato inesperado." },
        { status: 502 },
      );
    }

    const response = NextResponse.json(payload.user);
    setAuthCookies(response, payload);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível validar o código MFA com a API.",
      },
      { status: 502 },
    );
  }
}

