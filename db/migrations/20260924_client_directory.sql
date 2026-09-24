-- Client directory reconstructed from Recycla Chile's official website.
-- This is a reference directory, not an operational REP obligation table.
-- Do not infer current REP obligations or volumes from these rows.

create table if not exists client_directory (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  rut text,
  canonical_organization_id uuid references organizations(id),
  relationship_status text not null default 'PUBLISHED_CLIENT'
    check (relationship_status in ('PUBLISHED_CLIENT','CANONICAL_CLIENT')),
  source_kind text not null default 'OFFICIAL_WEBSITE'
    check (source_kind in ('OFFICIAL_WEBSITE','CANONICAL_DATABASE')),
  source_url text not null,
  source_observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_directory_name_idx
  on client_directory (lower(display_name));

insert into client_directory (slug, display_name, source_url, metadata)
values
  ('transbank', 'Transbank', 'https://www.recycla.cl/', '{"website":"https://www.transbank.cl/"}'::jsonb),
  ('selecta-envases', 'Selecta Envases', 'https://www.recycla.cl/', '{"website":"http://selectaenvases.cl/"}'::jsonb),
  ('peoplenet', 'Peoplenet', 'https://www.recycla.cl/', '{"website":"http://www.peoplenet.cl/"}'::jsonb),
  ('bosch', 'Bosch', 'https://www.recycla.cl/', '{"website":"https://www.bosch-home.cl/"}'::jsonb),
  ('bci-seguros', 'BCI Seguros', 'https://www.recycla.cl/', '{"website":"https://www.bciseguros.cl/"}'::jsonb),
  ('ibm', 'IBM', 'https://www.recycla.cl/', '{"website":"https://www.ibm.com/cl-es/"}'::jsonb),
  ('gasco', 'Gasco', 'https://www.recycla.cl/', '{"website":"https://www.gasco.cl/"}'::jsonb),
  ('maigas', 'Maigas', 'https://www.recycla.cl/', '{"website":"https://maigas.cl/"}'::jsonb),
  ('colbun', 'Colbún', 'https://www.recycla.cl/', '{"website":"https://www.colbun.cl/"}'::jsonb),
  ('scotiabank', 'Scotiabank', 'https://www.recycla.cl/', '{"website":"https://www.scotiabankchile.cl/"}'::jsonb),
  ('loteria', 'Lotería', 'https://www.recycla.cl/', '{"website":"https://www.loteria.cl/loterianet/"}'::jsonb),
  ('servipag', 'Servipag', 'https://www.recycla.cl/', '{"website":"https://www.servipag.com/"}'::jsonb)
on conflict (slug) do update set
  display_name = excluded.display_name,
  source_url = excluded.source_url,
  metadata = excluded.metadata,
  source_observed_at = now(),
  updated_at = now();
