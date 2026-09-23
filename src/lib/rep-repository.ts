import "server-only";
import { db, hasDatabase } from "@/lib/db";
import type { PriorityStream } from "@/lib/rep";

export type PersistedObligation = {
  stream: PriorityStream;
  label: string;
  unit: "kg" | "l";
  obligation: number;
  collected: number;
  valued: number;
  eligible: number;
  evidenceComplete: number;
  accreditable: number;
};

export type PersistedClient = {
  slug: string;
  name: string;
  rut: string;
  period: string;
  obligations: PersistedObligation[];
};

export type RepDatabaseStatus =
  | { state: "not_configured"; detail: string }
  | { state: "schema_missing"; detail: string }
  | { state: "ready"; detail: string }
  | { state: "unavailable"; detail: string };

const labels: Record<PriorityStream, string> = {
  AEE_RAEE: "AEE / RAEE",
  NEUMATICOS: "Neumáticos",
  BATERIAS: "Baterías",
  PILAS: "Pilas",
  ACEITES_LUBRICANTES: "Aceites lubricantes"
};

type ClientRow = {
  slug: string;
  display_name: string;
  rut: string;
  year: number;
  stream: PriorityStream;
  unit: "kg" | "l";
  obligation: string | number;
  collected: string | number;
  valued: string | number;
  eligible: string | number;
  evidence_complete: string | number;
  accreditable: string | number;
};

function groupRows(rows: ClientRow[]): PersistedClient[] {
  const map = new Map<string, PersistedClient>();

  for (const row of rows) {
    const key = `${row.slug}:${row.year}`;
    const current = map.get(key) ?? {
      slug: row.slug,
      name: row.display_name,
      rut: row.rut,
      period: String(row.year),
      obligations: []
    };

    current.obligations.push({
      stream: row.stream,
      label: labels[row.stream],
      unit: row.unit,
      obligation: Number(row.obligation),
      collected: Number(row.collected),
      valued: Number(row.valued),
      eligible: Number(row.eligible),
      evidenceComplete: Number(row.evidence_complete),
      accreditable: Number(row.accreditable)
    });

    map.set(key, current);
  }

  return [...map.values()];
}

export async function getRepDatabaseStatus(): Promise<RepDatabaseStatus> {
  if (!hasDatabase()) {
    return {
      state: "not_configured",
      detail: "DATABASE_URL no está configurada en este entorno."
    };
  }

  try {
    const sql = db();
    const rows = await sql<Array<{
      organizations: string | null;
      obligations: string | null;
      periods: string | null;
      ledger: string | null;
    }>>`
      select
        to_regclass('public.organizations')::text as organizations,
        to_regclass('public.rep_obligations')::text as obligations,
        to_regclass('public.reporting_periods')::text as periods,
        to_regclass('public.rep_ledger_entries')::text as ledger
    `;

    const row = rows[0];
    const ready = Boolean(
      row?.organizations &&
      row?.obligations &&
      row?.periods &&
      row?.ledger
    );

    return ready
      ? { state: "ready", detail: "Base REP conectada y esquema disponible." }
      : {
          state: "schema_missing",
          detail: "La base está conectada, pero el esquema REP todavía no está aplicado."
        };
  } catch {
    return {
      state: "unavailable",
      detail: "La base está configurada, pero no respondió correctamente."
    };
  }
}

export async function listRepClients(): Promise<PersistedClient[]> {
  const status = await getRepDatabaseStatus();
  if (status.state !== "ready") return [];

  const sql = db();
  const rows = await sql<ClientRow[]>`
    select
      o.slug,
      o.display_name,
      o.rut,
      rp.year,
      ro.stream,
      ro.unit,
      ro.quantity as obligation,
      coalesce(sum(case when le.state = 'COLLECTED' then le.quantity else 0 end), 0) as collected,
      coalesce(sum(case when le.state = 'VALUED' then le.quantity else 0 end), 0) as valued,
      coalesce(sum(case when le.state = 'ELIGIBLE' then le.quantity else 0 end), 0) as eligible,
      coalesce(sum(case when le.state = 'EVIDENCE_COMPLETE' then le.quantity else 0 end), 0) as evidence_complete,
      coalesce(sum(case when le.state = 'ACCREDITABLE' then le.quantity else 0 end), 0) as accreditable
    from organizations o
    join rep_obligations ro on ro.organization_id = o.id
    join reporting_periods rp on rp.id = ro.reporting_period_id
    left join rep_ledger_entries le
      on le.organization_id = o.id
      and le.reporting_period_id = rp.id
      and le.stream = ro.stream
      and not exists (
        select 1
        from rep_ledger_entries newer
        where newer.supersedes_entry_id = le.id
      )
    group by
      o.slug, o.display_name, o.rut, rp.year,
      ro.stream, ro.unit, ro.quantity
    order by o.display_name, ro.stream
  `;

  return groupRows(rows);
}

export type ClientCircularityOutcome = {
  route: "PREPARATION_FOR_REUSE" | "RECYCLING" | "ENERGY_RECOVERY" | "DISPOSAL";
  quantityKg: number;
};

export async function getClientCircularityOutcomes(
  slug: string,
  year: number
): Promise<ClientCircularityOutcome[]> {
  const status = await getRepDatabaseStatus();
  if (status.state !== "ready") return [];

  try {
    const sql = db();
    const schema = await sql<Array<{
      allocations: string | null;
      outputs: string | null;
    }>>`
      select
        to_regclass('public.valuation_allocations')::text as allocations,
        to_regclass('public.valuation_outputs')::text as outputs
    `;

    if (!schema[0]?.allocations || !schema[0]?.outputs) return [];

    const rows = await sql<Array<{
      route: ClientCircularityOutcome["route"];
      quantity_kg: string | number;
    }>>`
      select
        vo.circularity_route as route,
        sum(va.quantity_kg) as quantity_kg
      from valuation_allocations va
      join valuation_outputs vo on vo.id = va.valuation_output_id
      join organizations o on o.id = va.organization_id
      where o.slug = ${slug}
        and vo.valued_at is not null
        and extract(year from vo.valued_at)::int = ${year}
      group by vo.circularity_route
      order by
        case vo.circularity_route
          when 'PREPARATION_FOR_REUSE' then 1
          when 'RECYCLING' then 2
          when 'ENERGY_RECOVERY' then 3
          when 'DISPOSAL' then 4
        end
    `;

    return rows.map((row) => ({
      route: row.route,
      quantityKg: Number(row.quantity_kg)
    }));
  } catch {
    return [];
  }
}

export async function getRepClient(slug: string): Promise<PersistedClient | null> {
  const clients = await listRepClients();
  return clients.find((client) => client.slug === slug) ?? null;
}
