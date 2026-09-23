import { NextRequest, NextResponse } from "next/server";
import { syncOfficialSource } from "@/lib/state-ingestion";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedSources = new Set([
  "retc-priority-products",
  "retc-hazardous-destinations",
  "retc-storage-sites"
]);

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.STATE_SYNC_TOKEN;

  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: "STATE_SYNC_TOKEN is not configured." },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const sourceId = request.nextUrl.searchParams.get("source");
  if (!sourceId || !allowedSources.has(sourceId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing source." },
      { status: 400 }
    );
  }

  const result = await syncOfficialSource(sourceId);
  const status = result.status === "FAILED" ? 502 : result.status === "SKIPPED" ? 409 : 200;

  return NextResponse.json({ ok: result.status === "SUCCESS", result }, { status });
}
