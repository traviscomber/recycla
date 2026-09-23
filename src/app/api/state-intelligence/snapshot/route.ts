import { NextRequest, NextResponse } from "next/server";
import { persistOfficialSnapshot } from "@/lib/state-snapshots";
import type { VerificationKind } from "@/lib/state-intelligence";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedKinds = new Set<VerificationKind>([
  "producer",
  "hazardous_destination",
  "storage_site"
]);

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.STATE_SYNC_TOKEN;

  if (!configuredSecret) {
    return NextResponse.json(
      { ok: false, error: "STATE_SYNC_TOKEN is not configured." },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${configuredSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    kind?: VerificationKind;
    query?: string;
    matchIndex?: number;
    subjectType?: string;
    subjectId?: string | null;
    status?: "VERIFIED" | "REVIEW_REQUIRED";
  };

  if (!body.kind || !allowedKinds.has(body.kind)) {
    return NextResponse.json({ ok: false, error: "Invalid kind." }, { status: 400 });
  }

  if (!body.query || body.query.trim().length < 3) {
    return NextResponse.json({ ok: false, error: "Invalid query." }, { status: 400 });
  }

  if (!body.subjectType || body.subjectType.trim().length < 2) {
    return NextResponse.json({ ok: false, error: "Invalid subjectType." }, { status: 400 });
  }

  const result = await persistOfficialSnapshot({
    kind: body.kind,
    query: body.query,
    matchIndex: body.matchIndex,
    subjectType: body.subjectType,
    subjectId: body.subjectId ?? null,
    status: body.status
  });

  return NextResponse.json(
    { ok: result.ok, result },
    { status: result.ok ? 201 : 409 }
  );
}
