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
    const schema = await sql<Array<{ documents: string | null }>>`
      select to_regclass('public.documents')::text as documents
    `;

    if (schema[0]?.documents) {
      const docs = await sql<Array<{
        id: string;
        client: string;
        clientSlug: string;
        expiresAt: string;
        documentType: string;
        fileName: string;
      }>>`
        select
          d.id::text as id,
          o.display_name as client,
          o.slug as "clientSlug",
          d.expires_at::text as "expiresAt",
          d.document_type as "documentType",
          d.file_name as "fileName"
        from documents d
        join organizations o on o.id = d.organization_id
        where d.expires_at is not null
          and d.expires_at >= ${startKey}::date
          and d.expires_at < ${endKey}::date
        order by d.expires_at asc
        limit 200
      `;

      for (const row of docs) {
        events.push({
          id: row.id,
          kind: "document",
          client: row.client,
          clientSlug: row.clientSlug,
          site: null,
          stream: null,
          startAt: `${row.expiresAt}T12:00:00Z`,
          endAt: null,
          status: "EXPIRING",
          quantity: null,
          unit: null,
          counterparty: null,
          evidenceCount: 0,
          actualRecoveryPct: null,
          forecastRecoveryPct: null,
          bestComparablePct: null,
          worstComparablePct: null,
          comparableCases: 0,
          forecastConfidence: null,
          title: `Vence ${row.documentType}`,
          detail: row.fileName,
          severity: "attention"
        });
      }
    }

    return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  } catch {
    return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
}
