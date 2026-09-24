import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireComplianceSession } from "@/lib/auth/server";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import { getLatestComplianceRun } from "@/lib/compliance-runs";
import { listComplianceFindings } from "@/lib/compliance-findings";
import {
  getMonthlyRepReport,
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
    getMonthlyRepReport(subjectRef, reportingMonth),
    reconcileMonthlyReporting(subjectRef, reportingMonth),
    listComplianceFindings(subjectRef, 200),
    listRecentSnapshots(200),
    listEvidenceDocuments(200),
    listRepLedgerEntries(200),
    listGestorIntelligence(subjectRef, 200)
  ]);

  const finalGate = gates.find((gate) => gate.id === "final-report");
  const blockers: string[] = [];

  if (finalGate?.status !== "READY") {
    blockers.push("El gate final de cumplimiento no está READY.");
  }
  if (latestRun?.status !== "PASS") {
    blockers.push("El último compliance pre-check no está en PASS.");
  }
  if (!monthlyReport || !["READY", "SUBMITTED"].includes(monthlyReport.status)) {
    blockers.push("El cierre mensual exacto del período no está READY/SUBMITTED.");
  }
  if (!reconciliation || reconciliation.status !== "READY" || reconciliation.issues.length > 0) {
    blockers.push("La reconciliación mensual mantiene observaciones o no está READY.");
  }

  if (blockers.length) {
    return NextResponse.json(
      {
        error: "COMPLIANCE_PACK_HOLD",
        reportingMonth,
        blockers
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Recycla-Pack-Status": "HOLD"
        }
      }
    );
  }

  const content = {
    schemaVersion: "recycla-compliance-pack-v2",
    subjectRef,
    reportingMonth,
    readiness: {
      finalStatus: finalGate.status,
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
    manifest: {
      monthlyReportChecksumSha256: monthlyReport.checksumSha256,
      reconciliationChecksumSha256: checksum(reconciliation),
      findingsChecksumSha256: checksum(findings),
      documentsChecksumSha256: checksum(documents),
      ledgerChecksumSha256: checksum(ledgerEntries),
      officialSnapshotsChecksumSha256: checksum(snapshots),
      gestorIntelligenceChecksumSha256: checksum(gestores)
    },
    boundary: {
      statement:
        "Este pack consolida evidencia y estado de preparación. No sustituye la presentación oficial ante SISREP/RETC ni convierte coincidencias externas en autorización o cumplimiento."
    }
  };

  const contentChecksumSha256 = checksum(content);
  const body = {
    generatedAt: new Date().toISOString(),
    ...content,
    contentChecksumSha256
  };

  const safeMonth = reportingMonth.slice(0, 7);
  const response = NextResponse.json(body);
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="recycla-compliance-pack-${safeMonth}.json"`
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Recycla-Pack-SHA256", contentChecksumSha256);
  response.headers.set("X-Recycla-Pack-Status", "READY");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
