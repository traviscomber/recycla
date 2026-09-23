import { NextRequest, NextResponse } from "next/server";
import { importReportingFile } from "@/lib/reporting-intake";
import { reconcileMonthlyReporting } from "@/lib/reporting-reconciliation";
import { generateMonthlyRepDraft } from "@/lib/monthly-reporting";
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

  const subjectRef = "qa-reporting-intake";
  const month = "2026-07-01";
  const marketCsv = [
    "fecha,producto prioritario,categoria,subcategoria,unidades,cantidad,unidad,consumidor,documento tributario,documento respaldo",
    "2026-07-15,AEE / RAEE,Electronica,Equipos,10,125,kg,Cliente QA,F001,OC-001"
  ].join("\n");

  const wasteCsv = [
    "fecha,producto prioritario,categoria,subcategoria,tipo operacion,gestor,cantidad,unidad,costo clp,documento tributario,documento respaldo",
    "2026-07-20,AEE / RAEE,Electronica,Equipos,VALORIZACION,Gestor QA,120,kg,45000,F002,CERT-001"
  ].join("\n");

  const sql = db();

  try {
    await sql`delete from monthly_rep_reports where subject_ref = ${subjectRef}`;
    await sql`delete from market_introductions where subject_ref = ${subjectRef}`;
    await sql`delete from waste_management_operations where subject_ref = ${subjectRef}`;
    await sql`delete from reporting_import_batches where subject_ref = ${subjectRef}`;

    const market = await importReportingFile({
      subjectRef,
      type: "MARKET_INTRODUCTIONS",
      fileName: "qa-market.csv",
      buffer: Buffer.from(marketCsv, "utf8")
    });

    const waste = await importReportingFile({
      subjectRef,
      type: "WASTE_OPERATIONS",
      fileName: "qa-waste.csv",
      buffer: Buffer.from(wasteCsv, "utf8")
    });

    const reconciliation = await reconcileMonthlyReporting(subjectRef, month);
    const monthly = await generateMonthlyRepDraft(subjectRef, month);

    const duplicateMarket = await importReportingFile({
      subjectRef,
      type: "MARKET_INTRODUCTIONS",
      fileName: "qa-market.csv",
      buffer: Buffer.from(marketCsv, "utf8")
    });

    const counts = await sql<Array<{ market: number; waste: number; monthly: number; batches: number }>>`
      select
        (select count(*)::int from market_introductions where subject_ref = ${subjectRef}) as market,
        (select count(*)::int from waste_management_operations where subject_ref = ${subjectRef}) as waste,
        (select count(*)::int from monthly_rep_reports where subject_ref = ${subjectRef}) as monthly,
        (select count(*)::int from reporting_import_batches where subject_ref = ${subjectRef}) as batches
    `;

    const result = {
      market,
      waste,
      reconciliation,
      monthly: monthly.report
        ? {
            ok: monthly.ok,
            status: monthly.report.status,
            version: monthly.report.version,
            checksum: monthly.report.checksumSha256
          }
        : { ok: monthly.ok, detail: monthly.detail },
      duplicateMarket,
      persistedCounts: counts[0]
    };

    await sql`delete from monthly_rep_reports where subject_ref = ${subjectRef}`;
    await sql`delete from market_introductions where subject_ref = ${subjectRef}`;
    await sql`delete from waste_management_operations where subject_ref = ${subjectRef}`;
    await sql`delete from reporting_import_batches where subject_ref = ${subjectRef}`;

    return NextResponse.json({ ok: true, result });
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
