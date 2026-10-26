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

  // 1. Documentos Fiscais
  if (path[0] === "documents") {
    if (path.length === 1 && method === "GET") {
      return "fiscal/documents";
    }
    if (path.length === 2 && UUID_PATTERN.test(path[1]) && method === "GET") {
      return `fiscal/documents/${path[1]}`;
    }
    if (
      path.length === 3 &&
      UUID_PATTERN.test(path[1]) &&
      path[2] === "cancel" &&
      method === "POST"
    ) {
      return `fiscal/documents/${path[1]}/cancel`;
    }
    return null;
  }

  // 2. Emissão de NF-e (Modelo 55)
  if (path[0] === "nfe" && path.length === 1 && method === "POST") {
    return "fiscal/nfe";
  }

  // 3. Emissão de NFC-e (Modelo 65)
  if (path[0] === "nfce" && path.length === 1 && method === "POST") {
    return "fiscal/nfce";
  }

  // 4. Emissão de NFS-e (Serviços)
  if (path[0] === "nfse" && path.length === 1 && method === "POST") {
    return "fiscal/nfse";
  }

  return null;
}

function invalidPath(): NextResponse {
  return NextResponse.json(
    { message: "Endpoint fiscal não disponível." },
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
