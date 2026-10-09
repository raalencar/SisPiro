import { NextResponse } from "next/server";
import {
  isSameOriginRequest,
  readBackendPayload,
  requestBackend,
} from "@/lib/server-auth";

type ConfirmPasswordResetInput = {
  token: string;
  newPassword: string;
};

function isConfirmPasswordResetInput(value: unknown): value is ConfirmPasswordResetInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    typeof value.token === "string" &&
    value.token.trim().length > 0 &&
    "newPassword" in value &&
    typeof value.newPassword === "string" &&
    value.newPassword.length > 0
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
      { message: "Informe o token de recuperação e a nova senha." },
      { status: 400 },
    );
  }

  if (!isConfirmPasswordResetInput(input)) {
    return NextResponse.json(
      { message: "Informe o token de recuperação e a nova senha." },
      { status: 400 },
    );
  }

  try {
    const upstream = await requestBackend("auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: input.token.trim(),
        newPassword: input.newPassword,
      }),
    });
    const payload = await readBackendPayload(upstream);
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível confirmar a redefinição de senha com a API.",
      },
      { status: 502 },
    );
  }
}

