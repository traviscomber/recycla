-- Normalized REP reporting inputs required for monthly reconciliation.
-- Fields follow the traceability/reporting requirements encoded in Recycla OS.

create table if not exists market_introductions (
  id uuid primary key default gen_random_uuid(),
  subject_ref text not null,
  occurred_at date not null,
  priority_product text not null,
  category text,
  subcategory text,
  units numeric(18,3),
  quantity numeric(18,3),
  unit text,
  consumer_ref text,
  consumer_type text,
  transaction_ref text,
  source_document_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_introductions_period_idx
  on market_introductions(subject_ref, occurred_at, priority_product);

create table if not exists waste_management_operations (
  id uuid primary key default gen_random_uuid(),
  subject_ref text not null,
  occurred_at date not null,
  priority_product text not null,
  category text,
  subcategory text,
  operation_type text not null,
  counterparty_ref text,
  counterparty_name text,
  quantity numeric(18,3) not null check (quantity >= 0),
  unit text not null,
  cost_clp numeric(18,2),
  tax_document_ref text,
  source_document_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists waste_management_operations_period_idx
  on waste_management_operations(subject_ref, occurred_at, priority_product);
