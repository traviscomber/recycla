-- State Intelligence additive migration
-- Safe to apply independently from the full Recycla REP schema.

create extension if not exists pgcrypto;

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
);

create index if not exists external_source_snapshots_subject_idx
  on external_source_snapshots(subject_type, subject_id, source_id, fetched_at desc);

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
);

create index if not exists external_source_records_lookup_idx
  on external_source_records(source_id, canonical_name);

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
);
