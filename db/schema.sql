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

create type circularity_route as enum (
  'PREPARATION_FOR_REUSE',
  'RECYCLING',
  'ENERGY_RECOVERY',
  'DISPOSAL'
);

create type rep_actor_role as enum (
  'PRODUCER_IMPORTER',
  'MANAGEMENT_SYSTEM',
  'WASTE_MANAGER',
  'CONSUMER',
  'MUNICIPALITY'
);

create type rep_relationship_type as enum (
  'FINANCES_SYSTEM',
  'CONTRACTS_MANAGER',
  'DELIVERS_WASTE',
  'PUTS_PRODUCT_ON_MARKET'
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

create table organization_rep_roles (
  organization_id uuid not null references organizations(id),
  role rep_actor_role not null,
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb,
  primary key (organization_id, role)
);

create table rep_relationships (
  id uuid primary key default gen_random_uuid(),
  from_organization_id uuid not null references organizations(id),
  to_organization_id uuid not null references organizations(id),
  relationship_type rep_relationship_type not null,
  valid_from date,
  valid_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index rep_relationships_from_idx
  on rep_relationships(from_organization_id, relationship_type);

create index rep_relationships_to_idx
  on rep_relationships(to_organization_id, relationship_type);

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
  circularity_route circularity_route not null,
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

create table valuation_allocations (
  id uuid primary key default gen_random_uuid(),
  valuation_output_id uuid not null references valuation_outputs(id),
  organization_id uuid not null references organizations(id),
  collection_id uuid references collections(id),
  quantity_kg numeric(18,3) not null check (quantity_kg >= 0),
  allocation_method text not null check (allocation_method in ('DIRECT','MASS_SHARE','MANUAL')),
  evidence_document_id uuid references documents(id),
  created_at timestamptz not null default now()
);

create index valuation_allocations_org_idx
  on valuation_allocations(organization_id, valuation_output_id);

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


create table external_source_snapshots (
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

create index external_source_snapshots_subject_idx
  on external_source_snapshots(subject_type, subject_id, source_id, fetched_at desc);


create table external_source_records (
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

create index external_source_records_lookup_idx
  on external_source_records(source_id, canonical_name);

create table external_source_sync_runs (
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


-- B2B corporate account layer
create table if not exists b2b_account_contacts (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references organizations(id),
  side text not null check (side in ('CLIENT','RECYCLA')),
  full_name text not null,
  email text,
  phone text,
  title text,
  responsibility text,
  is_primary boolean not null default false,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index if not exists b2b_account_contacts_org_idx
  on b2b_account_contacts(client_organization_id, side, is_primary desc);

create unique index if not exists b2b_account_contacts_primary_side_uidx
  on b2b_account_contacts(client_organization_id, side)
  where is_primary = true and valid_to is null;

create table if not exists b2b_service_contracts (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references organizations(id),
  contract_ref text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','ACTIVE','SUSPENDED','EXPIRED','ENDED')),
  starts_at date,
  ends_at date,
  renewal_at date,
  currency text check (currency is null or char_length(currency) = 3),
  billing_model text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists b2b_service_contracts_org_idx
  on b2b_service_contracts(client_organization_id, status, ends_at);

create unique index if not exists b2b_service_contracts_ref_uidx
  on b2b_service_contracts(client_organization_id, contract_ref)
  where contract_ref is not null;

create table if not exists b2b_contract_services (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references b2b_service_contracts(id) on delete cascade,
  site_id uuid references sites(id),
  stream priority_stream,
  service_code text not null,
  service_name text not null,
  frequency text,
  included_quantity numeric(18,3),
  unit text check (unit is null or unit in ('kg','l')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (included_quantity is null or included_quantity >= 0)
);

create index if not exists b2b_contract_services_contract_idx
  on b2b_contract_services(contract_id, active);

create table if not exists b2b_service_slas (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references b2b_service_contracts(id) on delete cascade,
  metric_code text not null,
  label text not null,
  target_value numeric(18,3) not null,
  target_unit text not null,
  comparison text not null default 'LE'
    check (comparison in ('LT','LE','EQ','GE','GT')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(contract_id, metric_code),
  check (target_value >= 0)
);

create index if not exists b2b_service_slas_contract_idx
  on b2b_service_slas(contract_id, active);


create table if not exists b2b_account_change_log (
  id uuid primary key default gen_random_uuid(),
  client_organization_id uuid not null references organizations(id),
  entity_type text not null
    check (entity_type in ('CONTACT','CONTRACT','SERVICE','SLA')),
  entity_id uuid not null,
  action text not null
    check (action in ('CREATE','UPDATE','END','DEACTIVATE')),
  actor_ref text,
  changed_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists b2b_account_change_log_org_idx
  on b2b_account_change_log(client_organization_id, created_at desc);
