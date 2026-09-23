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

export async function listRepClients(): Promise<PersistedClient[]> {
  if (!hasDatabase()) return [];
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
    group by
      o.slug, o.display_name, o.rut, rp.year,
      ro.stream, ro.unit, ro.quantity
    order by o.display_name, ro.stream
  `;
  return groupRows(rows);
}

export async function getRepClient(slug: string): Promise<PersistedClient | null> {
  const clients = await listRepClients();
  return clients.find((client) => client.slug === slug) ?? null;
}
