import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tokenConfigured = Boolean(process.env.STATE_SYNC_TOKEN);
  const databaseConfigured = hasDatabase();

  let databaseProvider = "unknown";
  try {
    const hostname = process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).hostname
      : "";
    databaseProvider = hostname.includes("neon.tech")
      ? "neon"
      : hostname.includes("supabase")
        ? "supabase"
        : hostname
          ? "postgres"
          : "unknown";
  } catch {
    databaseProvider = "unknown";
  }

  let stateSchema = "not_configured";

  if (databaseConfigured) {
    try {
      const sql = db();
      const rows = await sql<Array<{
        snapshots: string | null;
        records: string | null;
        runs: string | null;
      }>>`
        select
          to_regclass('public.external_source_snapshots')::text as snapshots,
          to_regclass('public.external_source_records')::text as records,
          to_regclass('public.external_source_sync_runs')::text as runs
      `;

      const row = rows[0];
      stateSchema =
        row?.snapshots && row?.records && row?.runs
          ? "ready"
          : "migration_pending";
    } catch {
      stateSchema = "unavailable";
    }
  }

  return NextResponse.json({
    ok: tokenConfigured && databaseConfigured && stateSchema === "ready",
    tokenConfigured,
    databaseConfigured,
    databaseProvider,
    stateSchema
  });
}
