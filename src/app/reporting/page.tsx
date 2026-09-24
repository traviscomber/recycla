import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { requireComplianceSession } from "@/lib/auth/server";
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
import { syncComplianceFindings } from "@/lib/compliance-findings";
import {
  generateMonthlyRepDraft,
  getLatestMonthlyRepReport,
  latestReportableMonth
} from "@/lib/monthly-reporting";
import { finalizeMonthlyRepDraft } from "@/lib/monthly-close";
import { reconcileMonthlyReporting } from "@/lib/reporting-reconciliation";
import { reconcileHistoricalYear } from "@/lib/historical-reconciliation";
import { getStateSyncOverview } from "@/lib/state-ingestion";
import { listRecentSnapshots } from "@/lib/state-snapshots";
import { evaluateRepDocumentReadiness } from "@/lib/document-readiness";
import { compareMonthlyMetric, getReportingTrend } from "@/lib/reporting-analytics";

export const dynamic = "force-dynamic";

async function runPrecheckAction() {
  "use server";

  await requireComplianceSession();

  await syncComplianceFindings("recycla-os");
  await runCompliancePrecheck("recycla-os");
  revalidatePath("/reporting");
  revalidatePath("/audit");
}

async function generateMonthlyDraftAction() {
  "use server";

  await requireComplianceSession();

  await generateMonthlyRepDraft("recycla-os");
  revalidatePath("/reporting");
  revalidatePath("/audit");
}

async function finalizeMonthlyDraftAction() {
  "use server";

  await requireComplianceSession();

  const reportingMonth = latestReportableMonth();
  await syncComplianceFindings("recycla-os", reportingMonth);
  await finalizeMonthlyRepDraft("recycla-os", reportingMonth);
  await runCompliancePrecheck("recycla-os", reportingMonth);
  revalidatePath("/reporting");
  revalidatePath("/audit");
}

function gateTone(status: ComplianceGateStatus) {
  if (status === "LIVE" || status === "READY") return "done";
  if (status === "REVIEW_REQUIRED") return "next";
  return "blocked";
}

function comparisonLabel(value: number | null) {
  if (value === null) return "Sin base comparable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(value + "T00:00:00.000Z"))
    .replace(".", "");
}

export default async function ReportingPage() {
  const suggestedMonth = latestReportableMonth();
  const [syncs, snapshots, compliance, latestRun, latestMonthly, reconciliation, historical2025, documentReadiness, reportingTrend] = await Promise.all([
    getStateSyncOverview(),
    listRecentSnapshots(100),
    evaluateComplianceReadiness(),
    getLatestComplianceRun("recycla-os"),
    getLatestMonthlyRepReport("recycla-os"),
    reconcileMonthlyReporting("recycla-os", suggestedMonth),
    reconcileHistoricalYear("recycla-os", 2025),
    evaluateRepDocumentReadiness("recycla-os", suggestedMonth),
    getReportingTrend("recycla-os", suggestedMonth)
  ]);

  const producerSync = syncs.find((sync) => sync.sourceId === "retc-priority-products");
  const actorSnapshots = snapshots.filter((snapshot) =>
    snapshot.subjectType.startsWith("rep_actor_")
  );
  const reviewSnapshots = actorSnapshots.filter(
    (snapshot) => snapshot.status === "REVIEW_REQUIRED"
  );

  const gateStatus = new Map(
    compliance.map((gate) => [gate.id, gate.status])
  );

  const readyCount = auditScope.filter((gate) => {
    const status = gateStatus.get(gate.id);
    return status === "LIVE" || status === "READY";
  }).length;

  const finalGate = compliance.find((gate) => gate.id === "final-report");
  const closureReady = finalGate?.status === "READY";
  const operationalRows =
    Number(reconciliation?.marketRows ?? 0) + Number(reconciliation?.wasteRows ?? 0);
  const reconciliationReady = reconciliation?.status === "READY";
  const openReconciliationIssues = reconciliation?.issues.length ?? 0;
  const monthlyDraftReady = Boolean(latestMonthly);
  const monthlyCloseReady =
    latestMonthly?.reportingMonth === suggestedMonth &&
    (latestMonthly.status === "READY" || latestMonthly.status === "SUBMITTED");
  const precheckPassed = latestRun?.status === "PASS";
  const marketComparison = compareMonthlyMetric(reportingTrend, suggestedMonth, "marketRows");
  const wasteComparison = compareMonthlyMetric(reportingTrend, suggestedMonth, "wasteRows");
  const taxCoverageComparison = compareMonthlyMetric(reportingTrend, suggestedMonth, "wasteTaxDocCoveragePct");
  const documentReadyCount = documentReadiness.filter((item) => item.status === "READY").length;
  const documentReviewCount = documentReadiness.filter((item) => item.status === "REVIEW_REQUIRED").length;
  const complianceGap = auditScope.length - readyCount;
  const documentGap = documentReadiness.length - documentReadyCount;
  const taxCoverageGap =
    taxCoverageComparison.value === null ? null : Math.max(0, 100 - taxCoverageComparison.value);
  const currentOperationalRows = (marketComparison.value ?? 0) + (wasteComparison.value ?? 0);
  const operationalYoY =
    marketComparison.yoyPct === null || wasteComparison.yoyPct === null
      ? null
      : Math.round(((marketComparison.yoyPct + wasteComparison.yoyPct) / 2) * 10) / 10;

  const closeSteps = [
    {
      index: "01",
      label: "Ingresar",
      detail: operationalRows > 0 ? `${operationalRows.toLocaleString("es-CL")} filas operacionales` : "Faltan datos del período",
      state: operationalRows > 0 ? "done" : "pending"
    },
    {
      index: "02",
      label: "Revisar",
      detail: reconciliationReady ? "Reconciliación lista" : operationalRows > 0 ? "Reconciliación pendiente" : "Esperando datos",
      state: reconciliationReady ? "done" : operationalRows > 0 ? "attention" : "pending"
    },
    {
      index: "03",
      label: "Resolver",
      detail:
        openReconciliationIssues === 0 && operationalRows > 0
          ? "Sin observaciones abiertas"
          : openReconciliationIssues > 0
            ? `${openReconciliationIssues} observaciones`
            : "Esperando reconciliación",
      state:
        openReconciliationIssues === 0 && operationalRows > 0
          ? "done"
          : openReconciliationIssues > 0
            ? "attention"
            : "pending"
    },
    {
      index: "04",
      label: "Cerrar",
      detail: monthlyCloseReady
        ? `${latestMonthly?.reportingMonth} · v${latestMonthly?.version} · ${latestMonthly?.status}`
        : monthlyDraftReady
          ? `${latestMonthly?.reportingMonth} · v${latestMonthly?.version} · ${latestMonthly?.status}`
          : "Cierre mensual no generado",
      state: monthlyCloseReady ? "done" : monthlyDraftReady ? "attention" : "pending"
    },
    {
      index: "05",
      label: "Validar",
      detail: precheckPassed
        ? "Pre-check PASS"
        : latestRun
          ? `Pre-check ${latestRun.status}`
          : "Pre-check pendiente",
      state: precheckPassed ? "done" : latestRun ? "attention" : "pending"
    },
    {
      index: "06",
      label: "Pack",
      detail: closureReady ? "Disponible para exportación" : "Bloqueado hasta cierre válido",
      state: closureReady ? "done" : "pending"
    }
  ] as const;

  return (
    <AppShell active="/reporting">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cierre REP</p>
          <h1>Qué falta para cerrar el período</h1>
          <p className="muted">
            Esta pantalla ordena datos, evidencia y revisiones hasta dejar el período listo para reportar.
          </p>
        </div>
        <div className="period">
          <span>Estado de cierre</span>
          <strong>{closureReady ? "LISTO" : "NO LISTO"}</strong>
        </div>
      </header>

      <section className="pageGuide">
        <article>
          <span>Qué ves aquí</span>
          <strong>El avance real del cierre</strong>
          <p>La app reúne datos operacionales, documentos, observaciones y validaciones del período.</p>
        </article>
        <article>
          <span>Qué debes mirar</span>
          <strong>El primer paso pendiente</strong>
          <p>No necesitas interpretar todos los indicadores: sigue el flujo y resuelve el primer paso que no esté listo.</p>
        </article>
        <article>
          <span>Cuándo termina</span>
          <strong>Cuando el estado sea LISTO</strong>
          <p>El pack final sólo se habilita cuando los controles críticos y la reconciliación están cerrados.</p>
        </article>
      </section>

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

      <section className="reportingComparisonGrid" aria-label="Lectura ejecutiva del período">
        <article className="reportingComparisonCard">
          <span>Controles de cierre</span>
          <strong>{readyCount}/{auditScope.length}</strong>
          <div><b>Objetivo {auditScope.length}/{auditScope.length}</b><b>Gap {complianceGap}</b></div>
          <p>Cuántos controles ya están listos y cuántos faltan antes de cerrar.</p>
        </article>
        <article className="reportingComparisonCard">
          <span>Documentación requerida</span>
          <strong>{documentReadyCount}/{documentReadiness.length}</strong>
          <div><b>Objetivo 100%</b><b>Gap {documentGap}</b></div>
          <p>Controles documentales con cobertura suficiente para el período según los controles implementados.</p>
        </article>
        <article className="reportingComparisonCard">
          <span>Respaldo tributario</span>
          <strong>{taxCoverageComparison.value === null ? "—" : taxCoverageComparison.value.toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "%"}</strong>
          <div>
            <b>Objetivo 100%</b>
            <b>Gap {taxCoverageGap === null ? "—" : taxCoverageGap.toLocaleString("es-CL", { maximumFractionDigits: 1 }) + " pp"}</b>
            <b>YoY {comparisonLabel(taxCoverageComparison.yoyPct)}</b>
          </div>
          <p>La referencia histórica aparece sólo cuando existe base comparable válida.</p>
        </article>
        <article className="reportingComparisonCard">
          <span>Registros del período</span>
          <strong>{currentOperationalRows.toLocaleString("es-CL")}</strong>
          <div><b>YoY {comparisonLabel(operationalYoY)}</b></div>
          <p>Registros de introducción al mercado + operaciones de gestión del período reportable.</p>
          <details className="reportingSecondaryComparison">
            <summary>Ver variación mensual</summary>
            <span>Mercado MoM {comparisonLabel(marketComparison.momPct)} · Gestión MoM {comparisonLabel(wasteComparison.momPct)}</span>
          </details>
        </article>
      </section>

      <section className="panel reportingTrendPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Tendencia · 14 meses</p>
            <h3>Primero objetivo y gap; después contexto histórico y tendencia.</h3>
          </div>
          <span className="workbenchUpdated">Base: registros canónicos persistidos</span>
        </div>
        <div className="reportingTrendRows">
          {reportingTrend.map((point) => {
            const maxRows = Math.max(1, ...reportingTrend.map((item) => item.marketRows + item.wasteRows));
            const total = point.marketRows + point.wasteRows;
            return (
              <article key={point.month}>
                <span>{monthLabel(point.month)}</span>
                <div className="reportingTrendTrack">
                  <i style={{ width: `${Math.max(2, (total / maxRows) * 100)}%` }} />
                </div>
                <strong>{total.toLocaleString("es-CL")}</strong>
                <small>{point.marketRows.toLocaleString("es-CL")} mercado · {point.wasteRows.toLocaleString("es-CL")} gestión</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel documentReadinessPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Expediente REP · documentación legal</p>
            <h3>Qué exige respaldar la normativa y qué está realmente cubierto en el período.</h3>
          </div>
          <b>{documentReadyCount}/{documentReadiness.length} READY · {documentReviewCount} revisar</b>
        </div>

        <div className="documentReadinessList">
          {documentReadiness.map((item, index) => (
            <article className={"documentReadinessRow documentReadiness-" + item.status.toLowerCase()} key={item.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div className="documentReadinessBody">
                <div>
                  <strong>{item.label}</strong>
                  <em>{item.class.replaceAll("_", " ")}</em>
                </div>
                <p>{item.legalRequirement}</p>
                <small>{item.legalBasis} · Retención: {item.retention}</small>
                <small>Ejemplos de respaldo: {item.evidenceExamples.join(" · ")}</small>
              </div>
              <div className="documentReadinessState">
                <strong>{item.coveragePct === null ? "—" : item.coveragePct.toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "%"}</strong>
                <span>{item.status.replaceAll("_", " ")}</span>
                <small>{item.detail}</small>
              </div>
            </article>
          ))}
        </div>

        <p className="historicalCaveat">
          La plataforma distingue entre registro exigido, respaldo documental exigido y antecedentes condicionales. “READY” significa cobertura del control implementado, no una declaración jurídica autónoma de cumplimiento.
        </p>
      </section>

      <section className="panel closeWorkflowPanel" aria-label="Flujo de cierre mensual REP">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Tu ruta de cierre</p>
            <h3>Sigue estos pasos en orden. El sistema bloquea lo que todavía no corresponde hacer.</h3>
          </div>
          <Link className="buttonLink" href="/reporting/intake">Cargar datos del período →</Link>
        </div>

        <div className="closeWorkflow">
          {closeSteps.map((step) => (
            <article className={`closeStep closeStep-${step.state}`} key={step.index}>
              <span>{step.index}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
              <b>
                {step.state === "done" ? "LISTO" : step.state === "attention" ? "REVISAR" : "PENDIENTE"}
              </b>
            </article>
          ))}
        </div>
      </section>

      <section className="panel complianceRunPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Validación final</p>
            <h3>Comprueba que no quede ningún bloqueo antes de exportar.</h3>
          </div>
          <form action={runPrecheckAction}>
            <button type="submit">Validar cierre</button>
          </form>
        </div>

        <div className="complianceRunSummary">
          <article>
            <span>Último resultado</span>
            <strong>{latestRun?.status ?? "SIN EJECUTAR"}</strong>
            <p>{latestRun?.finishedAt ? new Date(latestRun.finishedAt).toLocaleString("es-CL") : "Aún no hay corrida persistida"}</p>
          </article>
          <article>
            <span>Bloqueos</span>
            <strong>{Number(latestRun?.summary?.blocking ?? 0)}</strong>
            <p>NOT CONNECTED + BLOCKED</p>
          </article>
          <article>
            <span>Por revisar</span>
            <strong>{Number(latestRun?.summary?.reviewRequired ?? 0)}</strong>
            <p>Controles con evidencia pero sin cierre</p>
          </article>
        </div>
      </section>

      <section className="reportHero">
        <article className="reportState">
          <span>ESTADO FINAL</span>
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
            <span>Gates bloqueantes</span>
            <strong>{Number(latestRun?.summary?.blocking ?? 0)}</strong>
            <p>Estado persistido del último pre-check</p>
          </article>
        </div>
      </section>

      <section className="panel historicalBackfillPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Historical backfill · 2025</p>
            <h3>Reconciliar operación histórica contra el benchmark anual publicado por Recycla.</h3>
          </div>
          <b className={historical2025?.status === "MATCH" ? "positive" : historical2025?.status === "PARTIAL" ? "warningText" : "negative"}>
            {historical2025?.status ?? "SIN REFERENCIA"}
          </b>
        </div>

        <div className="complianceRunSummary">
          <article>
            <span>Referencia pública</span>
            <strong>{historical2025?.referenceTotalTonnes?.toLocaleString("es-CL") ?? "—"} t</strong>
            <p>Reporte de Sostenibilidad Recycla 2025</p>
          </article>
          <article>
            <span>Operación cargada</span>
            <strong>{historical2025?.operationalTotalTonnes?.toLocaleString("es-CL") ?? "0"} t</strong>
            <p>Waste operations normalizadas del año 2025</p>
          </article>
          <article>
            <span>Categorías conciliadas</span>
            <strong>{historical2025?.matchedCategories ?? 0}/9</strong>
            <p>Sin inventar distribución mensual</p>
          </article>
        </div>

        {historical2025 ? (
          <div className="historicalRows">
            {historical2025.categories.map((item) => (
              <article key={item.category}>
                <div>
                  <strong>{item.category}</strong>
                  <p>Referencia: {item.referenceTonnes.toLocaleString("es-CL")} t</p>
                </div>
                <div>
                  <span>Operación</span>
                  <strong>{item.operationalTonnes === null ? "SIN DATOS" : item.operationalTonnes.toLocaleString("es-CL") + " t"}</strong>
                </div>
                <div>
                  <span>Δ</span>
                  <strong>
                    {item.deltaTonnes === null
                      ? "—"
                      : item.deltaTonnes.toLocaleString("es-CL", { maximumFractionDigits: 3 }) + " t"}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <p className="historicalCaveat">
          Esta referencia anual proviene del sitio público de Recycla y sirve para QA/backfill. No reemplaza registros operacionales, respaldos ni reportabilidad REP.
        </p>
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
            <form action={finalizeMonthlyDraftAction}>
              <button
                type="submit"
                disabled={!latestMonthly || !reconciliationReady || openReconciliationIssues > 0 || monthlyCloseReady}
              >
                {monthlyCloseReady ? "Cierre validado" : "Validar cierre mensual"}
              </button>
            </form>
          </div>
        </div>

        <div className="complianceRunSummary">
          <article>
            <span>Mes fuente sugerido</span>
            <strong>{suggestedMonth}</strong>
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

      <section className="panel reconciliationPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Reconciliación del período</p>
            <h3>Datos mínimos que deben cerrar antes de avanzar.</h3>
          </div>
          <b className={reconciliation?.status === "READY" ? "positive" : "negative"}>
            {reconciliation?.status ?? "SIN DATOS"}
          </b>
        </div>

        <div className="complianceRunSummary">
          <article>
            <span>Filas mercado</span>
            <strong>{reconciliation?.marketRows ?? 0}</strong>
            <p>Introducciones / transacciones del período</p>
          </article>
          <article>
            <span>Operaciones gestión</span>
            <strong>{reconciliation?.wasteRows ?? 0}</strong>
            <p>Operaciones físicas normalizadas</p>
          </article>
          <article>
            <span>Observaciones</span>
            <strong>{reconciliation?.issues.length ?? 0}</strong>
            <p>Bloqueantes + revisión requerida</p>
          </article>
        </div>

        {reconciliation?.issues.length ? (
          <div className="reconciliationIssues">
            {reconciliation.issues.map((issue) => (
              <article key={issue.code + issue.detail}>
                <span className={"auditTag audit-" + (issue.severity === "BLOCKING" ? "critical" : "warning")}>
                  {issue.severity}
                </span>
                <div>
                  <strong>{issue.code.replaceAll("_", " ")}</strong>
                  <p>{issue.detail}</p>
                </div>
                <b>{issue.count}</b>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin observaciones del reconciliador.</strong>
            <p>Esto sólo significa que los controles implementados para este período no encontraron brechas.</p>
          </div>
        )}
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
          {reconciliation?.issues.length ? (
            reconciliation.issues.slice(0, 5).map((issue) => (
              <div className="finding" key={issue.code + issue.detail}>
                <i className="warning" />
                <span>
                  {issue.code.replaceAll("_", " ")}
                  <small>{issue.severity} · reconciliación live</small>
                </span>
                <strong>{issue.severity}</strong>
              </div>
            ))
          ) : (
            <div className="emptyState compactEmpty">
              <strong>Sin bloqueadores persistidos para el período.</strong>
              <p>Los bloqueadores aparecerán aquí únicamente desde la reconciliación operacional persistida.</p>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Final compliance pack</p>
              <h3>Paquete de salida defendible.</h3>
            </div>
            <a className="buttonLink secondary" href="/reporting/export">
              Descargar pack JSON →
            </a>
          </div>
          <p className="muted">
            El pack incluye estado de gates, cierre mensual, reconciliación, hallazgos, evidencia, ledger, snapshots oficiales y checksum propio.
          </p>
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
