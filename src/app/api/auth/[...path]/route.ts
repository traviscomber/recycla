import { isAuthConfigured, getAuthServer } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthConfigured()) {
    return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  return getAuthServer().handler().GET(request);
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return Response.json({ error: "AUTH_NOT_CONFIGURED" }, { status: 503 });
  }
  return getAuthServer().handler().POST(request);
}
