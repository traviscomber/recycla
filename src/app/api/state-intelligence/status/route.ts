import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function bootstrapPreviewStateSchema() {
  if (process.env.VERCEL_ENV !== "preview") return false;
  if (!process.env.STATE_SYNC_TOKEN || !hasDatabase()) return false;

  const sql = db();

  await sql`create extension if not exists pgcrypto`;

  await sql`
    create table if not exists external_source_snapshots (
      id uuid primary key default gen_random_uuid(),
      source_id text not null,
      source_url text not null,
      subject_type text not null,
      subject_id uuid,
      external_identifier text,
      status text not null check (status in ('VERIFIED','NOT_FOUND','REVIEW_REQUIRED','UNAVAILABLE')),
      fetched_at timestamptz not null default now(),
      source_modified_at timestamptz,
      normalized_payload jsonb not null default '{}'::jsonb,
      checksum_sha256 text,
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists external_source_snapshots_subject_idx
    on external_source_snapshots(subject_type, subject_id, source_id, fetched_at desc)
  `;

  await sql`
    create table if not exists external_source_records (
      id uuid primary key default gen_random_uuid(),
      source_id text not null,
      resource_id text not null,
      resource_name text not null,
      source_year int,
      external_identifier text,
      canonical_name text,
      normalized_payload jsonb not null,
      record_sha256 text not null,
      source_url text not null,
      ingested_at timestamptz not null default now(),
      unique(source_id, resource_id, record_sha256)
    )
  `;

  await sql`
    create index if not exists external_source_records_lookup_idx
    on external_source_records(source_id, canonical_name)
  `;

  await sql`
    create table if not exists external_source_sync_runs (
      id uuid primary key default gen_random_uuid(),
      source_id text not null,
      resource_id text,
      resource_name text,
      source_year int,
      status text not null check (status in ('RUNNING','SUCCESS','FAILED','SKIPPED')),
      row_count int not null default 0,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      detail text
    )
  `;

  return true;
}

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
  let bootstrapped = false;

  if (databaseConfigured) {
    try {
      const sql = db();

      const inspect = async () => {
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
        return row?.snapshots && row?.records && row?.runs
          ? "ready"
          : "migration_pending";
      };

      stateSchema = await inspect();

      if (stateSchema === "migration_pending") {
        bootstrapped = await bootstrapPreviewStateSchema();
        if (bootstrapped) stateSchema = await inspect();
      }
    } catch {
      stateSchema = "unavailable";
    }
  }

  return NextResponse.json({
    ok: tokenConfigured && databaseConfigured && stateSchema === "ready",
    tokenConfigured,
    databaseConfigured,
    databaseProvider,
    stateSchema,
    bootstrapped
  });
}
