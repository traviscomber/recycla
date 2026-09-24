import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { reconcileMonthlyReporting } from "@/lib/reporting-reconciliation";

export type MonthlyCloseResult = {
  ok: boolean;
  status: "READY" | "HOLD" | "FAILED";
  detail: string;
};

export async function finalizeMonthlyRepDraft(
  subjectRef: string,
  reportingMonth: string
): Promise<MonthlyCloseResult> {
  if (!hasDatabase()) {
    return {
      ok: false,
      status: "FAILED",
      detail: "DATABASE_URL no está configurada."
    };
  }

  const reconciliation = await reconcileMonthlyReporting(subjectRef, reportingMonth);
  if (!reconciliation) {
    return {
      ok: false,
      status: "FAILED",
      detail: "No fue posible reconciliar el período."
    };
  }

  if (reconciliation.status !== "READY" || reconciliation.issues.length > 0) {
    return {
      ok: false,
      status: "HOLD",
      detail: "El cierre mensual permanece bloqueado mientras existan observaciones de reconciliación."
    };
  }

  const sql = db();

  try {
    const tables = await sql<Array<{
      monthly: string | null;
      findings: string | null;
    }>>`
      select
        to_regclass('public.monthly_rep_reports')::text as monthly,
        to_regclass('public.compliance_findings')::text as findings
    `;

    if (!tables[0]?.monthly) {
      return {
        ok: false,
        status: "FAILED",
        detail: "La tabla monthly_rep_reports no está instalada."
      };
    }

    let openCriticalFindings = 0;
    if (tables[0]?.findings) {
      const [summary] = await sql<Array<{ count: number }>>`
        select count(*)::int as count
        from compliance_findings
        where subject_ref = ${subjectRef}
          and reporting_month = ${reportingMonth}
          and severity = 'critical'
          and status = 'open'
      `;
      openCriticalFindings = summary?.count ?? 0;
    }

    if (openCriticalFindings > 0) {
      return {
        ok: false,
        status: "HOLD",
        detail: `El cierre mensual permanece bloqueado por ${openCriticalFindings} hallazgo(s) crítico(s) abierto(s).`
      };
    }

    const [report] = await sql<Array<{
      id: string;
      status: "DRAFT" | "READY" | "SUBMITTED" | "REOPENED";
      checksumSha256: string | null;
      version: number;
    }>>`
      select
        id,
        status,
        checksum_sha256 as "checksumSha256",
        version
      from monthly_rep_reports
      where subject_ref = ${subjectRef}
        and reporting_month = ${reportingMonth}
      order by version desc
      limit 1
    `;

    if (!report) {
      return {
        ok: false,
        status: "HOLD",
        detail: "No existe un borrador mensual para el período."
      };
    }

    if (report.status === "READY" || report.status === "SUBMITTED") {
      return {
        ok: true,
        status: "READY",
        detail: report.status === "SUBMITTED"
          ? "El cierre mensual ya fue marcado como SUBMITTED."
          : "El cierre mensual ya estaba READY."
      };
    }

    if (!report.checksumSha256) {
      return {
        ok: false,
        status: "HOLD",
        detail: "El borrador no tiene checksum y no puede cerrarse."
      };
    }

    await sql`
      update monthly_rep_reports
      set
        status = 'READY',
        finalized_at = now()
      where id = ${report.id}
        and status in ('DRAFT', 'REOPENED')
    `;

    return {
      ok: true,
      status: "READY",
      detail: `Cierre mensual v${report.version} marcado READY con reconciliación limpia y sin hallazgos críticos abiertos.`
    };
  } catch (error) {
    return {
      ok: false,
      status: "FAILED",
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}
