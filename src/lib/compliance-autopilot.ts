import type { ComplianceGateResult } from "@/lib/compliance-engine";
import type { ComplianceFinding } from "@/lib/compliance-findings";
import type { EvidenceChain } from "@/lib/evidence-chain";

export type AutopilotAction = {
  id: string;
  priority: "BLOCKER" | "ACTION" | "REVIEW";
  title: string;
  detail: string;
  affected: number;
  href: string;
  actionLabel: string;
  source: "RECONCILIATION" | "EVIDENCE_CHAIN" | "COMPLIANCE_GATE";
};

const blockerOrder = [
  "Falta pesaje",
  "Sin lote trazable",
  "Sin valorización asignada",
  "Sin evidencia documental",
  "Evidencia sin checksum completo",
  "Ledger aún no acreditable"
] as const;

const blockerConfig: Record<string, { title: string; detail: string; href: string; actionLabel: string }> = {
  "Falta pesaje": {
    title: "Completar pesajes pendientes",
    detail: "Hay retiros físicos que todavía no tienen peso neto trazable.",
    href: "/evidence",
    actionLabel: "Revisar cadenas"
  },
  "Sin lote trazable": {
    title: "Asignar retiros a lotes",
    detail: "Hay material recibido que aún no puede seguirse hasta un lote de proceso.",
    href: "/evidence",
    actionLabel: "Revisar lineage"
  },
  "Sin valorización asignada": {
    title: "Cerrar valorización",
    detail: "Hay cadenas operacionales sin asignación de salida valorizada.",
    href: "/circularity",
    actionLabel: "Revisar valorización"
  },
  "Sin evidencia documental": {
    title: "Completar respaldo documental",
    detail: "Hay operaciones físicas sin documento verificable asociado.",
    href: "/evidence",
    actionLabel: "Completar evidencia"
  },
  "Evidencia sin checksum completo": {
    title: "Cerrar integridad documental",
    detail: "Hay evidencia asociada cuya integridad SHA-256 todavía no está completa.",
    href: "/evidence",
    actionLabel: "Revisar documentos"
  },
  "Ledger aún no acreditable": {
    title: "Resolver transición REP",
    detail: "Hay cadenas técnicamente avanzadas que aún no llegan a estado acreditable en el ledger.",
    href: "/ledger",
    actionLabel: "Revisar ledger"
  }
};

function findingAction(finding: ComplianceFinding): AutopilotAction {
  const critical = finding.severity === "critical";
  return {
    id: "finding:" + finding.id,
    priority: critical ? "BLOCKER" : "ACTION",
    title: finding.code.replaceAll("_", " "),
    detail: finding.detail,
    affected: finding.occurrenceCount,
    href: "/audit",
    actionLabel: "Resolver hallazgo",
    source: "RECONCILIATION"
  };
}

export function buildComplianceAutopilot(args: {
  findings: ComplianceFinding[];
  chains: EvidenceChain[];
  gates: ComplianceGateResult[];
}): AutopilotAction[] {
  const actions: AutopilotAction[] = [];

  for (const finding of args.findings.filter((item) => item.status === "open")) {
    actions.push(findingAction(finding));
  }

  for (const blocker of blockerOrder) {
    const affected = args.chains.filter((chain) => chain.blockers.includes(blocker)).length;
    if (!affected) continue;
    const config = blockerConfig[blocker];
    actions.push({
      id: "chain:" + blocker,
      priority: blocker === "Sin evidencia documental" || blocker === "Ledger aún no acreditable" ? "ACTION" : "REVIEW",
      title: config.title,
      detail: config.detail,
      affected,
      href: config.href,
      actionLabel: config.actionLabel,
      source: "EVIDENCE_CHAIN"
    });
  }

  for (const gate of args.gates.filter((item) => item.status === "BLOCKED" || item.status === "NOT_CONNECTED")) {
    const duplicate = actions.some((action) =>
      action.detail.toLocaleLowerCase("es-CL").includes(gate.label.toLocaleLowerCase("es-CL"))
    );
    if (duplicate) continue;

    actions.push({
      id: "gate:" + gate.id,
      priority: gate.status === "BLOCKED" ? "BLOCKER" : "REVIEW",
      title: gate.label,
      detail: gate.detail,
      affected: gate.evidenceCount,
      href: gate.id === "final-report" ? "/reporting" : "/audit",
      actionLabel: gate.id === "final-report" ? "Abrir cierre" : "Revisar gate",
      source: "COMPLIANCE_GATE"
    });
  }

  const order = { BLOCKER: 0, ACTION: 1, REVIEW: 2 } as const;
  return actions.sort((a, b) => {
    const priority = order[a.priority] - order[b.priority];
    if (priority !== 0) return priority;
    return b.affected - a.affected;
  });
}
