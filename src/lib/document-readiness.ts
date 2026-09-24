import "server-only";

import { db, hasDatabase } from "@/lib/db";

export type RepDocumentRequirement = {
  id: string;
  label: string;
  class: "REGISTRO_EXIGIDO" | "RESPALDO_EXIGIDO" | "CONDICIONAL";
  legalBasis: string;
  legalRequirement: string;
  evidenceExamples: string[];
  retention: string;
};

export type RepDocumentReadiness = RepDocumentRequirement & {
  status: "READY" | "REVIEW_REQUIRED" | "NOT_CONNECTED";
  coveragePct: number | null;
  covered: number;
  total: number;
  detail: string;
};

export const repDocumentRequirements: RepDocumentRequirement[] = [
  {
    id: "product-register",
    label: "Registro de productos y clasificación REP",
    class: "REGISTRO_EXIGIDO",
    legalBasis: "Res. Ex. SMA 2084/2023 · arts. 3 y 11(a)",
    legalRequirement:
      "Mantener identificable el producto prioritario y su clasificación por categoría y subcategoría aplicable.",
    evidenceExamples: ["Maestro SKU", "catálogo comercial", "ficha de producto", "regla de clasificación versionada"],
    retention: "6 años para la documentación que respalda los datos registrados"
  },
  {
    id: "equivalence",
    label: "Equivalencia producto → residuo",
    class: "REGISTRO_EXIGIDO",
    legalBasis: "Res. Ex. SMA 2084/2023 · arts. 4 y 11(b)",
    legalRequirement:
      "Mantener identificable y cuantificable la relación entre el producto introducido al mercado y el residuo sujeto a gestión.",
    evidenceExamples: ["tabla de equivalencia", "peso unitario", "ficha técnica", "metodología de conversión"],
    retention: "6 años para la documentación que respalda los datos registrados"
  },
  {
    id: "market-support",
    label: "Respaldo de introducción al mercado",
    class: "RESPALDO_EXIGIDO",
    legalBasis: "Res. Ex. SMA 2084/2023 · arts. 5 y 14",
    legalRequirement:
      "Las operaciones informadas deben poder demostrarse documentalmente y trazarse a producto, fecha, unidades/cantidad y consumidor cuando corresponda.",
    evidenceExamples: ["factura/DTE", "nota de crédito", "documento comercial", "registro ERP"],
    retention: "6 años"
  },
  {
    id: "waste-support",
    label: "Respaldo de operaciones de gestión",
    class: "RESPALDO_EXIGIDO",
    legalBasis: "Res. Ex. SMA 2084/2023 · arts. 7 y 14",
    legalRequirement:
      "Cada operación debe conservar trazabilidad de fecha, tipo de gestión, contraparte, cantidad, costo y documento tributario de respaldo.",
    evidenceExamples: ["factura/DTE", "orden/acta de retiro", "ticket de pesaje", "recepción", "certificado de valorización"],
    retention: "6 años"
  },
  {
    id: "archive",
    label: "Archivo documental trazable",
    class: "RESPALDO_EXIGIDO",
    legalBasis: "Res. Ex. SMA 2084/2023 · art. 14",
    legalRequirement:
      "Los datos REP deben estar respaldados por documentos que den fe de lo informado y quedar disponibles para la SMA.",
    evidenceExamples: ["documento original", "checksum", "vínculo a entidad", "fecha de emisión", "vigencia"],
    retention: "6 años"
  },
  {
    id: "monthly-report",
    label: "Reporte mensual SISREP",
    class: "REGISTRO_EXIGIDO",
    legalBasis: "Res. Ex. SMA 2084/2023 · arts. 6 y 8; Res. Ex. SMA 2279/2024",
    legalRequirement:
      "Mantener el consolidado mensual de introducción al mercado y/o operaciones de gestión según corresponda.",
    evidenceExamples: ["cierre mensual versionado", "checksum", "reconciliación", "archivo de carga SISREP"],
    retention: "6 años junto con sus respaldos"
  },
  {
    id: "final-pack",
    label: "Informe de cumplimiento y pack de auditoría",
    class: "CONDICIONAL",
    legalBasis: "Ley 20.920 · art. 22(c); Res. Ex. SMA 2084/2023 · arts. 9 a 11",
    legalRequirement:
      "Consolidar la información del período y dejar evidencia suficiente para la verificación de consistencia y auditoría cuando corresponda.",
    evidenceExamples: ["informe final", "dataset consolidado", "reconciliación", "hallazgos", "evidencia del auditor"],
    retention: "Según obligación aplicable; respaldos REP: 6 años"
  }
];

function monthBounds(reportingMonth: string) {
  const start = new Date(reportingMonth + "T00:00:00.000Z");
  if (Number.isNaN(start.getTime()) || start.getUTCDate() !== 1) {
    throw new Error("reportingMonth debe usar YYYY-MM-01.");
  }
  const next = new Date(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = new Date(next.getTime() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function statusFromCoverage(total: number, covered: number) {
  if (total <= 0) return "NOT_CONNECTED" as const;
  return covered >= total ? ("READY" as const) : ("REVIEW_REQUIRED" as const);
}

function pct(total: number, covered: number) {
  return total > 0 ? Math.round((covered / total) * 1000) / 10 : null;
}

export async function evaluateRepDocumentReadiness(
  subjectRef = "recycla-os",
  reportingMonth: string
): Promise<RepDocumentReadiness[]> {
  if (!hasDatabase()) {
    return repDocumentRequirements.map((item) => ({
      ...item,
      status: "NOT_CONNECTED",
      coveragePct: null,
      covered: 0,
      total: 0,
      detail: "Base de datos no configurada."
    }));
  }

  const sql = db();
  const { start, end } = monthBounds(reportingMonth);

  try {
    const [tables] = await sql<Array<{
      market: string | null;
      waste: string | null;
      documents: string | null;
      evidence: string | null;
      monthly: string | null;
      allocations: string | null;
    }>>`
      select
        to_regclass('public.market_introductions')::text as market,
        to_regclass('public.waste_management_operations')::text as waste,
        to_regclass('public.documents')::text as documents,
        to_regclass('public.evidence_links')::text as evidence,
        to_regclass('public.monthly_rep_reports')::text as monthly,
        to_regclass('public.valuation_allocations')::text as allocations
    `;

    const market = tables?.market
      ? (await sql<Array<{
          total: number;
          classified: number;
          supported: number;
        }>>`
          select
            count(*)::int as total,
            count(*) filter (
              where priority_product is not null
                and length(trim(priority_product)) > 0
                and category is not null
                and length(trim(category)) > 0
            )::int as classified,
            count(*) filter (
              where
                (transaction_ref is not null and length(trim(transaction_ref)) > 0)
                or
                (source_document_ref is not null and length(trim(source_document_ref)) > 0)
            )::int as supported
          from market_introductions
          where subject_ref = ${subjectRef}
            and occurred_at >= ${start}
            and occurred_at <= ${end}
        `)[0]
      : null;

    const waste = tables?.waste
      ? (await sql<Array<{
          total: number;
          supported: number;
        }>>`
          select
            count(*)::int as total,
            count(*) filter (
              where
                tax_document_ref is not null
                and length(trim(tax_document_ref)) > 0
                and (
                  source_document_ref is not null
                  and length(trim(source_document_ref)) > 0
                )
                and (
                  (counterparty_ref is not null and length(trim(counterparty_ref)) > 0)
                  or
                  (counterparty_name is not null and length(trim(counterparty_name)) > 0)
                )
            )::int as supported
          from waste_management_operations
          where subject_ref = ${subjectRef}
            and occurred_at >= ${start}
            and occurred_at <= ${end}
        `)[0]
      : null;

    const archive = tables?.documents && tables?.evidence
      ? (await sql<Array<{ total: number; linked: number; checksummed: number }>>`
          select
            count(distinct d.id)::int as total,
            count(distinct d.id) filter (where el.id is not null)::int as linked,
            count(distinct d.id) filter (
              where d.checksum_sha256 is not null
                and length(trim(d.checksum_sha256)) > 0
            )::int as checksummed
          from documents d
          left join evidence_links el on el.document_id = d.id
        `)[0]
      : null;

    const allocation = tables?.allocations
      ? (await sql<Array<{ total: number; evidenced: number }>>`
          select
            count(*)::int as total,
            count(*) filter (where evidence_document_id is not null)::int as evidenced
          from valuation_allocations
        `)[0]
      : null;

    const monthly = tables?.monthly
      ? (await sql<Array<{ total: number; ready: number }>>`
          select
            count(*)::int as total,
            count(*) filter (where status in ('READY','SUBMITTED'))::int as ready
          from monthly_rep_reports
          where subject_ref = ${subjectRef}
            and reporting_month = ${reportingMonth}
        `)[0]
      : null;

    const live: Record<string, { total: number; covered: number; detail: string }> = {
      "product-register": {
        total: market?.total ?? 0,
        covered: market?.classified ?? 0,
        detail: market?.total
          ? `${market.classified}/${market.total} registros del período tienen producto y categoría informados.`
          : "Sin registros de introducción al mercado para evaluar clasificación."
      },
      equivalence: {
        total: allocation?.total ?? 0,
        covered: allocation?.evidenced ?? 0,
        detail: allocation?.total
          ? `${allocation.evidenced}/${allocation.total} asignaciones de valorización mantienen documento de evidencia asociado.`
          : "Sin asignaciones de valorización para comprobar equivalencia y soporte."
      },
      "market-support": {
        total: market?.total ?? 0,
        covered: market?.supported ?? 0,
        detail: market?.total
          ? `${market.supported}/${market.total} introducciones tienen referencia transaccional o documento fuente.`
          : "Sin introducciones al mercado para evaluar respaldo."
      },
      "waste-support": {
        total: waste?.total ?? 0,
        covered: waste?.supported ?? 0,
        detail: waste?.total
          ? `${waste.supported}/${waste.total} operaciones tienen contraparte, documento tributario y documento fuente.`
          : "Sin operaciones de gestión para evaluar respaldo."
      },
      archive: {
        total: archive?.total ?? 0,
        covered: Math.min(archive?.linked ?? 0, archive?.checksummed ?? 0),
        detail: archive?.total
          ? `${archive.linked}/${archive.total} documentos vinculados; ${archive.checksummed}/${archive.total} con checksum.`
          : "Evidence Graph sin documentos disponibles para evaluar archivo."
      },
      "monthly-report": {
        total: monthly?.total ?? 0,
        covered: monthly?.ready ?? 0,
        detail: monthly?.total
          ? monthly.ready > 0
            ? "El período tiene un cierre mensual READY/SUBMITTED."
            : "Existe cierre mensual, pero todavía no está READY/SUBMITTED."
          : "No existe cierre mensual para el período."
      },
      "final-pack": {
        total:
          (market?.total ?? 0) +
          (waste?.total ?? 0) +
          (monthly?.total ?? 0),
        covered:
          (market?.supported ?? 0) +
          (waste?.supported ?? 0) +
          (monthly?.ready ?? 0),
        detail:
          "El pack final se considera defendible sólo después de reconciliar datos, documentación, cierres y hallazgos; esta señal no sustituye auditoría externa."
      }
    };

    return repDocumentRequirements.map((item) => {
      const row = live[item.id] ?? { total: 0, covered: 0, detail: "Control no evaluado." };
      return {
        ...item,
        status: statusFromCoverage(row.total, row.covered),
        coveragePct: pct(row.total, row.covered),
        covered: row.covered,
        total: row.total,
        detail: row.detail
      };
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No fue posible evaluar documentación.";
    return repDocumentRequirements.map((item) => ({
      ...item,
      status: "NOT_CONNECTED",
      coveragePct: null,
      covered: 0,
      total: 0,
      detail
    }));
  }
}
