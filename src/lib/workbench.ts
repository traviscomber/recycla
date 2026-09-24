import type { ComplianceFinding } from "@/lib/compliance-findings";
import type { PersistedClient } from "@/lib/rep-repository";
import type { StateSnapshotSummary } from "@/lib/state-snapshots";

export type WorkbenchPriority = "critical" | "warning" | "review";

export type WorkbenchItem = {
  id: string;
  priority: WorkbenchPriority;
  category: "REP_GAP" | "EVIDENCE_GAP" | "COMPLIANCE_FINDING" | "STATE_REVIEW";
  title: string;
  detail: string;
  subject: string;
  context: string;
  href: string;
  actionLabel: string;
  sourceAt: string | null;
};

function formatQuantity(value: number, unit: "kg" | "l") {
  return `${new Intl.NumberFormat("es-CL").format(Math.round(value))} ${unit}`;
}

export function buildComplianceWorkbench(args: {
  clients: PersistedClient[];
  findings: ComplianceFinding[];
  snapshots: StateSnapshotSummary[];
}): WorkbenchItem[] {
  const items: WorkbenchItem[] = [];

  for (const client of args.clients) {
    for (const obligation of client.obligations) {
      const accreditationGap = obligation.accreditable - obligation.obligation;
      const evidenceGap = obligation.eligible - obligation.evidenceComplete;

      if (accreditationGap < 0) {
        items.push({
          id: `rep-gap:${client.slug}:${client.period}:${obligation.stream}`,
          priority: "critical",
          category: "REP_GAP",
          title: `${obligation.label}: gap acreditable`,
          detail: `Faltan ${formatQuantity(Math.abs(accreditationGap), obligation.unit)} para cubrir la obligación del período.`,
          subject: client.name,
          context: `${client.period} · ${obligation.label}`,
          href: `/clientes/${client.slug}`,
          actionLabel: "Resolver en cliente",
          sourceAt: null
        });
      }

      if (evidenceGap > 0) {
        items.push({
          id: `evidence-gap:${client.slug}:${client.period}:${obligation.stream}`,
          priority: "warning",
          category: "EVIDENCE_GAP",
          title: `${obligation.label}: evidencia incompleta`,
          detail: `${formatQuantity(evidenceGap, obligation.unit)} elegibles todavía no tienen evidencia completa.`,
          subject: client.name,
          context: `${client.period} · ${obligation.label}`,
          href: "/evidence",
          actionLabel: "Revisar evidencia",
          sourceAt: null
        });
      }
    }
  }

  for (const finding of args.findings.filter((item) => item.status === "open")) {
    items.push({
      id: `finding:${finding.id}`,
      priority: finding.severity === "critical" ? "critical" : "warning",
      category: "COMPLIANCE_FINDING",
      title: finding.code.replaceAll("_", " "),
      detail: finding.detail,
      subject: finding.subjectRef,
      context: finding.reportingMonth,
      href: "/audit",
      actionLabel: "Resolver hallazgo",
      sourceAt: finding.updatedAt
    });
  }

  for (const snapshot of args.snapshots.filter((item) => item.status === "REVIEW_REQUIRED")) {
    items.push({
      id: `state-review:${snapshot.id}`,
      priority: "review",
      category: "STATE_REVIEW",
      title: "Revisión de evidencia oficial",
      detail: "Existe evidencia externa persistida que requiere revisión humana antes de usarla como soporte de una decisión REP.",
      subject: snapshot.subjectLabel ?? snapshot.externalIdentifier ?? "Actor REP",
      context: snapshot.sourceYear ? `Fuente oficial ${snapshot.sourceYear}` : "Fuente oficial",
      href: "/state-intelligence",
      actionLabel: "Revisar fuente",
      sourceAt: snapshot.fetchedAt
    });
  }

  const order: Record<WorkbenchPriority, number> = {
    critical: 0,
    warning: 1,
    review: 2
  };

  return items.sort((a, b) => {
    const priorityDiff = order[a.priority] - order[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const aTime = a.sourceAt ? new Date(a.sourceAt).getTime() : 0;
    const bTime = b.sourceAt ? new Date(b.sourceAt).getTime() : 0;
    return bTime - aTime;
  });
}
