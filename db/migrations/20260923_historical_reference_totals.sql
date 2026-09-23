-- Public historical reference totals used only for backfill reconciliation.
-- They are benchmarks, not operational transactions and do not satisfy REP compliance by themselves.

create table if not exists historical_reference_totals (
  id uuid primary key default gen_random_uuid(),
  subject_ref text not null,
  reference_year int not null,
  metric_scope text not null,
  category text not null,
  quantity numeric(18,3) not null check (quantity >= 0),
  unit text not null,
  source_label text not null,
  source_url text not null,
  source_checksum_sha256 text,
  captured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(subject_ref, reference_year, metric_scope, category, source_url)
);

create index if not exists historical_reference_totals_year_idx
  on historical_reference_totals(subject_ref, reference_year, metric_scope);
