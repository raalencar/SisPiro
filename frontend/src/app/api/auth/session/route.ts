import { proxyAuthenticatedRequest } from "@/lib/server-auth";

export async function GET(request: Request) {
  return proxyAuthenticatedRequest(request, "auth/me", "GET");
}
