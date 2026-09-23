import "server-only";

import { createHash } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";
import { latestReportableMonth } from "@/lib/monthly-reporting";

export type ReconciliationIssue = {
  code:
    | "MARKET_ROW_MISSING_REFERENCE"
    | "WASTE_ROW_MISSING_COUNTERPARTY"
    | "WASTE_ROW_MISSING_TAX_DOCUMENT"
    | "WASTE_ROW_MISSING_SOURCE_DOCUMENT"
    | "UNIT_MISSING"
    | "NO_MARKET_DATA"
    | "NO_WASTE_DATA";
  severity: "BLOCKING" | "REVIEW_REQUIRED";
  count: number;
  detail: string;
};

export type MonthlyReconciliation = {
  subjectRef: string;
  reportingMonth: string;
  status: "READY" | "HOLD";
  marketRows: number;
  wasteRows: number;
  issues: ReconciliationIssue[];
  checksumSha256: string;
};

function monthBounds(reportingMonth: string) {
  const start = new Date(reportingMonth + "T00:00:00.000Z");
  if (Number.isNaN(start.getTime()) || start.getUTCDate() !== 1) {
    throw new Error("Mes de reporte inválido.");
  }
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = new Date(next.getTime() - 86400000);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function reconcileMonthlyReporting(
  subjectRef = "recycla-os",
  reportingMonth = latestReportableMonth()
): Promise<MonthlyReconciliation | null> {
  if (!hasDatabase()) return null;

  const sql = db();
  const { start, end } = monthBounds(reportingMonth);

  try {
    const tables = await sql<Array<{ market: string | null; waste: string | null }>>`
      select
        to_regclass('public.market_introductions')::text as market,
        to_regclass('public.waste_management_operations')::text as waste
    `;

    if (!tables[0]?.market || !tables[0]?.waste) return null;

    const [market] = await sql<Array<{
      total: number;
      missingReference: number;
      missingUnit: number;
    }>>`
      select
        count(*)::int as total,
        count(*) filter (
          where transaction_ref is null or length(trim(transaction_ref)) = 0
        )::int as "missingReference",
        count(*) filter (
          where quantity is not null
            and (unit is null or length(trim(unit)) = 0)
        )::int as "missingUnit"
      from market_introductions
      where subject_ref = ${subjectRef}
        and occurred_at >= ${start}
        and occurred_at <= ${end}
    `;

    const [waste] = await sql<Array<{
      total: number;
      missingCounterparty: number;
      missingTaxDocument: number;
      missingSourceDocument: number;
      missingUnit: number;
    }>>`
      select
        count(*)::int as total,
        count(*) filter (
          where
            (counterparty_ref is null or length(trim(counterparty_ref)) = 0)
            and
            (counterparty_name is null or length(trim(counterparty_name)) = 0)
        )::int as "missingCounterparty",
        count(*) filter (
          where tax_document_ref is null or length(trim(tax_document_ref)) = 0
        )::int as "missingTaxDocument",
        count(*) filter (
          where source_document_ref is null or length(trim(source_document_ref)) = 0
        )::int as "missingSourceDocument",
        count(*) filter (
          where unit is null or length(trim(unit)) = 0
        )::int as "missingUnit"
      from waste_management_operations
      where subject_ref = ${subjectRef}
        and occurred_at >= ${start}
        and occurred_at <= ${end}
    `;

    const issues: ReconciliationIssue[] = [];

    if ((market?.total ?? 0) === 0) {
      issues.push({
        code: "NO_MARKET_DATA",
        severity: "BLOCKING",
        count: 1,
        detail: "No existen registros de introducción al mercado para el período."
      });
    }

    if ((waste?.total ?? 0) === 0) {
      issues.push({
        code: "NO_WASTE_DATA",
        severity: "BLOCKING",
        count: 1,
        detail: "No existen operaciones de gestión para el período."
      });
    }

    if ((market?.missingReference ?? 0) > 0) {
      issues.push({
        code: "MARKET_ROW_MISSING_REFERENCE",
        severity: "REVIEW_REQUIRED",
        count: market.missingReference,
        detail: "Hay transacciones de mercado sin referencia comercial/documental."
      });
    }

    if ((market?.missingUnit ?? 0) > 0) {
      issues.push({
        code: "UNIT_MISSING",
        severity: "BLOCKING",
        count: market.missingUnit,
        detail: "Hay cantidades de mercado sin unidad declarada."
      });
    }

    if ((waste?.missingCounterparty ?? 0) > 0) {
      issues.push({
        code: "WASTE_ROW_MISSING_COUNTERPARTY",
        severity: "BLOCKING",
        count: waste.missingCounterparty,
        detail: "Hay operaciones de gestión sin gestor o contraparte identificable."
      });
    }

    if ((waste?.missingTaxDocument ?? 0) > 0) {
      issues.push({
        code: "WASTE_ROW_MISSING_TAX_DOCUMENT",
        severity: "REVIEW_REQUIRED",
        count: waste.missingTaxDocument,
        detail: "Hay operaciones de gestión sin referencia a documento tributario."
      });
    }

    if ((waste?.missingSourceDocument ?? 0) > 0) {
      issues.push({
        code: "WASTE_ROW_MISSING_SOURCE_DOCUMENT",
        severity: "REVIEW_REQUIRED",
        count: waste.missingSourceDocument,
        detail: "Hay operaciones sin referencia documental de respaldo."
      });
    }

    if ((waste?.missingUnit ?? 0) > 0) {
      issues.push({
        code: "UNIT_MISSING",
        severity: "BLOCKING",
        count: waste.missingUnit,
        detail: "Hay operaciones de gestión sin unidad."
      });
    }

    const status = issues.some((issue) => issue.severity === "BLOCKING")
      ? "HOLD"
      : issues.length
        ? "HOLD"
        : "READY";

    const base = {
      subjectRef,
      reportingMonth,
      status,
      marketRows: market?.total ?? 0,
      wasteRows: waste?.total ?? 0,
      issues
    };

    return {
      ...base,
      checksumSha256: checksum(base)
    };
  } catch {
    return null;
  }
}
