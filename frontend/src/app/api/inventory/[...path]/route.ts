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
const COLLECTIONS = new Set(["products", "magazines", "lots", "movements"]);

function validReadPath(path: string[]): boolean {
  if (path.length === 1 && COLLECTIONS.has(path[0])) return true;
  if (path.length === 2 && COLLECTIONS.has(path[0]) && UUID_PATTERN.test(path[1])) {
    return true;
  }
  return path.length === 2 && path[0] === "reports" && path[1] === "stock-summary";
}

function validCreatePath(path: string[]): boolean {
  return path.length === 1 && COLLECTIONS.has(path[0]);
}

function invalidPath(): NextResponse {
  return NextResponse.json({ message: "Endpoint de estoque não disponível." }, { status: 404 });
}

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!validReadPath(path)) return invalidPath();
  const query = new URL(request.url).search;
  return proxyAuthenticatedRequest(
    request,
    `inventory/${path.join("/")}${query}`,
    "GET",
    false,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!validCreatePath(path)) return invalidPath();
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Origem da requisição não permitida." }, { status: 403 });
  }
  return proxyAuthenticatedRequest(
    request,
    `inventory/${path.join("/")}`,
    "POST",
    false,
  );
}
