create extension if not exists pgcrypto;

create type priority_stream as enum (
  'AEE_RAEE',
  'NEUMATICOS',
  'BATERIAS',
  'PILAS',
  'ACEITES_LUBRICANTES'
);

create type rep_quantity_state as enum (
  'COLLECTED',
  'PROCESSED',
  'VALUED',
  'ELIGIBLE',
  'EVIDENCE_COMPLETE',
  'ACCREDITABLE',
  'SUSPENDED'
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  rut text not null unique,
  slug text not null unique,
  legal_name text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  address text,
  region text,
  commune text,
  created_at timestamptz not null default now()
);

create table reporting_periods (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  starts_at date not null,
  ends_at date not null,
  unique(year)
);

create table rep_rules (
  id uuid primary key default gen_random_uuid(),
  stream priority_stream not null,
  code text not null,
  title text not null,
  source text not null,
  article text,
  effective_from date not null,
  effective_to date,
  rule_version int not null,
  rule_json jsonb not null default '{}'::jsonb,
  unique(stream, code, rule_version)
);

create table rep_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  reporting_period_id uuid not null references reporting_periods(id),
  stream priority_stream not null,
  quantity numeric(18,3) not null check (quantity >= 0),
  unit text not null check (unit in ('kg','l')),
  rule_id uuid references rep_rules(id),
  created_at timestamptz not null default now(),
  unique(organization_id, reporting_period_id, stream)
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  site_id uuid references sites(id),
  stream priority_stream not null,
  external_ref text,
  collected_at timestamptz not null,
  declared_quantity numeric(18,3),
  declared_unit text check (declared_unit in ('kg','l')),
  created_at timestamptz not null default now()
);

create table weighings (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id),
  weighed_at timestamptz not null,
  gross_kg numeric(18,3),
  tare_kg numeric(18,3),
  net_kg numeric(18,3) not null check (net_kg >= 0),
  evidence_document_id uuid,
  created_at timestamptz not null default now()
);

create table lots (
  id uuid primary key default gen_random_uuid(),
  stream priority_stream not null,
  lot_code text not null unique,
  opened_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table lot_inputs (
  lot_id uuid not null references lots(id),
  collection_id uuid not null references collections(id),
  quantity_kg numeric(18,3) not null check (quantity_kg >= 0),
  primary key (lot_id, collection_id)
);

create table processing_events (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  process_type text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table valuation_outputs (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references lots(id),
  material_code text not null,
  quantity_kg numeric(18,3) not null check (quantity_kg >= 0),
  destination_name text,
  valued_at timestamptz,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  document_type text not null,
  file_name text not null,
  checksum_sha256 text,
  issued_at date,
  expires_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table weighings
  add constraint weighings_evidence_document_fk
  foreign key (evidence_document_id) references documents(id);

create table evidence_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id),
  entity_type text not null,
  entity_id uuid not null,
  evidence_role text not null,
  created_at timestamptz not null default now()
);

create table rep_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  reporting_period_id uuid not null references reporting_periods(id),
  stream priority_stream not null,
  state rep_quantity_state not null,
  quantity numeric(18,3) not null check (quantity >= 0),
  unit text not null check (unit in ('kg','l')),
  source_entity_type text not null,
  source_entity_id uuid not null,
  lineage_root_id uuid not null,
  rule_id uuid references rep_rules(id),
  supersedes_entry_id uuid references rep_ledger_entries(id),
  created_at timestamptz not null default now()
);

create index rep_ledger_lineage_idx on rep_ledger_entries(lineage_root_id);
create index rep_ledger_org_period_idx on rep_ledger_entries(organization_id, reporting_period_id, stream, state);

create table audit_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  reporting_period_id uuid references reporting_periods(id),
  severity text not null check (severity in ('critical','warning','info')),
  finding_type text not null,
  entity_type text,
  entity_id uuid,
  affected_quantity numeric(18,3),
  affected_unit text check (affected_unit in ('kg','l')),
  status text not null default 'open' check (status in ('open','resolved','accepted')),
  detail text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
