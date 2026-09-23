import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";
import { auditScope, complianceSources } from "@/lib/compliance";
import { listRecentSnapshots } from "@/lib/state-snapshots";

export const dynamic = "force-dynamic";

const findings = [
  { id: "AUD-001", severity: "critical", type: "Evidencia", entity: "VAL-551", affected: 18240, detail: "Valorización sin certificado final.", mode: "DEMO" },
  { id: "AUD-002", severity: "warning", type: "Mass balance", entity: "LOT-2291", affected: 7310, detail: "Entrada y salidas del lote no reconcilian dentro del umbral esperado.", mode: "DEMO" },
  { id: "AUD-003", severity: "warning", type: "Pesaje", entity: "PES-1938", affected: 3120, detail: "Diferencia entre peso declarado y peso de recepción.", mode: "DEMO" },
  { id: "AUD-004", severity: "info", type: "Clasificación", entity: "RCL-4799", affected: 890, detail: "Categoría REP aún no confirmada.", mode: "DEMO" }
];

export default async function AuditPage() {
  const snapshots = await listRecentSnapshots(100);
  const externalActorEvidence = snapshots.filter(
    (snapshot) =>
      snapshot.subjectType.startsWith("rep_actor_") &&
      snapshot.status !== "UNAVAILABLE"
  );
  const reviewRequired = externalActorEvidence.filter(
    (snapshot) => snapshot.status === "REVIEW_REQUIRED"
  );

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

      <section className="decisionStrip auditDecisionStrip" aria-label="Resumen de auditoría">
        <article>
          <span>Hallazgos críticos</span>
          <strong className="negative">1</strong>
          <p>Demo · bloquea acreditación</p>
        </article>
        <article>
          <span>Snapshots oficiales</span>
          <strong>{externalActorEvidence.length}</strong>
          <p>Persistidos en State Intelligence</p>
        </article>
        <article>
          <span>Requieren revisión</span>
          <strong>{reviewRequired.length}</strong>
          <p>No equivalen a cumplimiento</p>
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
          {auditScope.map((item, index) => (
            <article key={item.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.requirement}</p>
                <small>{item.legalBasis}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Hallazgos operacionales</p>
            <h3>Qué bloquea o debilita la acreditación.</h3>
          </div>
          <Link className="buttonLink" href="/reporting">Ver cierre →</Link>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>ID</th><th>Severidad</th><th>Tipo</th><th>Entidad</th><th>Cantidad</th><th>Detalle</th><th>Fuente</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.id}</strong></td>
                  <td><span className={"auditTag audit-" + f.severity}>{f.severity}</span></td>
                  <td>{f.type}</td>
                  <td>{f.entity}</td>
                  <td>{fmt(f.affected)} kg</td>
                  <td>{f.detail}</td>
                  <td><span className="auditTag">{f.mode}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
