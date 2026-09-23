import { NextResponse } from "next/server";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import { getLatestComplianceRun } from "@/lib/compliance-runs";
import { db, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({
      ok: false,
      databaseConfigured: false,
      schema: "not_configured"
    });
  }

  try {
    const sql = db();
    const tables = await sql<Array<{
      monthly: string | null;
      runs: string | null;
      results: string | null;
    }>>`
      select
        to_regclass('public.monthly_rep_reports')::text as monthly,
        to_regclass('public.compliance_check_runs')::text as runs,
        to_regclass('public.compliance_check_results')::text as results
    `;

    const schemaReady = Boolean(
      tables[0]?.monthly && tables[0]?.runs && tables[0]?.results
    );

    const [gates, latestRun] = await Promise.all([
      evaluateComplianceReadiness(),
      getLatestComplianceRun("recycla-os")
    ]);

    return NextResponse.json({
      ok: schemaReady,
      databaseConfigured: true,
      schema: schemaReady ? "ready" : "migration_pending",
      gates: gates.map((gate) => ({
        id: gate.id,
        status: gate.status,
        blocking: gate.blocking,
        evidenceCount: gate.evidenceCount,
        detail: gate.detail
      })),
      latestRun
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        databaseConfigured: true,
        schema: "unavailable"
      },
      { status: 503 }
    );
  }
}
