-- Controlled reporting intake lineage and idempotency.

alter table market_introductions
  add column if not exists import_batch_id uuid,
  add column if not exists source_row_hash text;

alter table waste_management_operations
  add column if not exists import_batch_id uuid,
  add column if not exists source_row_hash text;

create unique index if not exists market_introductions_source_hash_idx
  on market_introductions(subject_ref, source_row_hash)
  where source_row_hash is not null;

create unique index if not exists waste_management_operations_source_hash_idx
  on waste_management_operations(subject_ref, source_row_hash)
  where source_row_hash is not null;

create table if not exists reporting_import_batches (
  id uuid primary key default gen_random_uuid(),
  subject_ref text not null,
  import_type text not null
    check (import_type in ('MARKET_INTRODUCTIONS','WASTE_OPERATIONS')),
  file_name text,
  file_sha256 text not null,
  status text not null default 'VALIDATING'
    check (status in ('VALIDATING','IMPORTED','REJECTED','PARTIAL')),
  total_rows int not null default 0,
  accepted_rows int not null default 0,
  rejected_rows int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists reporting_import_batches_file_idx
  on reporting_import_batches(subject_ref, import_type, file_sha256);
