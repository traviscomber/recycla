import "server-only";

import { createHash } from "node:crypto";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import { getLatestComplianceRun } from "@/lib/compliance-runs";
import { getLatestMonthlyRepReport } from "@/lib/monthly-reporting";
import { reconcileMonthlyReporting } from "@/lib/reporting-reconciliation";
import { listRecentSnapshots } from "@/lib/state-snapshots";

export type CompliancePack = {
  schemaVersion: "recycla-compliance-pack/v1";
  subjectRef: string;
  reportingMonth: string | null;
  generatedAt: string;
  monthlyReport: Awaited<ReturnType<typeof getLatestMonthlyRepReport>>;
  reconciliation: Awaited<ReturnType<typeof reconcileMonthlyReporting>>;
  complianceRun: Awaited<ReturnType<typeof getLatestComplianceRun>>;
  gates: Awaited<ReturnType<typeof evaluateComplianceReadiness>>;
  officialEvidence: Awaited<ReturnType<typeof listRecentSnapshots>>;
  checksumSha256: string;
};

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buildCompliancePack(
  subjectRef = "recycla-os"
): Promise<CompliancePack> {
  const monthlyReport = await getLatestMonthlyRepReport(subjectRef);
  const reportingMonth = monthlyReport?.reportingMonth ?? null;

  const [gates, complianceRun, officialEvidence, reconciliation] = await Promise.all([
    evaluateComplianceReadiness(),
    getLatestComplianceRun(subjectRef),
    listRecentSnapshots(100),
    reportingMonth
      ? reconcileMonthlyReporting(subjectRef, reportingMonth)
      : Promise.resolve(null)
  ]);

  const payload = {
    schemaVersion: "recycla-compliance-pack/v1" as const,
    subjectRef,
    reportingMonth,
    generatedAt: new Date().toISOString(),
    monthlyReport,
    reconciliation,
    complianceRun,
    gates,
    officialEvidence
  };

  return {
    ...payload,
    checksumSha256: checksum(payload)
  };
}
