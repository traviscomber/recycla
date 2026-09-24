-- Recycla Outcome Planning
-- Additive/idempotent planning layer. Keeps planned work separate from canonical completed collections.

do $$ begin
  create type collection_plan_status as enum (
    'DRAFT',
    'PLANNED',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists collection_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  site_id uuid references sites(id),
  stream priority_stream not null,
  planned_start timestamptz not null,
  planned_end timestamptz,
  estimated_quantity numeric(18,3),
  estimated_unit text check (estimated_unit in ('kg','l')),
  status collection_plan_status not null default 'DRAFT',
  counterparty_name text,
  vehicle_ref text,
  notes text,
  source_collection_id uuid references collections(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planned_end is null or planned_end >= planned_start),
  check (estimated_quantity is null or estimated_quantity >= 0)
);

create index if not exists collection_plans_schedule_idx
  on collection_plans(planned_start, planned_end);

create index if not exists collection_plans_org_stream_idx
  on collection_plans(organization_id, stream, planned_start);

create unique index if not exists collection_plans_source_collection_uidx
  on collection_plans(source_collection_id)
  where source_collection_id is not null;
