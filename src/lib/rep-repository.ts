import "server-only";
import { db, hasDatabase } from "@/lib/db";
import { inspectSchemaContract } from "@/lib/schema-contract";
import type { PriorityStream } from "@/lib/rep";
import { repRulePacks } from "@/lib/rep-rule-packs";

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
  regulatoryMode: "APPLY" | "MONITOR_ONLY";
  regulatoryVersion: string;
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
      accreditable: Number(row.accreditable),
      regulatoryMode: repRulePacks[row.stream].enginePolicy,
      regulatoryVersion: repRulePacks[row.stream].version
    });

    map.set(key, current);
  }

  return [...map.values()];
}

export async function getRepDatabaseStatus(): Promise<RepDatabaseStatus> {
  const health = await inspectSchemaContract();

  if (health.state === "ready") {
    return {
      state: "ready",
      detail: "Base REP conectada y contrato de esquema completo."
    };
  }

  if (health.state === "schema_missing") {
    const missingColumnCount = health.missingColumns.reduce(
      (sum, item) => sum + item.columns.length,
      0
    );
    return {
      state: "schema_missing",
      detail: `Contrato de esquema incompleto: ${health.missingTables.length} tablas y ${missingColumnCount} columnas requeridas faltantes.`
    };
  }

  if (health.state === "not_configured") {
    return {
      state: "not_configured",
      detail: health.detail
    };
  }

  return {
    state: "unavailable",
    detail: health.detail
  };
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

export async function getRepClient(
  slug: string,
  year?: number
): Promise<PersistedClient | null> {
  const clients = await listRepClients();
  const candidates = clients
    .filter((client) => client.slug === slug)
    .sort((a, b) => Number(b.period) - Number(a.period));

  if (year) {
    return candidates.find((client) => Number(client.period) === year) ?? null;
  }

  return candidates[0] ?? null;
}


export type PersistedLedgerEntry = {
  id: string;
  createdAt: string;
  client: string;
  period: string;
  stream: PriorityStream;
  state: string;
  quantity: number;
  unit: "kg" | "l";
  sourceEntityType: string;
  sourceEntityId: string;
  ruleCode: string | null;
  ruleVersion: number | null;
  ruleCategoryId: string | null;
  evidenceCount: number;
};

export async function listRepLedgerEntries(limit = 50): Promise<PersistedLedgerEntry[]> {
  const status = await getRepDatabaseStatus();
  if (status.state !== "ready") return [];

  try {
    const sql = db();
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const schema = await sql<Array<{ evidence_links: string | null }>>`
      select to_regclass('public.evidence_links')::text as evidence_links
    `;
    const hasEvidenceLinks = Boolean(schema[0]?.evidence_links);

    if (hasEvidenceLinks) {
      return await sql<PersistedLedgerEntry[]>`
        select
          le.id::text as id,
          le.created_at::text as "createdAt",
          o.display_name as client,
          rp.year::text as period,
          le.stream,
          le.state::text as state,
          le.quantity::float8 as quantity,
          le.unit,
          le.source_entity_type as "sourceEntityType",
          le.source_entity_id::text as "sourceEntityId",
          rr.code as "ruleCode",
          rr.rule_version as "ruleVersion",
          coalesce(rr.rule_json->>'categoryId', rr.rule_json->>'category') as "ruleCategoryId",
          count(distinct el.document_id)::int as "evidenceCount"
        from rep_ledger_entries le
        join organizations o on o.id = le.organization_id
        join reporting_periods rp on rp.id = le.reporting_period_id
        left join rep_rules rr on rr.id = le.rule_id
        left join evidence_links el
          on el.entity_type = le.source_entity_type
          and el.entity_id = le.source_entity_id
        where not exists (
          select 1 from rep_ledger_entries newer
          where newer.supersedes_entry_id = le.id
        )
        group by le.id, o.display_name, rp.year, rr.code, rr.rule_version, rr.rule_json
        order by le.created_at desc
        limit ${safeLimit}
      `;
    }

    return await sql<PersistedLedgerEntry[]>`
      select
        le.id::text as id,
        le.created_at::text as "createdAt",
        o.display_name as client,
        rp.year::text as period,
        le.stream,
        le.state::text as state,
        le.quantity::float8 as quantity,
        le.unit,
        le.source_entity_type as "sourceEntityType",
        le.source_entity_id::text as "sourceEntityId",
        rr.code as "ruleCode",
        rr.rule_version as "ruleVersion",
        coalesce(rr.rule_json->>'categoryId', rr.rule_json->>'category') as "ruleCategoryId",
        0::int as "evidenceCount"
      from rep_ledger_entries le
      join organizations o on o.id = le.organization_id
      join reporting_periods rp on rp.id = le.reporting_period_id
      left join rep_rules rr on rr.id = le.rule_id
      where not exists (
        select 1 from rep_ledger_entries newer
        where newer.supersedes_entry_id = le.id
      )
      order by le.created_at desc
      limit ${safeLimit}
    `;
  } catch {
    return [];
  }
}

export type PersistedEvidenceDocument = {
  id: string;
  client: string | null;
  documentType: string;
  fileName: string;
  checksumSha256: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  linkedEntities: number;
};

export async function listEvidenceDocuments(limit = 50): Promise<PersistedEvidenceDocument[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const schema = await sql<Array<{
      documents: string | null;
      evidence_links: string | null;
    }>>`
      select
        to_regclass('public.documents')::text as documents,
        to_regclass('public.evidence_links')::text as evidence_links
    `;
    if (!schema[0]?.documents) return [];

    if (schema[0]?.evidence_links) {
      return await sql<PersistedEvidenceDocument[]>`
        select
          d.id::text as id,
          o.display_name as client,
          d.document_type as "documentType",
          d.file_name as "fileName",
          d.checksum_sha256 as "checksumSha256",
          d.issued_at::text as "issuedAt",
          d.expires_at::text as "expiresAt",
          d.created_at::text as "createdAt",
          count(distinct el.id)::int as "linkedEntities"
        from documents d
        left join organizations o on o.id = d.organization_id
        left join evidence_links el on el.document_id = d.id
        group by d.id, o.display_name
        order by d.created_at desc
        limit ${safeLimit}
      `;
    }

    return await sql<PersistedEvidenceDocument[]>`
      select
        d.id::text as id,
        o.display_name as client,
        d.document_type as "documentType",
        d.file_name as "fileName",
        d.checksum_sha256 as "checksumSha256",
        d.issued_at::text as "issuedAt",
        d.expires_at::text as "expiresAt",
        d.created_at::text as "createdAt",
        0::int as "linkedEntities"
      from documents d
      left join organizations o on o.id = d.organization_id
      order by d.created_at desc
      limit ${safeLimit}
    `;
  } catch {
    return [];
  }
}
