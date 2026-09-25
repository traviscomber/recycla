-- Recycla B2B account model
-- Additive/idempotent account layer for corporate contacts, service contracts and SLA terms.
-- No existing REP facts are rewritten.

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
