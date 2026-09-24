import "server-only";

import { createHash } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";

export type MonthlyRepReport = {
  id: string;
  subjectRef: string;
  reportingMonth: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  status: "DRAFT" | "READY" | "SUBMITTED" | "REOPENED";
  introducedMarket: Record<string, unknown>;
  wasteOperations: Record<string, unknown>;
  evidenceSummary: Record<string, unknown>;
  checksumSha256: string | null;
  version: number;
  generatedAt: string;
  finalizedAt: string | null;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function latestReportableMonth(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  monthStart.setUTCMonth(monthStart.getUTCMonth() - 2);
  return isoDate(monthStart);
}

function monthBounds(reportingMonth: string) {
  const start = new Date(reportingMonth + "T00:00:00.000Z");
  if (Number.isNaN(start.getTime()) || start.getUTCDate() !== 1) {
    throw new Error("reportingMonth debe ser el primer día del mes en formato YYYY-MM-01.");
  }
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = new Date(next.getTime() - 86400000);
  return { start: isoDate(start), end: isoDate(end) };
}

function checksum(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function generateMonthlyRepDraft(
  subjectRef: string,
  reportingMonth = latestReportableMonth()
): Promise<{ ok: boolean; report?: MonthlyRepReport; detail: string }> {
  if (!hasDatabase()) {
    return { ok: false, detail: "DATABASE_URL no está configurada." };
  }

  const sql = db();
  const { start, end } = monthBounds(reportingMonth);

  try {
    const tables = await sql<Array<{
      market: string | null;
      waste: string | null;
      monthly: string | null;
      snapshots: string | null;
    }>>`
      select
        to_regclass('public.market_introductions')::text as market,
        to_regclass('public.waste_management_operations')::text as waste,
        to_regclass('public.monthly_rep_reports')::text as monthly,
        to_regclass('public.external_source_snapshots')::text as snapshots
    `;

    if (!tables[0]?.market || !tables[0]?.waste || !tables[0]?.monthly) {
      return {
        ok: false,
        detail: "El esquema mensual REP todavía no está completo."
      };
    }

    const marketRows = await sql<Array<{
      priorityProduct: string;
      category: string | null;
      subcategory: string | null;
      transactions: number;
      units: number | null;
      quantity: number | null;
    }>>`
      select
        priority_product as "priorityProduct",
        category,
        subcategory,
        count(*)::int as transactions,
        sum(units)::float8 as units,
        sum(quantity)::float8 as quantity
      from market_introductions
      where subject_ref = ${subjectRef}
        and occurred_at >= ${start}
        and occurred_at <= ${end}
      group by priority_product, category, subcategory
      order by priority_product, category, subcategory
    `;

    const wasteRows = await sql<Array<{
      priorityProduct: string;
      category: string | null;
      subcategory: string | null;
      operationType: string;
      operations: number;
      quantity: number;
      costClp: number | null;
      withTaxDocument: number;
    }>>`
      select
        priority_product as "priorityProduct",
        category,
        subcategory,
        operation_type as "operationType",
        count(*)::int as operations,
        sum(quantity)::float8 as quantity,
        sum(cost_clp)::float8 as "costClp",
        count(*) filter (
          where tax_document_ref is not null
            and length(trim(tax_document_ref)) > 0
        )::int as "withTaxDocument"
      from waste_management_operations
      where subject_ref = ${subjectRef}
        and occurred_at >= ${start}
        and occurred_at <= ${end}
      group by priority_product, category, subcategory, operation_type
      order by priority_product, category, subcategory, operation_type
    `;

    const snapshotRows = tables[0]?.snapshots
      ? await sql<Array<{ status: string; count: number }>>`
          select status, count(*)::int as count
          from external_source_snapshots
          where fetched_at::date <= ${end}
          group by status
          order by status
        `
      : [];

    const introducedMarket = {
      period: { start, end },
      groups: marketRows,
      transactionCount: marketRows.reduce((sum, row) => sum + row.transactions, 0)
    };

    const wasteOperations = {
      period: { start, end },
      groups: wasteRows,
      operationCount: wasteRows.reduce((sum, row) => sum + row.operations, 0),
      quantityTotal: wasteRows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
    };

    const evidenceSummary = {
      officialSnapshots: snapshotRows,
      generatedFrom: [
        "market_introductions",
        "waste_management_operations",
        "external_source_snapshots"
      ]
    };

    const payloadChecksum = checksum({
      subjectRef,
      reportingMonth,
      introducedMarket,
      wasteOperations,
      evidenceSummary
    });

    const existing = await sql<MonthlyRepReport[]>`
      select
        id,
        subject_ref as "subjectRef",
        reporting_month::text as "reportingMonth",
        source_period_start::text as "sourcePeriodStart",
        source_period_end::text as "sourcePeriodEnd",
        status,
        introduced_market as "introducedMarket",
        waste_operations as "wasteOperations",
        evidence_summary as "evidenceSummary",
        checksum_sha256 as "checksumSha256",
        version,
        generated_at::text as "generatedAt",
        finalized_at::text as "finalizedAt"
      from monthly_rep_reports
      where subject_ref = ${subjectRef}
        and reporting_month = ${reportingMonth}
        and checksum_sha256 = ${payloadChecksum}
      order by version desc
      limit 1
    `;

    if (existing[0]) {
      return {
        ok: true,
        report: existing[0],
        detail: "El cierre mensual idéntico ya estaba persistido."
      };
    }

    const [versionRow] = await sql<Array<{ nextVersion: number }>>`
      select coalesce(max(version), 0)::int + 1 as "nextVersion"
      from monthly_rep_reports
      where subject_ref = ${subjectRef}
        and reporting_month = ${reportingMonth}
    `;

    const rows = await sql<MonthlyRepReport[]>`
      insert into monthly_rep_reports (
        subject_ref,
        reporting_month,
        source_period_start,
        source_period_end,
        status,
        introduced_market,
        waste_operations,
        evidence_summary,
        checksum_sha256,
        version
      ) values (
        ${subjectRef},
        ${reportingMonth},
        ${start},
        ${end},
        'DRAFT',
        ${sql.json(introducedMarket)},
        ${sql.json(wasteOperations)},
        ${sql.json(evidenceSummary)},
        ${payloadChecksum},
        ${versionRow?.nextVersion ?? 1}
      )
      returning
        id,
        subject_ref as "subjectRef",
        reporting_month::text as "reportingMonth",
        source_period_start::text as "sourcePeriodStart",
        source_period_end::text as "sourcePeriodEnd",
        status,
        introduced_market as "introducedMarket",
        waste_operations as "wasteOperations",
        evidence_summary as "evidenceSummary",
        checksum_sha256 as "checksumSha256",
        version,
        generated_at::text as "generatedAt",
        finalized_at::text as "finalizedAt"
    `;

    return {
      ok: true,
      report: rows[0],
      detail:
        marketRows.length || wasteRows.length
          ? "Borrador mensual generado desde datos normalizados."
          : "Borrador mensual generado sin operaciones reportables; permanece DRAFT."
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

export async function getLatestMonthlyRepReport(
  subjectRef = "recycla-os"
): Promise<MonthlyRepReport | null> {
  if (!hasDatabase()) return null;
  try {
    const sql = db();
    const table = await sql<Array<{ monthly: string | null }>>`
      select to_regclass('public.monthly_rep_reports')::text as monthly
    `;
    if (!table[0]?.monthly) return null;

    const rows = await sql<MonthlyRepReport[]>`
      select
        id,
        subject_ref as "subjectRef",
        reporting_month::text as "reportingMonth",
        source_period_start::text as "sourcePeriodStart",
        source_period_end::text as "sourcePeriodEnd",
        status,
        introduced_market as "introducedMarket",
        waste_operations as "wasteOperations",
        evidence_summary as "evidenceSummary",
        checksum_sha256 as "checksumSha256",
        version,
        generated_at::text as "generatedAt",
        finalized_at::text as "finalizedAt"
      from monthly_rep_reports
      where subject_ref = ${subjectRef}
      order by reporting_month desc, version desc
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}


export async function getMonthlyRepReport(
  subjectRef: string,
  reportingMonth: string
): Promise<MonthlyRepReport | null> {
  if (!hasDatabase()) return null;
  try {
    const sql = db();
    const table = await sql<Array<{ monthly: string | null }>>`
      select to_regclass('public.monthly_rep_reports')::text as monthly
    `;
    if (!table[0]?.monthly) return null;

    const rows = await sql<MonthlyRepReport[]>`
      select
        id,
        subject_ref as "subjectRef",
        reporting_month::text as "reportingMonth",
        source_period_start::text as "sourcePeriodStart",
        source_period_end::text as "sourcePeriodEnd",
        status,
        introduced_market as "introducedMarket",
        waste_operations as "wasteOperations",
        evidence_summary as "evidenceSummary",
        checksum_sha256 as "checksumSha256",
        version,
        generated_at::text as "generatedAt",
        finalized_at::text as "finalizedAt"
      from monthly_rep_reports
      where subject_ref = ${subjectRef}
        and reporting_month = ${reportingMonth}
      order by version desc
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
