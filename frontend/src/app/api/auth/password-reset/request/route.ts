import { NextResponse } from "next/server";
import {
  isSameOriginRequest,
  readBackendPayload,
  requestBackend,
} from "@/lib/server-auth";

type RequestPasswordResetInput = {
  email: string;
};

function isRequestPasswordResetInput(value: unknown): value is RequestPasswordResetInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "email" in value &&
    typeof value.email === "string" &&
    value.email.trim().length > 0
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
      { message: "Informe um e-mail válido." },
      { status: 400 },
    );
  }

  if (!isRequestPasswordResetInput(input)) {
    return NextResponse.json(
      { message: "Informe um e-mail válido." },
      { status: 400 },
    );
  }

  try {
    const upstream = await requestBackend("auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.email.trim().toLowerCase() }),
    });
    const payload = await readBackendPayload(upstream);
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível solicitar a recuperação de senha à API.",
      },
      { status: 502 },
    );
  }
}

