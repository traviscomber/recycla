import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";

export type ComplianceRunSummary = {
  id: string;
  subjectRef: string;
  reportingMonth: string | null;
  status: "PASS" | "HOLD" | "FAILED" | "RUNNING";
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown>;
};

export async function runCompliancePrecheck(
  subjectRef: string,
  reportingMonth?: string | null
): Promise<{
  ok: boolean;
  runId?: string;
  status: "PASS" | "HOLD" | "FAILED";
  detail: string;
}> {
  if (!hasDatabase()) {
    return {
      ok: false,
      status: "FAILED",
      detail: "DATABASE_URL no está configurada."
    };
  }

  const sql = db();

  try {
    const tables = await sql<Array<{
      runs: string | null;
      results: string | null;
    }>>`
      select
        to_regclass('public.compliance_check_runs')::text as runs,
        to_regclass('public.compliance_check_results')::text as results
    `;

    if (!tables[0]?.runs || !tables[0]?.results) {
      return {
        ok: false,
        status: "FAILED",
        detail: "La migración de compliance reporting todavía no está aplicada."
      };
    }

    const [run] = await sql<Array<{ id: string }>>`
      insert into compliance_check_runs (
        subject_ref,
        reporting_month,
        status
      ) values (
        ${subjectRef},
        ${reportingMonth ?? null},
        'RUNNING'
      )
      returning id
    `;

    const gates = await evaluateComplianceReadiness();
    const blocking = gates.filter(
      (gate) => gate.status === "BLOCKED" || gate.status === "NOT_CONNECTED"
    );
    const review = gates.filter((gate) => gate.status === "REVIEW_REQUIRED");

    const status: "PASS" | "HOLD" =
      blocking.length === 0 && review.length === 0 ? "PASS" : "HOLD";

    for (const gate of gates) {
      await sql`
        insert into compliance_check_results (
          run_id,
          gate_id,
          status,
          blocking,
          detail,
          evidence_count
        ) values (
          ${run.id},
          ${gate.id},
          ${gate.status},
          ${gate.blocking},
          ${gate.detail},
          ${gate.evidenceCount}
        )
      `;
    }

    const summary = {
      gates: gates.length,
      ready: gates.filter((gate) => gate.status === "READY" || gate.status === "LIVE").length,
      reviewRequired: review.length,
      blocking: blocking.length
    };

    await sql`
      update compliance_check_runs
      set
        status = ${status},
        finished_at = now(),
        summary = ${sql.json(summary)}
      where id = ${run.id}
    `;

    return {
      ok: true,
      runId: run.id,
      status,
      detail:
        status === "PASS"
          ? "Pre-check de compliance completado sin gates pendientes."
          : "Pre-check completado con gates pendientes o no conectados."
    };
  } catch (error) {
    return {
      ok: false,
      status: "FAILED",
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

export async function getLatestComplianceRun(
  subjectRef = "recycla-os"
): Promise<ComplianceRunSummary | null> {
  if (!hasDatabase()) return null;

  try {
    const sql = db();
    const table = await sql<Array<{ runs: string | null }>>`
      select to_regclass('public.compliance_check_runs')::text as runs
    `;
    if (!table[0]?.runs) return null;

    const rows = await sql<ComplianceRunSummary[]>`
      select
        id,
        subject_ref as "subjectRef",
        reporting_month::text as "reportingMonth",
        status,
        started_at::text as "startedAt",
        finished_at::text as "finishedAt",
        summary
      from compliance_check_runs
      where subject_ref = ${subjectRef}
      order by started_at desc
      limit 1
    `;

    return rows[0] ?? null;
  } catch {
    return null;
  }
}
