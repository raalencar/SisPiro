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
const ORDER_ACTIONS = new Set(["approve", "start", "cancel", "close"]);
const REFERENCE_ENDPOINTS: Record<string, string> = {
  customers: "customers/operational-options",
  blasters: "blasters/operational-options",
  lots: "inventory/operational-lots",
};

function backendPath(
  path: string[],
  method: "GET" | "POST" | "PUT",
): string | null {
  if (path[0] === "references" && path.length === 2 && method === "GET") {
    return REFERENCE_ENDPOINTS[path[1]] ?? null;
  }
  if (path[0] !== "orders") return null;
  if (path.length === 1 && (method === "GET" || method === "POST"))
    return "operations/orders";
  if (
    path.length === 3 &&
    path[1] === "reports" &&
    path[2] === "summary" &&
    method === "GET"
  ) {
    return "operations/orders/reports/summary";
  }
  if (
    path.length === 2 &&
    UUID_PATTERN.test(path[1]) &&
    (method === "GET" || method === "PUT")
  ) {
    return `operations/orders/${path[1]}`;
  }
  if (
    path.length === 3 &&
    method === "POST" &&
    UUID_PATTERN.test(path[1]) &&
    ORDER_ACTIONS.has(path[2])
  ) {
    return `operations/orders/${path[1]}/${path[2]}`;
  }
  return null;
}

function invalidPath(): NextResponse {
  return NextResponse.json(
    { message: "Endpoint de operações não disponível." },
    { status: 404 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "GET");
  if (!target) return invalidPath();
  return proxyAuthenticatedRequest(
    request,
    `${target}${new URL(request.url).search}`,
    "GET",
    false,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "POST");
  if (
    !target ||
    !(
      path.length === 1 ||
      (path.length === 3 &&
        UUID_PATTERN.test(path[1]) &&
        ORDER_ACTIONS.has(path[2]))
    )
  ) {
    return invalidPath();
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origem da requisição não permitida." },
      { status: 403 },
    );
  }
  return proxyAuthenticatedRequest(request, target, "POST", false);
}

export async function PUT(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const target = backendPath(path, "PUT");
  if (!target || !(path.length === 2 && UUID_PATTERN.test(path[1]))) {
    return invalidPath();
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origem da requisição não permitida." },
      { status: 403 },
    );
  }
  return proxyAuthenticatedRequest(request, target, "PUT", false);
}
