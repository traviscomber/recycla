import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { importReportingFile } from "@/lib/reporting-intake";
import {
  reconcileHistoricalYear,
  recycla2025PublicBenchmark
} from "@/lib/historical-reconciliation";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, error: "Preview only." }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("run") !== "1") {
    return NextResponse.json({ ok: false, error: "Missing run=1." }, { status: 400 });
  }

  const subjectRef = "qa-historical-backfill";
  const sql = db();

  try {
    await sql`delete from waste_management_operations where subject_ref = ${subjectRef}`;
    await sql`delete from reporting_import_batches where subject_ref = ${subjectRef}`;
    await sql`delete from historical_reference_totals where subject_ref = ${subjectRef}`;

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
          metadata
        ) values (
          ${subjectRef},
          2025,
          'ANNUAL_PROCESSED_RESIDUES',
          ${item.category},
          ${item.quantity},
          't',
          'QA copy · Recycla Chile Reporte de Sostenibilidad 2025',
          'https://www.recycla.cl/',
          ${sql.json({ qa: true })}
        )
      `;
    }

    const workbook = XLSX.utils.book_new();

    for (let month = 1; month <= 12; month += 1) {
      const isFinalMonth = month === 12;
      const rows = recycla2025PublicBenchmark.categories.map((item, index) => {
        const annualKg = item.quantity * 1000;
        const base = Math.floor((annualKg / 12) * 1000) / 1000;
        const allocatedBeforeFinal = base * 11;
        const kg = isFinalMonth ? annualKg - allocatedBeforeFinal : base;

        return {
          "fecha retiro": `15/${String(month).padStart(2, "0")}/2025`,
          "producto prioritario": item.category,
          "categoria": item.category,
          "tipo operacion": "VALORIZACION",
          "gestor": "QA Historical Gestor",
          "cantidad": String(kg).replace(".", ","),
          "unidad": "kg",
          "costo clp": String(10000 + index),
          "documento tributario": `QA-${month}-${index}`,
          "documento respaldo": `QA-CERT-${month}-${index}`
        };
      });

      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        String(month).padStart(2, "0")
      );
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const imported = await importReportingFile({
      subjectRef,
      type: "WASTE_OPERATIONS",
      fileName: "qa-recycla-2025-multisheet.xlsx",
      buffer
    });

    const duplicate = await importReportingFile({
      subjectRef,
      type: "WASTE_OPERATIONS",
      fileName: "qa-recycla-2025-multisheet.xlsx",
      buffer
    });

    const reconciliation = await reconcileHistoricalYear(subjectRef, 2025);

    const [counts] = await sql<Array<{ waste: number; batches: number }>>`
      select
        (select count(*)::int from waste_management_operations where subject_ref = ${subjectRef}) as waste,
        (select count(*)::int from reporting_import_batches where subject_ref = ${subjectRef}) as batches
    `;

    const result = {
      imported,
      duplicate,
      reconciliation,
      persistedCounts: counts
    };

    await sql`delete from waste_management_operations where subject_ref = ${subjectRef}`;
    await sql`delete from reporting_import_batches where subject_ref = ${subjectRef}`;
    await sql`delete from historical_reference_totals where subject_ref = ${subjectRef}`;

    return NextResponse.json({
      ok:
        imported.ok &&
        imported.acceptedRows === 108 &&
        duplicate.batchId === imported.batchId &&
        reconciliation?.status === "MATCH" &&
        reconciliation.referenceTotalTonnes === 634,
      result
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
