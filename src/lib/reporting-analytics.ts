import "server-only";

import { db, hasDatabase } from "@/lib/db";

export type ReportingTrendPoint = {
  month: string;
  marketRows: number;
  wasteRows: number;
  wasteTaxDocCoveragePct: number | null;
};

export type PeriodComparison = {
  value: number | null;
  momPct: number | null;
  yoyPct: number | null;
};

function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function shiftMonth(month: string, delta: number) {
  const date = new Date(month + "T00:00:00.000Z");
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7) + "-01";
}

export function compareMonthlyMetric(
  points: ReportingTrendPoint[],
  reportingMonth: string,
  key: "marketRows" | "wasteRows" | "wasteTaxDocCoveragePct"
): PeriodComparison {
  const current = points.find((item) => item.month === reportingMonth)?.[key] ?? null;
  const previous = points.find((item) => item.month === shiftMonth(reportingMonth, -1))?.[key] ?? null;
  const lastYear = points.find((item) => item.month === shiftMonth(reportingMonth, -12))?.[key] ?? null;

  return {
    value: current,
    momPct: percentChange(current, previous),
    yoyPct: percentChange(current, lastYear)
  };
}

export async function getReportingTrend(
  subjectRef = "recycla-os",
  reportingMonth: string
): Promise<ReportingTrendPoint[]> {
  if (!hasDatabase()) return [];

  const sql = db();
  const end = new Date(reportingMonth + "T00:00:00.000Z");
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 13);

  try {
    const [tables] = await sql<Array<{ market: string | null; waste: string | null }>>`
      select
        to_regclass('public.market_introductions')::text as market,
        to_regclass('public.waste_management_operations')::text as waste
    `;

    if (!tables?.market || !tables?.waste) return [];

    const market = await sql<Array<{ month: string; count: number }>>`
      select
        to_char(date_trunc('month', occurred_at), 'YYYY-MM-01') as month,
        count(*)::int as count
      from market_introductions
      where subject_ref = ${subjectRef}
        and occurred_at >= ${start.toISOString()}
        and occurred_at < (${end.toISOString()}::timestamptz + interval '1 month')
      group by 1
      order by 1
    `;

    const waste = await sql<Array<{ month: string; count: number; withTaxDoc: number }>>`
      select
        to_char(date_trunc('month', occurred_at), 'YYYY-MM-01') as month,
        count(*)::int as count,
        count(*) filter (
          where tax_document_ref is not null
            and length(trim(tax_document_ref)) > 0
        )::int as "withTaxDoc"
      from waste_management_operations
      where subject_ref = ${subjectRef}
        and occurred_at >= ${start.toISOString()}
        and occurred_at < (${end.toISOString()}::timestamptz + interval '1 month')
      group by 1
      order by 1
    `;

    const marketMap = new Map(market.map((row) => [row.month, row.count]));
    const wasteMap = new Map(waste.map((row) => [row.month, row]));
    const months: string[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      months.push(cursor.toISOString().slice(0, 7) + "-01");
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return months.map((month) => {
      const wasteRow = wasteMap.get(month);
      const wasteRows = wasteRow?.count ?? 0;
      return {
        month,
        marketRows: marketMap.get(month) ?? 0,
        wasteRows,
        wasteTaxDocCoveragePct:
          wasteRows > 0
            ? Math.round(((wasteRow?.withTaxDoc ?? 0) / wasteRows) * 1000) / 10
            : null
      };
    });
  } catch {
    return [];
  }
}
