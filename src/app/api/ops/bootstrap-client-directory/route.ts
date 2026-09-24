import { NextRequest, NextResponse } from "next/server";
import { bootstrapClientDirectory } from "@/lib/client-directory-bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const expected = process.env.VERCEL_GIT_COMMIT_SHA;
  const provided = request.nextUrl.searchParams.get("key");

  if (
    process.env.VERCEL_ENV !== "preview" ||
    !expected ||
    !provided ||
    provided !== expected
  ) {
    return NextResponse.json({ ok: false, detail: "Not found." }, { status: 404 });
  }

  const result = await bootstrapClientDirectory();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "cache-control": "no-store" }
  });
}
