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

function validReadPath(path: string[]): boolean {
  if (path.length === 0) return true;
  if (path.length === 1 && path[0] === "operational-options") return true;
  if (path.length === 1 && UUID_PATTERN.test(path[0])) return true;
  return false;
}

function validCreatePath(path: string[]): boolean {
  if (path.length === 0) return true;
  if (path.length === 2 && UUID_PATTERN.test(path[0]) && path[1] === "eligibility") {
    return true;
  }
  return false;
}

function validPatchPath(path: string[]): boolean {
  return path.length === 1 && UUID_PATTERN.test(path[0]);
}

function invalidPath(): NextResponse {
  return NextResponse.json(
    { message: "Endpoint de blasters não disponível." },
    { status: 404 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!validReadPath(path)) return invalidPath();
  const query = new URL(request.url).search;
  const target = path.length === 0 ? "blasters" : `blasters/${path.join("/")}`;
  return proxyAuthenticatedRequest(
    request,
    `${target}${query}`,
    "GET",
    false,
  );
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!validCreatePath(path)) return invalidPath();
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origem da requisição não permitida." },
      { status: 403 },
    );
  }
  const target = path.length === 0 ? "blasters" : `blasters/${path.join("/")}`;
  return proxyAuthenticatedRequest(
    request,
    target,
    "POST",
    false,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { path } = await context.params;
  if (!validPatchPath(path)) return invalidPath();
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origem da requisição não permitida." },
      { status: 403 },
    );
  }
  return proxyAuthenticatedRequest(
    request,
    `blasters/${path[0]}`,
    "PATCH",
    false,
  );
}

