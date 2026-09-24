import "server-only";

import { db, hasDatabase } from "@/lib/db";

export type GestorMatchStatus =
  | "VERIFIED_REFERENCE"
  | "REVIEW_NAME_MATCH"
  | "NOT_FOUND"
  | "MISSING_IDENTITY";

export type GestorIntelligenceRow = {
  counterpartyRef: string | null;
  counterpartyName: string | null;
  operationCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  products: string[];
  status: GestorMatchStatus;
  sourceId: string | null;
  sourceYear: number | null;
  officialIdentifier: string | null;
  officialName: string | null;
  matchBasis: "REFERENCE" | "NAME" | null;
};

function normalizeRef(value: string | null) {
  return value?.replace(/[^0-9kK]/g, "").toLocaleLowerCase("es-CL") ?? "";
}

function normalizeName(value: string | null) {
  return value?.trim().toLocaleLowerCase("es-CL") ?? "";
}

export async function listGestorIntelligence(
  subjectRef = "recycla-os",
  limit = 100
): Promise<GestorIntelligenceRow[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const tables = await sql<Array<{ waste: string | null; official: string | null }>>`
      select
        to_regclass('public.waste_management_operations')::text as waste,
        to_regclass('public.external_source_records')::text as official
    `;

    if (!tables[0]?.waste || !tables[0]?.official) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const operations = await sql<Array<{
      counterpartyRef: string | null;
      counterpartyName: string | null;
      operationCount: number;
      firstSeenAt: string;
      lastSeenAt: string;
      products: string[];
    }>>`
      select
        nullif(trim(counterparty_ref), '') as "counterpartyRef",
        nullif(trim(counterparty_name), '') as "counterpartyName",
        count(*)::int as "operationCount",
        min(occurred_at)::text as "firstSeenAt",
        max(occurred_at)::text as "lastSeenAt",
        array_agg(distinct priority_product order by priority_product) as products
      from waste_management_operations
      where subject_ref = ${subjectRef}
      group by
        nullif(trim(counterparty_ref), ''),
        nullif(trim(counterparty_name), '')
      order by max(occurred_at) desc, count(*) desc
      limit ${safeLimit}
    `;

    if (!operations.length) return [];

    const official = await sql<Array<{
      sourceId: string;
      sourceYear: number | null;
      externalIdentifier: string | null;
      canonicalName: string | null;
    }>>`
      select distinct on (
        source_id,
        coalesce(external_identifier, ''),
        coalesce(canonical_name, '')
      )
        source_id as "sourceId",
        source_year as "sourceYear",
        external_identifier as "externalIdentifier",
        canonical_name as "canonicalName"
      from external_source_records
      where source_id in ('retc-hazardous-destinations', 'retc-storage-sites')
      order by
        source_id,
        coalesce(external_identifier, ''),
        coalesce(canonical_name, ''),
        source_year desc nulls last,
        ingested_at desc
    `;

    return operations.map((operation) => {
      const ref = normalizeRef(operation.counterpartyRef);
      const name = normalizeName(operation.counterpartyName);

      const refMatch = ref
        ? official.find((record) => normalizeRef(record.externalIdentifier) === ref)
        : undefined;

      const nameMatch = !refMatch && name
        ? official.find((record) => normalizeName(record.canonicalName) === name)
        : undefined;

      const match = refMatch ?? nameMatch;

      const status: GestorMatchStatus =
        !operation.counterpartyRef && !operation.counterpartyName
          ? "MISSING_IDENTITY"
          : refMatch
            ? "VERIFIED_REFERENCE"
            : nameMatch
              ? "REVIEW_NAME_MATCH"
              : "NOT_FOUND";

      return {
        ...operation,
        status,
        sourceId: match?.sourceId ?? null,
        sourceYear: match?.sourceYear ?? null,
        officialIdentifier: match?.externalIdentifier ?? null,
        officialName: match?.canonicalName ?? null,
        matchBasis: refMatch ? "REFERENCE" : nameMatch ? "NAME" : null
      };
    });
  } catch {
    return [];
  }
}
