-- Persist deterministic REP classification at the data origin.
-- Additive/idempotent. No destructive data rewrite.

alter table market_introductions
  add column if not exists regulatory_stream priority_stream,
  add column if not exists regulatory_category_id text,
  add column if not exists regulatory_pack_version text,
  add column if not exists classification_status text
    check (classification_status in ('VERIFIED','REVIEW_REQUIRED')),
  add column if not exists classification_basis text;

alter table waste_management_operations
  add column if not exists regulatory_stream priority_stream,
  add column if not exists regulatory_category_id text,
  add column if not exists regulatory_pack_version text,
  add column if not exists classification_status text
    check (classification_status in ('VERIFIED','REVIEW_REQUIRED')),
  add column if not exists classification_basis text;

alter table collections
  add column if not exists regulatory_category_id text,
  add column if not exists regulatory_pack_version text,
  add column if not exists classification_status text
    check (classification_status in ('VERIFIED','REVIEW_REQUIRED')),
  add column if not exists classification_basis text;

create index if not exists market_introductions_regulatory_idx
  on market_introductions(regulatory_stream, regulatory_category_id, classification_status, occurred_at desc);

create index if not exists waste_management_operations_regulatory_idx
  on waste_management_operations(regulatory_stream, regulatory_category_id, classification_status, occurred_at desc);

create index if not exists collections_regulatory_idx
  on collections(stream, regulatory_category_id, classification_status, collected_at desc);
