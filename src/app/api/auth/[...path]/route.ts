import { isAuthConfigured, getAuthServer } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthRouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: AuthRouteContext) {
  if (!isAuthConfigured()) {
    return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  return getAuthServer().handler().GET(request, context);
}

export async function POST(request: Request, context: AuthRouteContext) {
  if (!isAuthConfigured()) {
    return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  return getAuthServer().handler().POST(request, context);
}
