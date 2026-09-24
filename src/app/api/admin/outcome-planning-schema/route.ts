import { db, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPLY_KEY = "outcome-planning-90576719881513a9";

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (process.env.VERCEL_ENV !== "production" || url.searchParams.get("key") !== APPLY_KEY) {
    return new Response("Not found", { status: 404 });
  }

  if (!hasDatabase()) {
    return Response.json({ ok: false, error: "DATABASE_URL_NOT_CONFIGURED" }, { status: 503 });
  }

  const sql = db();

  const before = await sql<Array<{ plans: string | null }>>`
    select to_regclass('public.collection_plans')::text as plans
  `;

  if (before[0]?.plans) {
    return Response.json({
      ok: true,
      state: "already_applied",
      table: before[0].plans
    });
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(`
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
    `);

    await tx.unsafe(`
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
      )
    `);

    await tx.unsafe(`
      create index if not exists collection_plans_schedule_idx
        on collection_plans(planned_start, planned_end)
    `);

    await tx.unsafe(`
      create index if not exists collection_plans_org_stream_idx
        on collection_plans(organization_id, stream, planned_start)
    `);

    await tx.unsafe(`
      create unique index if not exists collection_plans_source_collection_uidx
        on collection_plans(source_collection_id)
        where source_collection_id is not null
    `);
  });

  const after = await sql<Array<{ plans: string | null; statusType: string | null }>>`
    select
      to_regclass('public.collection_plans')::text as plans,
      to_regtype('public.collection_plan_status')::text as "statusType"
  `;

  return Response.json({
    ok: Boolean(after[0]?.plans && after[0]?.statusType),
    state: "applied",
    table: after[0]?.plans ?? null,
    statusType: after[0]?.statusType ?? null
  });
}
