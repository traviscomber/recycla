import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";
import {
  auditScope,
  complianceSources,
  currentDeclarationNotice,
  monthlyReportingRule,
  type ComplianceGateStatus
} from "@/lib/compliance";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import {
  getLatestComplianceRun,
  runCompliancePrecheck
} from "@/lib/compliance-runs";
import {
  generateMonthlyRepDraft,
  getLatestMonthlyRepReport,
  latestReportableMonth
} from "@/lib/monthly-reporting";
import { getStateSyncOverview } from "@/lib/state-ingestion";
import { listRecentSnapshots } from "@/lib/state-snapshots";

export const dynamic = "force-dynamic";

async function runPrecheckAction() {
  "use server";

  await runCompliancePrecheck("recycla-os");
  revalidatePath("/reporting");
  revalidatePath("/audit");
}

async function generateMonthlyDraftAction() {
  "use server";

  await generateMonthlyRepDraft("recycla-os");
  revalidatePath("/reporting");
  revalidatePath("/audit");
}

const blockers = [
  { label: "Certificados pendientes", count: 3, quantity: 18240 },
  { label: "Diferencias de pesaje", count: 2, quantity: 3120 },
  { label: "Clasificación pendiente", count: 1, quantity: 890 }
];

function gateTone(status: ComplianceGateStatus) {
  if (status === "LIVE" || status === "READY") return "done";
  if (status === "REVIEW_REQUIRED") return "next";
  return "blocked";
}

export default async function ReportingPage() {
  const [syncs, snapshots, compliance, latestRun, latestMonthly] = await Promise.all([
    getStateSyncOverview(),
    listRecentSnapshots(100),
    evaluateComplianceReadiness(),
    getLatestComplianceRun("recycla-os"),
    getLatestMonthlyRepReport("recycla-os")
  ]);

  const producerSync = syncs.find((sync) => sync.sourceId === "retc-priority-products");
  const actorSnapshots = snapshots.filter((snapshot) =>
    snapshot.subjectType.startsWith("rep_actor_")
  );
  const reviewSnapshots = actorSnapshots.filter(
    (snapshot) => snapshot.status === "REVIEW_REQUIRED"
  );

  const blocked = blockers.reduce((sum, item) => sum + item.quantity, 0);

  const gateStatus = new Map(
    compliance.map((gate) => [gate.id, gate.status])
  );

  const readyCount = auditScope.filter((gate) => {
    const status = gateStatus.get(gate.id);
    return status === "LIVE" || status === "READY";
  }).length;

  const finalGate = compliance.find((gate) => gate.id === "final-report");
  const closureReady = finalGate?.status === "READY";

  return (
    <AppShell active="/reporting">
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance close</p>
          <h1>Report Readiness</h1>
          <p className="muted">
            Preparar el cierre REP para que dataset, evidencia y auditoría lleguen reconciliados al reporte regulatorio.
          </p>
        </div>
        <div className="period">
          <span>Estado de cierre</span>
          <strong>{closureReady ? "LISTO" : "NO LISTO"}</strong>
        </div>
      </header>

      <section className="complianceNotice">
        <div>
          <p className="eyebrow">Declaración REP {currentDeclarationNotice.year}</p>
          <h3>
            Productos introducidos en {currentDeclarationNotice.reportedYear}: ventana informada para {currentDeclarationNotice.period.toLowerCase()}.
          </h3>
          <p>
            {currentDeclarationNotice.exactDates}. {currentDeclarationNotice.note}
          </p>
        </div>
        <a className="buttonLink" href={complianceSources.declaration2026.url} target="_blank" rel="noreferrer">
          Fuente MMA ↗
        </a>
      </section>

      <section className="panel complianceRunPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Compliance pre-check</p>
            <h3>Persistir el estado real de los gates antes del cierre.</h3>
          </div>
          <form action={runPrecheckAction}>
            <button type="submit">Ejecutar pre-check</button>
          </form>
        </div>

        <div className="complianceRunSummary">
          <article>
            <span>Último resultado</span>
            <strong>{latestRun?.status ?? "SIN EJECUTAR"}</strong>
            <p>{latestRun?.finishedAt ? new Date(latestRun.finishedAt).toLocaleString("es-CL") : "Aún no hay corrida persistida"}</p>
          </article>
          <article>
            <span>Gates bloqueantes</span>
            <strong>{Number(latestRun?.summary?.blocking ?? 0)}</strong>
            <p>NOT CONNECTED + BLOCKED</p>
          </article>
          <article>
            <span>Requieren revisión</span>
            <strong>{Number(latestRun?.summary?.reviewRequired ?? 0)}</strong>
            <p>Controles con evidencia pero sin cierre</p>
          </article>
        </div>
      </section>

      <section className="reportHero">
        <article className="reportState">
          <span>CIERRE REGULATORIO</span>
          <strong>{closureReady ? "LISTO" : "NO LISTO"}</strong>
          <p>
            El cierre sólo cambia a LISTO cuando ledger, evidencia, auditoría y dataset reportable están reconciliados.
          </p>
        </article>
        <div className="reportMetrics">
          <article>
            <span>Registros RETC ingeridos</span>
            <strong>{producerSync?.rowCount?.toLocaleString("es-CL") ?? "—"}</strong>
            <p>{producerSync?.sourceYear ? "Fuente " + producerSync.sourceYear : "Sin sync confirmado"}</p>
          </article>
          <article>
            <span>Evidencia externa</span>
            <strong>{actorSnapshots.length}</strong>
            <p>{reviewSnapshots.length} requieren revisión</p>
          </article>
          <article>
            <span>Escenario demo</span>
            <strong>{fmt(blocked)} kg</strong>
            <p>Referencia visual · no afecta el estado live</p>
          </article>
        </div>
      </section>

      <section className="panel monthlyClosePanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Cierre mensual REP</p>
            <h3>Generar un borrador versionado desde los datos normalizados.</h3>
          </div>
          <div className="panelActions">
            <Link className="buttonLink" href="/reporting/intake">Ingresar datos reales →</Link>
            <form action={generateMonthlyDraftAction}>
              <button type="submit">Generar cierre mensual</button>
            </form>
          </div>
        </div>

        <div className="complianceRunSummary">
          <article>
            <span>Mes fuente sugerido</span>
            <strong>{latestReportableMonth()}</strong>
            <p>Se calcula como mes -2 para la ventana operativa actual.</p>
          </article>
          <article>
            <span>Último cierre</span>
            <strong>{latestMonthly?.status ?? "SIN GENERAR"}</strong>
            <p>
              {latestMonthly
                ? latestMonthly.reportingMonth + " · v" + latestMonthly.version
                : "No existe borrador mensual persistido"}
            </p>
          </article>
          <article>
            <span>Checksum</span>
            <strong>{latestMonthly?.checksumSha256 ? "ACTIVO" : "—"}</strong>
            <p>{latestMonthly?.checksumSha256?.slice(0, 16) ?? "Se genera al persistir"}</p>
          </article>
        </div>
      </section>

      <section className="panel monthlyReportingPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">SISREP · Cadencia operacional</p>
            <h3>El cierre anual se construye mes a mes.</h3>
          </div>
          <a className="buttonLink" href={complianceSources.sisrep.url} target="_blank" rel="noreferrer">
            Instructivo SMA ↗
          </a>
        </div>

        <div className="decisionStrip">
          <article>
            <span>Ventana mensual</span>
            <strong>10 días hábiles</strong>
            <p>{monthlyReportingRule.cadence}</p>
          </article>
          <article>
            <span>Período informado</span>
            <strong>Mes -2</strong>
            <p>{monthlyReportingRule.referencePeriod}</p>
          </article>
          <article>
            <span>Rectificación</span>
            <strong>Permitida</strong>
            <p>{monthlyReportingRule.rectification}</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Compliance gates</p>
            <h3>Qué debe estar defendible antes del informe final.</h3>
          </div>
          <b>{readyCount}/{auditScope.length}</b>
        </div>

        <div className="complianceGateList">
          {auditScope.map((gate, index) => {
            const result = compliance.find((item) => item.id === gate.id);
            const status = result?.status ?? "NOT_CONNECTED";
            return (
              <article className={"complianceGate complianceGate-" + gateTone(status)} key={gate.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{gate.label}</strong>
                  <p>{result?.detail ?? gate.requirement}</p>
                  <small>{gate.legalBasis}{result?.evidenceCount ? " · " + result.evidenceCount + " evidencias" : ""}</small>
                </div>
                <b>{status.replaceAll("_", " ")}</b>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Bloqueadores de cierre</p>
              <h3>No deben llegar al dataset reportable.</h3>
            </div>
            <Link className="buttonLink" href="/audit">Abrir Audit Room →</Link>
          </div>
          {blockers.map((item) => (
            <div className="finding" key={item.label}>
              <i className="warning" />
              <span>{item.label}<small>{item.count} operaciones · demo</small></span>
              <strong>{fmt(item.quantity)} kg</strong>
            </div>
          ))}
        </article>

        <article className="panel">
          <p className="eyebrow">Final compliance pack</p>
          <h3>Paquete de salida defendible.</h3>
          <div className="compliancePack">
            <span>01 Dataset consolidado por categoría / subcategoría</span>
            <span>02 Operaciones de gestión asociadas</span>
            <span>03 Evidencia y documentos de respaldo</span>
            <span>04 Registro de hallazgos y resoluciones</span>
            <span>05 Snapshots de fuentes oficiales</span>
            <span>06 Pack para auditor externo cuando corresponda</span>
          </div>
        </article>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Reporting boundary</p>
        <h3>Recycla REP OS prepara, reconcilia y deja evidencia; SISREP / RETC siguen siendo los canales regulatorios.</h3>
        <p className="muted">
          La Ley 20.920 exige informes de avance o finales a través del RETC y la SMA fiscaliza metas, deberes de información y funcionamiento del sistema de gestión.
        </p>
        <div className="sourceLinks">
          <a href={complianceSources.law20920.url} target="_blank" rel="noreferrer">Ley 20.920 ↗</a>
          <a href={complianceSources.res2084.url} target="_blank" rel="noreferrer">Res. 2084 ↗</a>
          <a href={complianceSources.res2279.url} target="_blank" rel="noreferrer">Res. 2279 ↗</a>
          <a href={complianceSources.annualNfu2025.url} target="_blank" rel="noreferrer">Plantilla SMA · NFU 2025 ↗</a>
          <a href={complianceSources.annualPackaging2025.url} target="_blank" rel="noreferrer">Plantilla SMA · Envases 2025 ↗</a>
        </div>
      </section>
    </AppShell>
  );
}
