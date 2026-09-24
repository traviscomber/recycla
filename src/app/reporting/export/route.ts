import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireComplianceSession } from "@/lib/auth/server";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import { getLatestComplianceRun } from "@/lib/compliance-runs";
import { listComplianceFindings } from "@/lib/compliance-findings";
import {
  getLatestMonthlyRepReport,
  latestReportableMonth
} from "@/lib/monthly-reporting";
import { reconcileMonthlyReporting } from "@/lib/reporting-reconciliation";
import { listRecentSnapshots } from "@/lib/state-snapshots";
import { listEvidenceDocuments, listRepLedgerEntries } from "@/lib/rep-repository";
import { listGestorIntelligence } from "@/lib/gestor-intelligence";

export const dynamic = "force-dynamic";

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function GET() {
  try {
    await requireComplianceSession();
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_REQUIRED";
    const status = code === "AUTH_FORBIDDEN" ? 403 : 401;
    return NextResponse.json({ error: code }, { status });
  }

  const subjectRef = "recycla-os";
  const reportingMonth = latestReportableMonth();

  const [
    gates,
    latestRun,
    monthlyReport,
    reconciliation,
    findings,
    snapshots,
    documents,
    ledgerEntries,
    gestores
  ] = await Promise.all([
    evaluateComplianceReadiness(),
    getLatestComplianceRun(subjectRef),
    getLatestMonthlyRepReport(subjectRef),
    reconcileMonthlyReporting(subjectRef, reportingMonth),
    listComplianceFindings(subjectRef, 200),
    listRecentSnapshots(200),
    listEvidenceDocuments(200),
    listRepLedgerEntries(200),
    listGestorIntelligence(subjectRef, 200)
  ]);

  const finalGate = gates.find((gate) => gate.id === "final-report");

  const payload = {
    schemaVersion: "recycla-compliance-pack-v1",
    generatedAt: new Date().toISOString(),
    subjectRef,
    reportingMonth,
    readiness: {
      finalStatus: finalGate?.status ?? "NOT_CONNECTED",
      gates,
      latestRun
    },
    monthlyReport,
    reconciliation,
    findings,
    evidence: {
      documents,
      ledgerEntries,
      officialSnapshots: snapshots,
      gestorIntelligence: gestores
    },
    boundary: {
      statement:
        "Este pack consolida evidencia y estado de preparación. No sustituye la presentación oficial ante SISREP/RETC ni convierte coincidencias externas en autorización o cumplimiento."
    }
  };

  const packChecksumSha256 = checksum(payload);
  const body = {
    ...payload,
    packChecksumSha256
  };

  const safeMonth = reportingMonth.slice(0, 7);
  const response = NextResponse.json(body);
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="recycla-compliance-pack-${safeMonth}.json"`
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Recycla-Pack-SHA256", packChecksumSha256);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
