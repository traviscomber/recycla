import "server-only";

import { db, hasDatabase } from "@/lib/db";
import type { PriorityStream } from "@/lib/rep";

export type OutcomeCalendarEvent = {
  id: string;
  kind: "planned" | "actual";
  client: string;
  clientSlug: string;
  site: string | null;
  stream: PriorityStream;
  startAt: string;
  endAt: string | null;
  status: string;
  quantity: number | null;
  unit: "kg" | "l" | null;
  counterparty: string | null;
  evidenceCount: number;
  actualRecoveryPct: number | null;
  forecastRecoveryPct: number | null;
  bestComparablePct: number | null;
  worstComparablePct: number | null;
  comparableCases: number;
  forecastConfidence: "LOW" | "MEDIUM" | "HIGH" | null;
};

type HistoricalBaseline = {
  organizationId: string;
  stream: PriorityStream;
  comparableCases: number;
  avgRecoveryPct: number | null;
  bestRecoveryPct: number | null;
  worstRecoveryPct: number | null;
};

function clampPct(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function confidenceForCases(cases: number): OutcomeCalendarEvent["forecastConfidence"] {
  if (cases < 3) return null;
  if (cases >= 12) return "HIGH";
  if (cases >= 6) return "MEDIUM";
  return "LOW";
}

export async function listOutcomeCalendarEvents(input: {
  start: Date;
  end: Date;
}): Promise<OutcomeCalendarEvent[]> {
  if (!hasDatabase()) return [];

  const sql = db();
  const startIso = input.start.toISOString();
  const endIso = input.end.toISOString();

  try {
    const schema = await sql<Array<{
      plans: string | null;
      allocations: string | null;
      outputs: string | null;
      evidenceLinks: string | null;
    }>>`
      select
        to_regclass('public.collection_plans')::text as plans,
        to_regclass('public.valuation_allocations')::text as allocations,
        to_regclass('public.valuation_outputs')::text as outputs,
        to_regclass('public.evidence_links')::text as "evidenceLinks"
    `;

    const hasOutcomeTables = Boolean(schema[0]?.allocations && schema[0]?.outputs);
    const hasEvidenceLinks = Boolean(schema[0]?.evidenceLinks);

    const actualRows = hasOutcomeTables
      ? await sql<Array<{
          id: string;
          organizationId: string;
          client: string;
          clientSlug: string;
          site: string | null;
          stream: PriorityStream;
          startAt: string;
          quantity: string | number | null;
          unit: "kg" | "l" | null;
          totalAllocatedKg: string | number;
          recoveredKg: string | number;
        }>>`
          select
            c.id::text as id,
            c.organization_id::text as "organizationId",
            o.display_name as client,
            o.slug as "clientSlug",
            s.name as site,
            c.stream,
            c.collected_at::text as "startAt",
            c.declared_quantity as quantity,
            c.declared_unit as unit,
            coalesce(sum(va.quantity_kg), 0)::float8 as "totalAllocatedKg",
            coalesce(sum(
              case when vo.circularity_route in ('PREPARATION_FOR_REUSE', 'RECYCLING')
                then va.quantity_kg else 0 end
            ), 0)::float8 as "recoveredKg"
          from collections c
          join organizations o on o.id = c.organization_id
          left join sites s on s.id = c.site_id
          left join valuation_allocations va on va.collection_id = c.id
          left join valuation_outputs vo on vo.id = va.valuation_output_id
          where c.collected_at >= ${startIso}::timestamptz
            and c.collected_at < ${endIso}::timestamptz
          group by c.id, o.display_name, o.slug, s.name
          order by c.collected_at asc
        `
      : await sql<Array<{
          id: string;
          organizationId: string;
          client: string;
          clientSlug: string;
          site: string | null;
          stream: PriorityStream;
          startAt: string;
          quantity: string | number | null;
          unit: "kg" | "l" | null;
          totalAllocatedKg: number;
          recoveredKg: number;
        }>>`
          select
            c.id::text as id,
            c.organization_id::text as "organizationId",
            o.display_name as client,
            o.slug as "clientSlug",
            s.name as site,
            c.stream,
            c.collected_at::text as "startAt",
            c.declared_quantity as quantity,
            c.declared_unit as unit,
            0::float8 as "totalAllocatedKg",
            0::float8 as "recoveredKg"
          from collections c
          join organizations o on o.id = c.organization_id
          left join sites s on s.id = c.site_id
          where c.collected_at >= ${startIso}::timestamptz
            and c.collected_at < ${endIso}::timestamptz
          order by c.collected_at asc
        `;

    const evidenceByCollection = new Map<string, number>();
    if (hasEvidenceLinks && actualRows.length) {
      const ids = actualRows.map((row) => row.id);
      const evidenceRows = await sql<Array<{ collectionId: string; evidenceCount: number }>>`
        select
          el.entity_id::text as "collectionId",
          count(distinct el.document_id)::int as "evidenceCount"
        from evidence_links el
        where el.entity_type = 'collection'
          and el.entity_id = any(${ids}::uuid[])
        group by el.entity_id
      `;
      for (const row of evidenceRows) evidenceByCollection.set(row.collectionId, row.evidenceCount);
    }

    let baselines: HistoricalBaseline[] = [];
    if (hasOutcomeTables) {
      baselines = await sql<HistoricalBaseline[]>`
        with outcomes as (
          select
            c.id,
            c.organization_id,
            c.stream,
            sum(va.quantity_kg)::float8 as total_kg,
            sum(
              case when vo.circularity_route in ('PREPARATION_FOR_REUSE', 'RECYCLING')
                then va.quantity_kg else 0 end
            )::float8 as recovered_kg
          from collections c
          join valuation_allocations va on va.collection_id = c.id
          join valuation_outputs vo on vo.id = va.valuation_output_id
          group by c.id, c.organization_id, c.stream
          having sum(va.quantity_kg) > 0
        )
        select
          organization_id::text as "organizationId",
          stream,
          count(*)::int as "comparableCases",
          avg((recovered_kg / nullif(total_kg, 0)) * 100)::float8 as "avgRecoveryPct",
          max((recovered_kg / nullif(total_kg, 0)) * 100)::float8 as "bestRecoveryPct",
          min((recovered_kg / nullif(total_kg, 0)) * 100)::float8 as "worstRecoveryPct"
        from outcomes
        group by organization_id, stream
      `;
    }

    const baselineMap = new Map(
      baselines.map((row) => [`${row.organizationId}:${row.stream}`, row])
    );

    const events: OutcomeCalendarEvent[] = actualRows.map((row) => {
      const total = Number(row.totalAllocatedKg);
      const recovered = Number(row.recoveredKg);
      const actualRecoveryPct = total > 0 ? clampPct((recovered / total) * 100) : null;
      return {
        id: row.id,
        kind: "actual",
        client: row.client,
        clientSlug: row.clientSlug,
        site: row.site,
        stream: row.stream,
        startAt: row.startAt,
        endAt: null,
        status: "COMPLETED",
        quantity: row.quantity === null ? null : Number(row.quantity),
        unit: row.unit,
        counterparty: null,
        evidenceCount: evidenceByCollection.get(row.id) ?? 0,
        actualRecoveryPct,
        forecastRecoveryPct: null,
        bestComparablePct: null,
        worstComparablePct: null,
        comparableCases: 0,
        forecastConfidence: null
      };
    });

    if (schema[0]?.plans) {
      const plannedRows = await sql<Array<{
        id: string;
        organizationId: string;
        client: string;
        clientSlug: string;
        site: string | null;
        stream: PriorityStream;
        startAt: string;
        endAt: string | null;
        status: string;
        quantity: string | number | null;
        unit: "kg" | "l" | null;
        counterparty: string | null;
      }>>`
        select
          cp.id::text as id,
          cp.organization_id::text as "organizationId",
          o.display_name as client,
          o.slug as "clientSlug",
          s.name as site,
          cp.stream,
          cp.planned_start::text as "startAt",
          cp.planned_end::text as "endAt",
          cp.status::text as status,
          cp.estimated_quantity as quantity,
          cp.estimated_unit as unit,
          cp.counterparty_name as counterparty
        from collection_plans cp
        join organizations o on o.id = cp.organization_id
        left join sites s on s.id = cp.site_id
        where cp.status <> 'CANCELLED'
          and cp.planned_start < ${endIso}::timestamptz
          and coalesce(cp.planned_end, cp.planned_start) >= ${startIso}::timestamptz
        order by cp.planned_start asc
      `;

      for (const row of plannedRows) {
        const baseline = baselineMap.get(`${row.organizationId}:${row.stream}`);
        const comparableCases = baseline?.comparableCases ?? 0;
        const forecastRecoveryPct =
          comparableCases >= 3 ? clampPct(baseline?.avgRecoveryPct ?? null) : null;

        events.push({
          id: row.id,
          kind: "planned",
          client: row.client,
          clientSlug: row.clientSlug,
          site: row.site,
          stream: row.stream,
          startAt: row.startAt,
          endAt: row.endAt,
          status: row.status,
          quantity: row.quantity === null ? null : Number(row.quantity),
          unit: row.unit,
          counterparty: row.counterparty,
          evidenceCount: 0,
          actualRecoveryPct: null,
          forecastRecoveryPct,
          bestComparablePct:
            comparableCases >= 3 ? clampPct(baseline?.bestRecoveryPct ?? null) : null,
          worstComparablePct:
            comparableCases >= 3 ? clampPct(baseline?.worstRecoveryPct ?? null) : null,
          comparableCases,
          forecastConfidence: confidenceForCases(comparableCases)
        });
      }
    }

    return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  } catch {
    return [];
  }
}
