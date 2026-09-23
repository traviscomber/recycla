import { NextRequest, NextResponse } from "next/server";
import { runCompliancePrecheck } from "@/lib/compliance-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, error: "Preview only." }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("run") !== "1") {
    return NextResponse.json({ ok: false, error: "Missing run=1." }, { status: 400 });
  }

  const result = await runCompliancePrecheck("recycla-os");
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
