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
  method: "GET" | "POST" | "PUT" | "PATCH",
): string | null {
  if (path.length === 0) return null;

  // 1. Tabelas de Preço: /pricing/lists
  if (path[0] === "pricing" && path[1] === "lists") {
    if (path.length === 2 && (method === "GET" || method === "POST")) {
      return "pricing/lists";
    }
    if (path.length === 3 && UUID_PATTERN.test(path[2]) && method === "GET") {
      return `pricing/lists/${path[2]}`;
    }
    return null;
  }

  // 2. Promoções: /pricing/promotions
  if (path[0] === "pricing" && path[1] === "promotions") {
    if (path.length === 2 && (method === "GET" || method === "POST")) {
      return "pricing/promotions";
    }
    if (path.length === 3 && UUID_PATTERN.test(path[2])) {
      if (method === "GET" || method === "PATCH") {
        return `pricing/promotions/${path[2]}`;
      }
    }
    return null;
  }

  // 3. Orçamentos Comerciais: /sales/quotes
  if (path[0] === "quotes") {
    if (path.length === 1 && (method === "GET" || method === "POST")) {
      return "sales/quotes";
    }
    if (path.length === 2 && UUID_PATTERN.test(path[1])) {
      if (method === "GET" || method === "PUT") {
        return `sales/quotes/${path[1]}`;
      }
    }
    if (
      path.length === 3 &&
      UUID_PATTERN.test(path[1]) &&
      method === "POST" &&
      (path[2] === "cancel" || path[2] === "convert" || path[2] === "send")
    ) {
      return `sales/quotes/${path[1]}/${path[2]}`;
    }
    return null;
  }

  // 4. Vendas / PDV: /sales
  if (path[0] === "sales") {
    if (path.length === 1 && (method === "GET" || method === "POST")) {
      return "sales";
    }
    if (
      path.length === 3 &&
      path[1] === "reports" &&
      path[2] === "summary" &&
      method === "GET"
    ) {
      return "sales/reports/summary";
    }
    if (path.length === 2 && UUID_PATTERN.test(path[1]) && method === "GET") {
      return `sales/${path[1]}`;
    }
    if (
      path.length === 3 &&
      UUID_PATTERN.test(path[1]) &&
      path[2] === "returns" &&
      (method === "GET" || method === "POST")
    ) {
      return `sales/${path[1]}/returns`;
    }
    return null;
  }

  // 5. Relatórios Comerciais: /commercial/reports/quotes-conversion
  if (
    path[0] === "reports" &&
    path[1] === "quotes-conversion" &&
    method === "GET"
  ) {
    return "commercial/reports/quotes-conversion";
  }

  return null;
}

function invalidPath(): NextResponse {
  return NextResponse.json(
    { message: "Endpoint comercial não disponível." },
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

export async function PUT(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "PUT");
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
    "PUT",
    false,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "PATCH");
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
    "PATCH",
    false,
  );
}

