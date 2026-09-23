import "server-only";

import { db, hasDatabase } from "@/lib/db";
import { auditScope, type ComplianceGateStatus } from "@/lib/compliance";

export type ComplianceGateResult = {
  id: string;
  label: string;
  status: ComplianceGateStatus;
  blocking: boolean;
  detail: string;
  evidenceCount: number;
};

async function tableExists(name: string) {
  if (!hasDatabase()) return false;
  try {
    const sql = db();
    const rows = await sql<Array<{ exists: string | null }>>`
      select to_regclass(${"public." + name})::text as exists
    `;
    return Boolean(rows[0]?.exists);
  } catch {
    return false;
  }
}

async function tableCount(name: string) {
  if (!hasDatabase()) return 0;
  const sql = db();
  try {
    const rows = (await sql.unsafe(
      `select count(*)::int as count from "${name.replace(/"/g, '""')}"`
    )) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function evaluateComplianceReadiness(): Promise<ComplianceGateResult[]> {
  const exists = Object.fromEntries(
    await Promise.all(
      [
        "rep_rules",
        "rep_obligations",
        "collections",
        "valuation_outputs",
        "valuation_allocations",
        "documents",
        "evidence_links",
        "rep_ledger_entries",
        "audit_findings",
        "market_introductions",
        "waste_management_operations",
        "monthly_rep_reports",
        "external_source_snapshots"
      ].map(async (name) => [name, await tableExists(name)])
    )
  ) as Record<string, boolean>;

  const counts: Record<string, number> = {};
  for (const name of Object.keys(exists)) {
    counts[name] = exists[name] ? await tableCount(name) : 0;
  }

  let latestMonthlyStatus: "DRAFT" | "READY" | "SUBMITTED" | "REOPENED" | null = null;
  let openCriticalFindings = 0;
  if (exists.monthly_rep_reports && counts.monthly_rep_reports > 0) {
    try {
      const sql = db();
      const rows = await sql<Array<{ status: "DRAFT" | "READY" | "SUBMITTED" | "REOPENED" }>>`
        select status
        from monthly_rep_reports
        order by reporting_month desc, version desc
        limit 1
      `;
      latestMonthlyStatus = rows[0]?.status ?? null;
    } catch {
      latestMonthlyStatus = null;
    }
  }

  if (exists.audit_findings) {
    try {
      const sql = db();
      const rows = await sql<Array<{ count: number }>>`
        select count(*)::int as count
        from audit_findings
        where severity = 'critical'
          and status = 'open'
      `;
      openCriticalFindings = rows[0]?.count ?? 0;
    } catch {
      openCriticalFindings = 0;
    }
  }

  const result = new Map<string, ComplianceGateResult>();

  const set = (
    id: string,
    status: ComplianceGateStatus,
    detail: string,
    evidenceCount = 0
  ) => {
    const def = auditScope.find((item) => item.id === id);
    if (!def) return;
    result.set(id, {
      id,
      label: def.label,
      status,
      blocking: status === "BLOCKED" || status === "NOT_CONNECTED",
      detail,
      evidenceCount
    });
  };

  if (exists.rep_rules && exists.rep_ledger_entries) {
    set(
      "classification",
      counts.rep_ledger_entries > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      counts.rep_ledger_entries > 0
        ? "Hay ledger REP disponible; falta ejecutar validación de clasificación contra reglas versionadas."
        : "Las tablas existen, pero todavía no hay entradas REP para auditar.",
      counts.rep_ledger_entries
    );
  } else {
    set("classification", "NOT_CONNECTED", "REP Ledger / reglas todavía no están conectados a la base activa.");
  }

  if (exists.rep_obligations && exists.valuation_allocations) {
    set(
      "equivalence",
      counts.valuation_allocations > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      counts.valuation_allocations > 0
        ? "Existen asignaciones de valorización; falta reconciliar equivalencia producto → residuo."
        : "Las tablas existen, pero no hay asignaciones suficientes para reconciliar equivalencias.",
      counts.valuation_allocations
    );
  } else {
    set("equivalence", "NOT_CONNECTED", "Obligaciones y asignaciones de valorización aún no están conectadas.");
  }

  if (exists.market_introductions) {
    set(
      "market-transactions",
      counts.market_introductions > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      counts.market_introductions > 0
        ? "Hay introducciones al mercado normalizadas; falta reconciliar categorías, consumidor y transacciones con el cierre mensual."
        : "El registro de introducciones al mercado está instalado, pero aún no contiene transacciones reportables.",
      counts.market_introductions
    );
  } else {
    set(
      "market-transactions",
      "NOT_CONNECTED",
      "Falta el registro normalizado de introducción al mercado y transacciones comerciales exigidas para la reconciliación mensual."
    );
  }

  if (exists.waste_management_operations) {
    set(
      "waste-operations",
      counts.waste_management_operations > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      counts.waste_management_operations > 0
        ? "Hay operaciones de gestión normalizadas; falta reconciliar tipo, contraparte, cantidad, costo y respaldo tributario."
        : "El registro de operaciones de gestión está instalado, pero aún no contiene operaciones reportables.",
      counts.waste_management_operations
    );
  } else if (exists.collections && exists.valuation_outputs) {
    const total = counts.collections + counts.valuation_outputs;
    set(
      "waste-operations",
      total > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      total > 0
        ? "Existen operaciones físicas; falta normalizarlas al formato mensual de compliance."
        : "Las tablas operacionales existen, pero todavía no hay datos suficientes para auditar.",
      total
    );
  } else {
    set("waste-operations", "NOT_CONNECTED", "La operación física REP todavía no está conectada a la base activa.");
  }

  if (exists.monthly_rep_reports) {
    const monthlyStatus =
      latestMonthlyStatus === "READY" || latestMonthlyStatus === "SUBMITTED"
        ? "READY"
        : counts.monthly_rep_reports > 0
          ? "REVIEW_REQUIRED"
          : "NOT_CONNECTED";

    set(
      "monthly-reports",
      monthlyStatus,
      latestMonthlyStatus === "SUBMITTED"
        ? "El último cierre mensual está marcado como SUBMITTED."
        : latestMonthlyStatus === "READY"
          ? "El último cierre mensual está marcado como READY para su flujo regulatorio."
          : counts.monthly_rep_reports > 0
            ? "Existe un cierre mensual en borrador o reabierto; requiere reconciliación antes de quedar READY."
            : "El registro mensual está disponible, pero aún no tiene cierres persistidos.",
      counts.monthly_rep_reports
    );
  } else {
    set("monthly-reports", "NOT_CONNECTED", "El registro de cierres mensuales todavía no está instalado.");
  }

  if (exists.documents && exists.evidence_links) {
    const total = counts.documents + counts.evidence_links;
    set(
      "archive",
      total > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      total > 0
        ? "Existe evidencia documental; falta confirmar cobertura e integridad del archivo regulatorio."
        : "Las tablas de evidencia existen, pero aún no hay archivo suficiente para demostrar cobertura.",
      total
    );
  } else {
    set("archive", "NOT_CONNECTED", "Evidence Graph documental todavía no está conectado a la base activa.");
  }

  const preFinal = [
    "classification",
    "equivalence",
    "market-transactions",
    "waste-operations",
    "monthly-reports",
    "archive"
  ].map((id) => result.get(id)?.status);

  const allReady = preFinal.every((status) => status === "READY" || status === "LIVE");
  const finalReady = allReady && openCriticalFindings === 0;
  set(
    "final-report",
    finalReady ? "READY" : "BLOCKED",
    finalReady
      ? "Todos los controles previos están listos y no existen hallazgos críticos abiertos."
      : openCriticalFindings > 0
        ? "El informe final permanece bloqueado por " + openCriticalFindings + " hallazgo(s) crítico(s) abierto(s)."
        : "El informe final permanece bloqueado mientras existan gates no conectados o pendientes.",
    openCriticalFindings
  );

  if (exists.external_source_snapshots) {
    set(
      "external-audit",
      counts.external_source_snapshots > 0 ? "REVIEW_REQUIRED" : "NOT_CONNECTED",
      counts.external_source_snapshots > 0
        ? "Hay evidencia estatal persistida disponible para el pack de auditoría."
        : "State Intelligence está disponible, pero no hay snapshots suficientes para el pack.",
      counts.external_source_snapshots
    );
  } else {
    set("external-audit", "NOT_CONNECTED", "State Snapshot Registry no está disponible.");
  }

  return auditScope.map(
    (def) =>
      result.get(def.id) ?? {
        id: def.id,
        label: def.label,
        status: "NOT_CONNECTED",
        blocking: true,
        detail: "Control no evaluado.",
        evidenceCount: 0
      }
  );
}
