import { NextRequest, NextResponse } from "next/server";
import { buildCompliancePack } from "@/lib/compliance-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.STATE_SYNC_TOKEN;
  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: "Export authorization is not configured." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const subjectRef = request.nextUrl.searchParams.get("subject")?.trim() || "recycla-os";
  const pack = await buildCompliancePack(subjectRef);

  const month = pack.reportingMonth ?? "no-period";
  const fileName = `recycla-compliance-pack-${month}.json`;

  return new NextResponse(JSON.stringify(pack, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store"
    }
  });
}
