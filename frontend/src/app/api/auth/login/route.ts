import { NextResponse } from "next/server";
import {
  isAuthUser,
  isSameOriginRequest,
  isTokenBundle,
  readBackendPayload,
  requestBackend,
  setAuthCookies,
} from "@/lib/server-auth";

type LoginRequest = {
  email: string;
  password: string;
};

function isLoginRequest(value: unknown): value is LoginRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    "password" in value &&
    typeof value.password === "string"
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Origem da requisição não permitida." }, { status: 403 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ message: "Informe e-mail e senha válidos." }, { status: 400 });
  }
  if (!isLoginRequest(input)) {
    return NextResponse.json({ message: "Informe e-mail e senha válidos." }, { status: 400 });
  }

  try {
    const upstream = await requestBackend("auth/login", {
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
            : "Não foi possível autenticar com a API.",
      },
      { status: 502 },
    );
  }
}
