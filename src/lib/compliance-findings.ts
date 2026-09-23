import "server-only";

import { createHash } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";
import { latestReportableMonth } from "@/lib/monthly-reporting";
import { reconcileMonthlyReporting } from "@/lib/reporting-reconciliation";

export type ComplianceFinding = {
  id: string;
  subjectRef: string;
  reportingMonth: string;
  code: string;
  severity: "critical" | "warning" | "info";
  status: "open" | "resolved" | "accepted";
  detail: string;
  occurrenceCount: number;
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

function fingerprint(reportingMonth: string, code: string) {
  return createHash("sha256")
    .update(reportingMonth + ":" + code)
    .digest("hex");
}

export async function syncComplianceFindings(
  subjectRef = "recycla-os",
  reportingMonth = latestReportableMonth()
) {
  if (!hasDatabase()) {
    return { ok: false, detail: "DATABASE_URL no está configurada.", open: 0 };
  }

  const reconciliation = await reconcileMonthlyReporting(subjectRef, reportingMonth);
  if (!reconciliation) {
    return { ok: false, detail: "No fue posible reconciliar el período.", open: 0 };
  }

  const sql = db();

  try {
    const table = await sql<Array<{ findings: string | null }>>`
      select to_regclass('public.compliance_findings')::text as findings
    `;
    if (!table[0]?.findings) {
      return { ok: false, detail: "La tabla compliance_findings no está instalada.", open: 0 };
    }

    const activeFingerprints: string[] = [];

    for (const issue of reconciliation.issues) {
      const fp = fingerprint(reportingMonth, issue.code);
      activeFingerprints.push(fp);
      const severity = issue.severity === "BLOCKING" ? "critical" : "warning";

      await sql`
        insert into compliance_findings (
          subject_ref,
          reporting_month,
          code,
          severity,
          status,
          detail,
          occurrence_count,
          fingerprint_sha256,
          evidence
        ) values (
          ${subjectRef},
          ${reportingMonth},
          ${issue.code},
          ${severity},
          'open',
          ${issue.detail},
          ${issue.count},
          ${fp},
          ${sql.json({
            reconciliationChecksum: reconciliation.checksumSha256,
            marketRows: reconciliation.marketRows,
            wasteRows: reconciliation.wasteRows
          })}
        )
        on conflict (subject_ref, reporting_month, fingerprint_sha256)
        do update set
          severity = excluded.severity,
          status = 'open',
          detail = excluded.detail,
          occurrence_count = excluded.occurrence_count,
          evidence = excluded.evidence,
          updated_at = now(),
          resolved_at = null
      `;
    }

    if (activeFingerprints.length) {
      await sql`
        update compliance_findings
        set
          status = 'resolved',
          resolved_at = now(),
          updated_at = now()
        where subject_ref = ${subjectRef}
          and reporting_month = ${reportingMonth}
          and status = 'open'
          and not (fingerprint_sha256 = any(${activeFingerprints}))
      `;
    } else {
      await sql`
        update compliance_findings
        set
          status = 'resolved',
          resolved_at = now(),
          updated_at = now()
        where subject_ref = ${subjectRef}
          and reporting_month = ${reportingMonth}
          and status = 'open'
      `;
    }

    const [summary] = await sql<Array<{ open: number; critical: number }>>`
      select
        count(*) filter (where status = 'open')::int as open,
        count(*) filter (
          where status = 'open' and severity = 'critical'
        )::int as critical
      from compliance_findings
      where subject_ref = ${subjectRef}
        and reporting_month = ${reportingMonth}
    `;

    return {
      ok: true,
      detail: "Hallazgos de compliance sincronizados con la reconciliación.",
      open: summary?.open ?? 0,
      critical: summary?.critical ?? 0
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "Error desconocido",
      open: 0
    };
  }
}

export async function listComplianceFindings(
  subjectRef = "recycla-os",
  limit = 100
): Promise<ComplianceFinding[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const table = await sql<Array<{ findings: string | null }>>`
      select to_regclass('public.compliance_findings')::text as findings
    `;
    if (!table[0]?.findings) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 500);
    return await sql<ComplianceFinding[]>`
      select
        id,
        subject_ref as "subjectRef",
        reporting_month::text as "reportingMonth",
        code,
        severity,
        status,
        detail,
        occurrence_count as "occurrenceCount",
        evidence,
        created_at::text as "createdAt",
        updated_at::text as "updatedAt",
        resolved_at::text as "resolvedAt"
      from compliance_findings
      where subject_ref = ${subjectRef}
      order by
        case severity when 'critical' then 1 when 'warning' then 2 else 3 end,
        case status when 'open' then 1 when 'accepted' then 2 else 3 end,
        updated_at desc
      limit ${safeLimit}
    `;
  } catch {
    return [];
  }
}
