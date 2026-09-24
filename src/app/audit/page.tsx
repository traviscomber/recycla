import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { auditScope, complianceSources } from "@/lib/compliance";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import { getLatestComplianceRun } from "@/lib/compliance-runs";
import { listComplianceFindings } from "@/lib/compliance-findings";
import { listRecentSnapshots } from "@/lib/state-snapshots";
import { listGestorIntelligence } from "@/lib/gestor-intelligence";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const [snapshots, compliance, latestRun, liveFindings, gestorRows] = await Promise.all([
    listRecentSnapshots(100),
    evaluateComplianceReadiness(),
    getLatestComplianceRun("recycla-os"),
    listComplianceFindings("recycla-os", 100),
    listGestorIntelligence("recycla-os", 100)
  ]);
  const externalActorEvidence = snapshots.filter(
    (snapshot) =>
      snapshot.subjectType.startsWith("rep_actor_") &&
      snapshot.status !== "UNAVAILABLE"
  );
  const reviewRequired = externalActorEvidence.filter(
    (snapshot) => snapshot.status === "REVIEW_REQUIRED"
  );
  const gestorVerified = gestorRows.filter((row) => row.status === "VERIFIED_REFERENCE");
  const gestorReview = gestorRows.filter((row) => row.status !== "VERIFIED_REFERENCE");

  return (
    <AppShell active="/audit">
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance assurance</p>
          <h1>Audit Room</h1>
          <p className="muted">
            Probar consistencia, trazabilidad y respaldo antes de que el período llegue al informe de cumplimiento.
          </p>
        </div>
        <div className="period">
          <span>Evidencia externa</span>
          <strong>{externalActorEvidence.length}</strong>
        </div>
      </header>

      <section className="panel auditRunStatus">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Último compliance pre-check</p>
            <h3>{latestRun?.status ?? "SIN EJECUTAR"}</h3>
          </div>
          <Link className="buttonLink" href="/reporting">Ejecutar desde Report Readiness →</Link>
        </div>
        <p className="muted">
          {latestRun?.finishedAt
            ? "Última corrida persistida: " + new Date(latestRun.finishedAt).toLocaleString("es-CL")
            : "Aún no existe una corrida persistida de los gates de compliance."}
        </p>
      </section>

      <section className="decisionStrip auditDecisionStrip" aria-label="Resumen de auditoría">
        <article>
          <span>Hallazgos críticos</span>
          <strong className="negative">{liveFindings.filter((finding) => finding.status === "open" && finding.severity === "critical").length}</strong>
          <p>Live · reconciliación persistida</p>
        </article>
        <article>
          <span>Snapshots oficiales</span>
          <strong>{externalActorEvidence.length}</strong>
          <p>Persistidos en State Intelligence</p>
        </article>
        <article>
          <span>Gestores verificados por referencia</span>
          <strong>{gestorVerified.length}/{gestorRows.length}</strong>
          <p>Match exacto en datasets RETC ingeridos</p>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Alcance regulatorio de auditoría</p>
            <h3>Qué debe poder verificar un auditor sobre los datos REP.</h3>
          </div>
          <a className="buttonLink" href={complianceSources.res2084.url} target="_blank" rel="noreferrer">
            Res. 2084 ↗
          </a>
        </div>

        <div className="auditScopeGrid">
          {auditScope.map((item, index) => {
            const result = compliance.find((gate) => gate.id === item.id);
            return (
              <article key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{item.label}</strong>
                  <p>{result?.detail ?? item.requirement}</p>
                  <small>
                    {item.legalBasis}
                    {result?.evidenceCount ? " · " + result.evidenceCount + " evidencias" : ""}
                  </small>
                </div>
                <b className={"auditGateStatus auditGate-" + (result?.status ?? "NOT_CONNECTED").toLowerCase()}>
                  {(result?.status ?? "NOT_CONNECTED").replaceAll("_", " ")}
                </b>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Hallazgos live · reconciliación</p>
            <h3>Brechas detectadas automáticamente en los datos reportables.</h3>
          </div>
          <b>{liveFindings.filter((finding) => finding.status === "open").length}</b>
        </div>

        {liveFindings.length ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Severidad</th><th>Estado</th><th>Período</th><th>Código</th><th>Detalle</th><th>Casos</th>
                </tr>
              </thead>
              <tbody>
                {liveFindings.map((finding) => (
                  <tr key={finding.id}>
                    <td><span className={"auditTag audit-" + finding.severity}>{finding.severity}</span></td>
                    <td>{finding.status}</td>
                    <td>{finding.reportingMonth}</td>
                    <td><strong>{finding.code}</strong></td>
                    <td>{finding.detail}</td>
                    <td>{finding.occurrenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin hallazgos live persistidos.</strong>
            <p>Ejecuta el compliance pre-check para sincronizar la reconciliación con Audit Room.</p>
          </div>
        )}
      </section>

      <section className="panel auditGestorIntelligence">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Gestor Intelligence · Audit</p>
            <h3>Contrapartes que requieren validación antes de usar su operación como soporte.</h3>
          </div>
          <b>{gestorReview.length}</b>
        </div>

        {gestorRows.length ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Contraparte</th><th>Referencia</th><th>Operaciones</th><th>Estado</th><th>Fuente oficial</th>
                </tr>
              </thead>
              <tbody>
                {gestorRows.slice(0, 20).map((row, index) => (
                  <tr key={(row.counterpartyRef ?? row.counterpartyName ?? "sin-id") + "-" + index}>
                    <td><strong>{row.counterpartyName ?? "Sin nombre"}</strong></td>
                    <td>{row.counterpartyRef ?? "—"}</td>
                    <td>{row.operationCount}</td>
                    <td>{row.status.replaceAll("_", " ")}</td>
                    <td>{row.sourceId ? row.sourceId + (row.sourceYear ? " · " + row.sourceYear : "") : "Sin match oficial"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin contrapartes operacionales persistidas.</strong>
            <p>Este control aparecerá cuando el cierre contenga operaciones de gestión con gestor o destino.</p>
          </div>
        )}

        <p className="muted">
          Un match oficial sirve como evidencia contextual. No reemplaza la revisión de autorización, alcance, vigencia ni demás condiciones aplicables a la operación.
        </p>
      </section>

      <section className="panel auditExternalEvidence">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Official external evidence · Live</p>
            <h3>Snapshots oficiales disponibles para revisión.</h3>
          </div>
          <b>{externalActorEvidence.length}</b>
        </div>

        {externalActorEvidence.length ? (
          <div className="auditExternalRows">
            {externalActorEvidence.slice(0, 10).map((snapshot) => (
              <article key={snapshot.id}>
                <span className={"snapshotStatus snapshot-" + snapshot.status.toLowerCase()}>
                  {snapshot.status}
                </span>
                <div>
                  <strong>{snapshot.subjectLabel ?? snapshot.externalIdentifier ?? "Actor externo"}</strong>
                  <p>
                    {snapshot.sourceId}
                    {snapshot.sourceYear ? " · fuente " + snapshot.sourceYear : ""}
                    {snapshot.externalIdentifier ? " · ID " + snapshot.externalIdentifier : ""}
                  </p>
                </div>
                <time>{new Date(snapshot.fetchedAt).toLocaleString("es-CL")}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin evidencia externa asociada a actores.</strong>
            <p>Las verificaciones persistidas aparecerán aquí sin convertirlas automáticamente en PASS.</p>
          </div>
        )}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Auditor externo</p>
          <h3>Preparar evidencia como si la muestra fuese solicitada mañana.</h3>
          <p className="muted">
            La revisión debe poder reconstruir clasificación, equivalencias, cifras mensuales y transacciones comerciales sin depender de conocimiento informal.
          </p>
          <div className="sourceLinks">
            <a href={complianceSources.law20920.url} target="_blank" rel="noreferrer">Ley 20.920 ↗</a>
            <a href={complianceSources.res2084.url} target="_blank" rel="noreferrer">Res. 2084 ↗</a>
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Archivo regulatorio</p>
          <h3>Seis años de respaldo documental.</h3>
          <p className="muted">
            El diseño de Evidence Graph debe permitir conservar y recuperar la documentación que respalda cada dato reportado durante ese período.
          </p>
        </article>
      </section>

      <section className="externalAuditCheck">
        <div>
          <p className="eyebrow">External verification</p>
          <h3>Gestores y destinos deben poder contrastarse con fuentes oficiales antes del cierre.</h3>
          <p>La coincidencia externa agrega contexto verificable, pero no resuelve por sí sola una observación REP.</p>
        </div>
        <Link className="buttonLink" href="/state-intelligence?kind=hazardous_destination">
          Verificar en RETC →
        </Link>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Audit principle</p>
        <h3>Una inconsistencia se resuelve y queda trazada; nunca se borra del historial.</h3>
        <p className="muted">
          El hallazgo original, su evidencia, la resolución aplicada y el estado final deben quedar vinculados al dato reportado.
        </p>
      </section>
    </AppShell>
  );
}
