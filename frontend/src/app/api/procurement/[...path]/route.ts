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
  method: "GET" | "POST" | "PATCH",
): string | null {
  if (path.length === 0) return null;

  // Fornecedores: /suppliers
  if (path[0] === "suppliers") {
    if (path.length === 1 && (method === "GET" || method === "POST")) {
      return "suppliers";
    }
    if (path.length === 2 && UUID_PATTERN.test(path[1])) {
      if (method === "GET" || method === "PATCH") {
        return `suppliers/${path[1]}`;
      }
    }
    return null;
  }

  // Compras: /purchases
  if (path[0] === "purchases") {
    if (path.length === 1 && (method === "GET" || method === "POST")) {
      return "purchases";
    }
    if (path.length === 2 && UUID_PATTERN.test(path[1]) && method === "GET") {
      return `purchases/${path[1]}`;
    }
    if (
      path.length === 3 &&
      UUID_PATTERN.test(path[1]) &&
      method === "POST" &&
      (path[2] === "receive" || path[2] === "cancel")
    ) {
      return `purchases/${path[1]}/${path[2]}`;
    }
    return null;
  }

  return null;
}

function invalidPath(): NextResponse {
  return NextResponse.json(
    { message: "Endpoint de compras/fornecedores não disponível." },
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

