import { NextResponse } from "next/server";
import {
  isSameOriginRequest,
  proxyAuthenticatedRequest,
} from "@/lib/server-auth";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function backendPath(
  path: string[],
  method: "GET" | "POST",
): string | null {
  if (path.length === 0) return null;

  // Lançamentos e pagamentos
  if (path[0] === "entries") {
    if (path.length === 1 && (method === "GET" || method === "POST")) {
      return "finance/entries";
    }
    if (path.length === 2 && UUID_PATTERN.test(path[1]) && method === "GET") {
      return `finance/entries/${path[1]}`;
    }
    if (
      path.length === 3 &&
      UUID_PATTERN.test(path[1]) &&
      method === "POST" &&
      (path[2] === "payments" || path[2] === "cancel")
    ) {
      return `finance/entries/${path[1]}/${path[2]}`;
    }
    return null;
  }

  // Fluxo de caixa e dashboard
  if (path[0] === "cash-flow" && path.length === 1 && method === "GET") {
    return "finance/cash-flow";
  }
  if (path[0] === "dashboard" && path.length === 1 && method === "GET") {
    return "finance/dashboard";
  }

  // Relatórios financeiros
  if (path[0] === "reports") {
    if (path[1] === "payment-breakdown" && method === "GET") {
      return "finance/reports/payment-breakdown";
    }
    if (path[1] === "aging" && method === "GET") {
      return "financial/reports/aging";
    }
  }

  return null;
}

function invalidPath(): NextResponse {
  return NextResponse.json(
    { message: "Endpoint financeiro não disponível." },
    { status: 404 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "GET");
  if (!target) return invalidPath();
  const query = new URL(request.url).search;
  return proxyAuthenticatedRequest(
    request,
    `${target}${query}`,
    "GET",
    false,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "POST");
  if (!target) return invalidPath();
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origem da requisição não permitida." },
      { status: 403 },
    );
  }
  return proxyAuthenticatedRequest(
    request,
    target,
    "POST",
    false,
  );
}

