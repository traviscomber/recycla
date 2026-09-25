import { db, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const expectedHeader = "rep-classification-20260925";

async function inspect(sql: ReturnType<typeof db>) {
  const rows = await sql<Array<{
    marketColumns: number;
    wasteColumns: number;
    collectionColumns: number;
    eventsTable: string | null;
  }>>`
    select
      (
        select count(*)::int
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'market_introductions'
          and column_name in (
            'regulatory_stream',
            'regulatory_category_id',
            'regulatory_pack_version',
            'classification_status',
            'classification_basis'
          )
      ) as "marketColumns",
      (
        select count(*)::int
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'waste_management_operations'
          and column_name in (
            'regulatory_stream',
            'regulatory_category_id',
            'regulatory_pack_version',
            'classification_status',
            'classification_basis'
          )
      ) as "wasteColumns",
      (
        select count(*)::int
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'collections'
          and column_name in (
            'regulatory_category_id',
            'regulatory_pack_version',
            'classification_status',
            'classification_basis'
          )
      ) as "collectionColumns",
      to_regclass('public.rep_classification_events')::text as "eventsTable"
  `;
  return rows[0];
}

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== "production") {
    return new Response("Not found", { status: 404 });
  }

  if (request.headers.get("x-migration-confirm") !== expectedHeader) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!hasDatabase()) {
    return Response.json({ ok: false, error: "DATABASE_URL_NOT_CONFIGURED" }, { status: 503 });
  }

  const sql = db();
  const before = await inspect(sql);
  const alreadyApplied =
    before.marketColumns === 5 &&
    before.wasteColumns === 5 &&
    before.collectionColumns === 4 &&
    Boolean(before.eventsTable);

  if (alreadyApplied) {
    return Response.json({ ok: true, state: "already_applied", ...before });
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(`
      alter table market_introductions
        add column if not exists regulatory_stream priority_stream,
        add column if not exists regulatory_category_id text,
        add column if not exists regulatory_pack_version text,
        add column if not exists classification_status text
          check (classification_status in ('VERIFIED','REVIEW_REQUIRED')),
        add column if not exists classification_basis text
    `);

    await tx.unsafe(`
      alter table waste_management_operations
        add column if not exists regulatory_stream priority_stream,
        add column if not exists regulatory_category_id text,
        add column if not exists regulatory_pack_version text,
        add column if not exists classification_status text
          check (classification_status in ('VERIFIED','REVIEW_REQUIRED')),
        add column if not exists classification_basis text
    `);

    await tx.unsafe(`
      alter table collections
        add column if not exists regulatory_category_id text,
        add column if not exists regulatory_pack_version text,
        add column if not exists classification_status text
          check (classification_status in ('VERIFIED','REVIEW_REQUIRED')),
        add column if not exists classification_basis text
    `);

    await tx.unsafe(`
      create index if not exists market_introductions_regulatory_idx
        on market_introductions(regulatory_stream, regulatory_category_id, classification_status, occurred_at desc)
    `);

    await tx.unsafe(`
      create index if not exists waste_management_operations_regulatory_idx
        on waste_management_operations(regulatory_stream, regulatory_category_id, classification_status, occurred_at desc)
    `);

    await tx.unsafe(`
      create index if not exists collections_regulatory_idx
        on collections(stream, regulatory_category_id, classification_status, collected_at desc)
    `);

    await tx.unsafe(`
      create table if not exists rep_classification_events (
        id uuid primary key default gen_random_uuid(),
        entity_type text not null
          check (entity_type in ('MARKET_INTRODUCTION','WASTE_OPERATION','COLLECTION')),
        entity_id uuid not null,
        stream priority_stream not null,
        pack_version text not null,
        category_id text,
        status text not null
          check (status in ('VERIFIED','REVIEW_REQUIRED')),
        source_method text not null
          check (source_method in ('INGESTION','MANUAL_REVIEW','MIGRATION')),
        actor_ref text,
        note text,
        created_at timestamptz not null default now()
      )
    `);

    await tx.unsafe(`
      create index if not exists rep_classification_events_entity_idx
        on rep_classification_events(entity_type, entity_id, created_at desc)
    `);
  });

  const after = await inspect(sql);
  const ok =
    after.marketColumns === 5 &&
    after.wasteColumns === 5 &&
    after.collectionColumns === 4 &&
    Boolean(after.eventsTable);

  return Response.json({ ok, state: ok ? "applied" : "incomplete", ...after }, { status: ok ? 200 : 500 });
}
