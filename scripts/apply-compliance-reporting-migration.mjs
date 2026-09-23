import postgres from "postgres";

if (!process.env.DATABASE_URL || process.env.VERCEL_GIT_COMMIT_REF !== "feat/state-intelligence") {
  console.log("[compliance-migration] prerequisites missing; skipping.");
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
  idle_timeout: 10
});

try {
  await sql`
    create table if not exists monthly_rep_reports (
      id uuid primary key default gen_random_uuid(),
      subject_ref text not null,
      reporting_month date not null,
      source_period_start date not null,
      source_period_end date not null,
      status text not null default 'DRAFT'
        check (status in ('DRAFT','READY','SUBMITTED','REOPENED')),
      introduced_market jsonb not null default '{}'::jsonb,
      waste_operations jsonb not null default '{}'::jsonb,
      evidence_summary jsonb not null default '{}'::jsonb,
      checksum_sha256 text,
      version int not null default 1,
      generated_at timestamptz not null default now(),
      finalized_at timestamptz,
      unique(subject_ref, reporting_month, version)
    )
  `;

  await sql`
    create index if not exists monthly_rep_reports_subject_idx
      on monthly_rep_reports(subject_ref, reporting_month desc, version desc)
  `;

  await sql`
    create table if not exists compliance_check_runs (
      id uuid primary key default gen_random_uuid(),
      subject_ref text not null,
      reporting_month date,
      status text not null default 'RUNNING'
        check (status in ('RUNNING','PASS','HOLD','FAILED')),
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      summary jsonb not null default '{}'::jsonb
    )
  `;

  await sql`
    create index if not exists compliance_check_runs_subject_idx
      on compliance_check_runs(subject_ref, started_at desc)
  `;

  await sql`
    create table if not exists compliance_check_results (
      id uuid primary key default gen_random_uuid(),
      run_id uuid not null references compliance_check_runs(id) on delete cascade,
      gate_id text not null,
      status text not null
        check (status in ('LIVE','READY','REVIEW_REQUIRED','BLOCKED','NOT_CONNECTED')),
      blocking boolean not null default false,
      detail text not null,
      evidence_count int not null default 0,
      created_at timestamptz not null default now(),
      unique(run_id, gate_id)
    )
  `;

  const [status] = await sql`
    select
      to_regclass('public.monthly_rep_reports')::text as monthly,
      to_regclass('public.compliance_check_runs')::text as runs,
      to_regclass('public.compliance_check_results')::text as results
  `;

  if (!status?.monthly || !status?.runs || !status?.results) {
    throw new Error("Compliance reporting schema verification failed.");
  }

  console.log("[compliance-migration] compliance reporting schema ready.");
} finally {
  await sql.end({ timeout: 5 });
}
