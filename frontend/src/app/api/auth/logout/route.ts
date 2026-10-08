import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  isSameOriginRequest,
  readBackendPayload,
  readRefreshToken,
  requestBackend,
} from "@/lib/server-auth";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Origem da requisição não permitida." }, { status: 403 });
  }

  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    return response;
  }

  try {
    const upstream = await requestBackend("auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const payload = await readBackendPayload(upstream);
    const response = NextResponse.json(payload, { status: upstream.status });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível revogar a sessão na API.",
      },
      { status: 502 },
    );
    clearAuthCookies(response);
    return response;
  }
}
