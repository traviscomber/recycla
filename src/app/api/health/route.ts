import { NextRequest, NextResponse } from "next/server";
import { inspectSchemaContract } from "@/lib/schema-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const health = await inspectSchemaContract();
  const wantsDetail = request.nextUrl.searchParams.get("detail") === "1";
  const configuredSecret = process.env.STATE_SYNC_TOKEN;
  const authorized =
    Boolean(configuredSecret) &&
    request.headers.get("authorization") === `Bearer ${configuredSecret}`;

  const body = {
    ok: health.state === "ready",
    state: health.state,
    checkedAt: health.checkedAt,
    requiredTableCount: health.requiredTableCount,
    presentTableCount: health.presentTableCount,
    detail: health.detail,
    ...(wantsDetail && authorized
      ? {
          missingTables: health.missingTables,
          missingColumns: health.missingColumns
        }
      : {})
  };

  const status =
    health.state === "ready"
      ? 200
      : health.state === "not_configured"
        ? 503
        : health.state === "schema_missing"
          ? 503
          : 502;

  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store"
    }
  });
}
