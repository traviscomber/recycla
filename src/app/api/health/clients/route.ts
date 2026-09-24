import { NextResponse } from "next/server";
import { inspectClientDataIntegrity } from "@/lib/client-data-integrity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json(
      { ok: false, state: "disabled", detail: "Preview-only diagnostic." },
      { status: 404 }
    );
  }

  const integrity = await inspectClientDataIntegrity();

  return NextResponse.json(
    {
      ok: integrity.state === "ready" && integrity.issueCount === 0,
      ...integrity
    },
    {
      status: integrity.state === "ready" ? 200 : 503,
      headers: { "cache-control": "no-store" }
    }
  );
}
