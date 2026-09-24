import "server-only";

import { db, hasDatabase } from "@/lib/db";

const publishedClients = [
  ["transbank", "Transbank", "https://www.transbank.cl/"],
  ["selecta-envases", "Selecta Envases", "http://selectaenvases.cl/"],
  ["peoplenet", "Peoplenet", "http://www.peoplenet.cl/"],
  ["bosch", "Bosch", "https://www.bosch-home.cl/"],
  ["bci-seguros", "BCI Seguros", "https://www.bciseguros.cl/"],
  ["ibm", "IBM", "https://www.ibm.com/cl-es/"],
  ["gasco", "Gasco", "https://www.gasco.cl/"],
  ["maigas", "Maigas", "https://maigas.cl/"],
  ["colbun", "Colbún", "https://www.colbun.cl/"],
  ["scotiabank", "Scotiabank", "https://www.scotiabankchile.cl/"],
  ["loteria", "Lotería", "https://www.loteria.cl/loterianet/"],
  ["servipag", "Servipag", "https://www.servipag.com/"]
] as const;

export async function bootstrapClientDirectory() {
  if (!hasDatabase()) {
    return { ok: false, detail: "DATABASE_URL no configurada.", rows: 0 };
  }

  const sql = db();

  await sql\`
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
    )
  \`;

  await sql\`
    create index if not exists client_directory_name_idx
      on client_directory (lower(display_name))
  \`;

  for (const [slug, displayName, website] of publishedClients) {
    await sql\`
      insert into client_directory (
        slug, display_name, relationship_status, source_kind, source_url, metadata
      ) values (
        ${slug}, ${displayName}, 'PUBLISHED_CLIENT', 'OFFICIAL_WEBSITE',
        'https://www.recycla.cl/', ${sql.json({ website })}
      )
      on conflict (slug) do update set
        display_name = excluded.display_name,
        relationship_status = excluded.relationship_status,
        source_kind = excluded.source_kind,
        source_url = excluded.source_url,
        metadata = excluded.metadata,
        source_observed_at = now(),
        updated_at = now()
    \`;
  }

  const [summary] = await sql<Array<{ rows: number }>>\`
    select count(*)::int as rows from client_directory
  \`;

  return {
    ok: true,
    detail: "Directorio oficial de clientes inicializado.",
    rows: summary?.rows ?? 0
  };
}
