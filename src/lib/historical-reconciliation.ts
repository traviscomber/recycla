import "server-only";

import { createHash } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";

export const recycla2025PublicBenchmark = {
  subjectRef: "recycla-os",
  referenceYear: 2025,
  metricScope: "ANNUAL_PROCESSED_RESIDUES",
  sourceLabel: "Recycla Chile · Reporte de Sostenibilidad 2025",
  sourceUrl: "https://www.recycla.cl/",
  categories: [
    { category: "Residuos peligrosos", quantity: 17.4, unit: "t" },
    { category: "Papel", quantity: 24.1, unit: "t" },
    { category: "Vidrio", quantity: 8.2, unit: "t" },
    { category: "Metales ferrosos", quantity: 187.3, unit: "t" },
    { category: "Cartón", quantity: 119.8, unit: "t" },
    { category: "Plásticos", quantity: 12.2, unit: "t" },
    { category: "Metales no ferrosos", quantity: 14.8, unit: "t" },
    { category: "Madera", quantity: 94.9, unit: "t" },
    { category: "Residuos eléctricos y electrónicos", quantity: 155.3, unit: "t" }
  ]
} as const;

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function seedRecycla2025PublicBenchmark() {
  if (!hasDatabase()) return { ok: false, detail: "DATABASE_URL no está configurada." };

  const sql = db();
  const sourceChecksum = checksum(recycla2025PublicBenchmark);

  try {
    const table = await sql<Array<{ refs: string | null }>>`
      select to_regclass('public.historical_reference_totals')::text as refs
    `;
    if (!table[0]?.refs) {
      return { ok: false, detail: "La tabla historical_reference_totals no está instalada." };
    }

    for (const item of recycla2025PublicBenchmark.categories) {
      await sql`
        insert into historical_reference_totals (
          subject_ref,
          reference_year,
          metric_scope,
          category,
          quantity,
          unit,
          source_label,
          source_url,
          source_checksum_sha256,
          metadata
        ) values (
          ${recycla2025PublicBenchmark.subjectRef},
          ${recycla2025PublicBenchmark.referenceYear},
          ${recycla2025PublicBenchmark.metricScope},
          ${item.category},
          ${item.quantity},
          ${item.unit},
          ${recycla2025PublicBenchmark.sourceLabel},
          ${recycla2025PublicBenchmark.sourceUrl},
          ${sourceChecksum},
          ${sql.json({
            publicReferenceOnly: true,
            interpretation:
              "Valor agregado anual publicado por Recycla; no equivale a registro transaccional ni prueba de compliance REP."
          })}
        )
        on conflict (
          subject_ref,
          reference_year,
          metric_scope,
          category,
          source_url
        )
        do update set
          quantity = excluded.quantity,
          unit = excluded.unit,
          source_label = excluded.source_label,
          source_checksum_sha256 = excluded.source_checksum_sha256,
          metadata = excluded.metadata,
          captured_at = now()
      `;
    }

    return {
      ok: true,
      detail: "Benchmark público 2025 persistido.",
      categories: recycla2025PublicBenchmark.categories.length,
      totalTonnes: recycla2025PublicBenchmark.categories.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
      sourceChecksum
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

function normalizeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const categoryAliases = new Map<string, string>([
  ["residuos peligrosos", "Residuos peligrosos"],
  ["respel", "Residuos peligrosos"],
  ["papel", "Papel"],
  ["vidrio", "Vidrio"],
  ["metales ferrosos", "Metales ferrosos"],
  ["ferrosos", "Metales ferrosos"],
  ["carton", "Cartón"],
  ["plasticos", "Plásticos"],
  ["plastico", "Plásticos"],
  ["metales no ferrosos", "Metales no ferrosos"],
  ["no ferrosos", "Metales no ferrosos"],
  ["madera", "Madera"],
  ["residuos electricos y electronicos", "Residuos eléctricos y electrónicos"],
  ["aee", "Residuos eléctricos y electrónicos"],
  ["raee", "Residuos eléctricos y electrónicos"],
  ["aee raee", "Residuos eléctricos y electrónicos"]
]);

export type HistoricalAnnualReconciliation = {
  referenceYear: number;
  sourceLabel: string;
  sourceUrl: string;
  status: "MATCH" | "PARTIAL" | "NO_DATA";
  referenceTotalTonnes: number;
  operationalTotalTonnes: number;
  matchedCategories: number;
  categories: Array<{
    category: string;
    referenceTonnes: number;
    operationalTonnes: number | null;
    deltaTonnes: number | null;
    deltaPercent: number | null;
  }>;
};

export async function reconcileHistoricalYear(
  subjectRef = "recycla-os",
  referenceYear = 2025
): Promise<HistoricalAnnualReconciliation | null> {
  if (!hasDatabase()) return null;

  const sql = db();

  try {
    const tables = await sql<Array<{ refs: string | null; waste: string | null }>>`
      select
        to_regclass('public.historical_reference_totals')::text as refs,
        to_regclass('public.waste_management_operations')::text as waste
    `;
    if (!tables[0]?.refs || !tables[0]?.waste) return null;

    const refs = await sql<Array<{
      category: string;
      quantity: number;
      unit: string;
      sourceLabel: string;
      sourceUrl: string;
    }>>`
      select
        category,
        quantity::float8 as quantity,
        unit,
        source_label as "sourceLabel",
        source_url as "sourceUrl"
      from historical_reference_totals
      where subject_ref = ${subjectRef}
        and reference_year = ${referenceYear}
        and metric_scope = 'ANNUAL_PROCESSED_RESIDUES'
      order by category
    `;

    if (!refs.length) return null;

    const operationalRows = await sql<Array<{ label: string; quantity: number; unit: string }>>`
      select
        coalesce(nullif(subcategory, ''), nullif(category, ''), priority_product) as label,
        sum(quantity)::float8 as quantity,
        lower(unit) as unit
      from waste_management_operations
      where subject_ref = ${subjectRef}
        and occurred_at >= ${referenceYear + "-01-01"}
        and occurred_at <= ${referenceYear + "-12-31"}
      group by
        coalesce(nullif(subcategory, ''), nullif(category, ''), priority_product),
        lower(unit)
      order by label
    `;

    const totals = new Map<string, number>();

    for (const row of operationalRows) {
      const canonical =
        categoryAliases.get(normalizeCategory(row.label)) ?? null;
      if (!canonical) continue;

      let tonnes = 0;
      if (row.unit === "t" || row.unit === "ton" || row.unit === "tonelada" || row.unit === "toneladas") {
        tonnes = Number(row.quantity ?? 0);
      } else if (row.unit === "kg" || row.unit === "kgs" || row.unit === "kilogramo" || row.unit === "kilogramos") {
        tonnes = Number(row.quantity ?? 0) / 1000;
      } else {
        continue;
      }

      totals.set(canonical, (totals.get(canonical) ?? 0) + tonnes);
    }

    const categories = refs.map((ref) => {
      const operational = totals.has(ref.category)
        ? totals.get(ref.category) ?? 0
        : null;
      const delta =
        operational === null ? null : operational - Number(ref.quantity);
      const deltaPercent =
        delta === null || Number(ref.quantity) === 0
          ? null
          : (delta / Number(ref.quantity)) * 100;

      return {
        category: ref.category,
        referenceTonnes: Number(ref.quantity),
        operationalTonnes: operational,
        deltaTonnes: delta,
        deltaPercent
      };
    });

    const matchedCategories = categories.filter(
      (item) => item.operationalTonnes !== null
    ).length;
    const operationalTotalTonnes = categories.reduce(
      (sum, item) => sum + Number(item.operationalTonnes ?? 0),
      0
    );
    const referenceTotalTonnes = categories.reduce(
      (sum, item) => sum + item.referenceTonnes,
      0
    );

    const allMatchedExactly =
      matchedCategories === categories.length &&
      categories.every(
        (item) =>
          item.deltaTonnes !== null && Math.abs(item.deltaTonnes) < 0.001
      );

    return {
      referenceYear,
      sourceLabel: refs[0].sourceLabel,
      sourceUrl: refs[0].sourceUrl,
      status:
        matchedCategories === 0
          ? "NO_DATA"
          : allMatchedExactly
            ? "MATCH"
            : "PARTIAL",
      referenceTotalTonnes,
      operationalTotalTonnes,
      matchedCategories,
      categories
    };
  } catch {
    return null;
  }
}
