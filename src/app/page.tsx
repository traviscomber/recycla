import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { fmt, priorityStreams } from "@/lib/rep";
import { getRepDatabaseStatus, listRepClients } from "@/lib/rep-repository";
import { listComplianceFindings } from "@/lib/compliance-findings";
import { getStateSyncOverview } from "@/lib/state-ingestion";
import { listRecentSnapshots } from "@/lib/state-snapshots";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stateSyncs, stateSnapshots, databaseStatus, clients, complianceFindings] = await Promise.all([
    getStateSyncOverview(),
    listRecentSnapshots(100),
    getRepDatabaseStatus(),
    listRepClients(),
    listComplianceFindings("recycla-os", 100)
  ]);

  const priorityProducerSync = stateSyncs.find(
    (sync) => sync.sourceId === "retc-priority-products"
  );
  const actorSnapshots = stateSnapshots.filter((snapshot) =>
    snapshot.subjectType.startsWith("rep_actor_")
  );
  const reviewRequiredSnapshots = actorSnapshots.filter(
    (snapshot) => snapshot.status === "REVIEW_REQUIRED"
  );

  const obligations = clients.flatMap((client) => client.obligations);
  const totals = obligations.reduce(
    (acc, item) => ({
      obligation: acc.obligation + item.obligation,
      collected: acc.collected + item.collected,
      valued: acc.valued + item.valued,
      eligible: acc.eligible + item.eligible,
      evidenceComplete: acc.evidenceComplete + item.evidenceComplete,
      accreditable: acc.accreditable + item.accreditable
    }),
    {
      obligation: 0,
      collected: 0,
      valued: 0,
      eligible: 0,
      evidenceComplete: 0,
      accreditable: 0
    }
  );

  const hasOperationalData = totals.obligation > 0 || obligations.length > 0;
  const readiness = totals.obligation > 0
    ? Math.min(100, (totals.accreditable / totals.obligation) * 100)
    : null;
  const gap = totals.accreditable - totals.obligation;
  const evidenceGap = Math.max(0, totals.eligible - totals.evidenceComplete);

  const stages = [
    ["Recolectado", totals.collected],
    ["Valorizado", totals.valued],
    ["Elegible REP", totals.eligible],
    ["Evidencia completa", totals.evidenceComplete],
    ["Acreditable", totals.accreditable]
  ] as const;

  const openFindings = complianceFindings.filter((finding) => finding.status === "open");
  const focusClient = clients[0] ?? null;
  const focusObligation = focusClient?.obligations.reduce(
    (sum, item) => sum + item.obligation,
    0
  ) ?? 0;
  const focusAccreditable = focusClient?.obligations.reduce(
    (sum, item) => sum + item.accreditable,
    0
  ) ?? 0;
  const focusReadiness = focusObligation > 0
    ? Math.min(100, (focusAccreditable / focusObligation) * 100)
    : null;

  const slugMap = {
    AEE_RAEE: "aee-raee",
    NEUMATICOS: "neumaticos",
    BATERIAS: "baterias",
    PILAS: "pilas",
    ACEITES_LUBRICANTES: "aceites-lubricantes"
  } as const;

  return (
    <AppShell active="/">
      <header className="topbar">
        <div>
          <p className="eyebrow">Operational REP Intelligence</p>
          <h1>REP Control Tower</h1>
          <p className="muted">Qué está acreditable, qué está bloqueado y dónde actuar primero.</p>
        </div>
        <div className="period">
          <span>Clientes REP</span>
          <strong>{clients.length}</strong>
        </div>
      </header>

      {databaseStatus.state !== "ready" ? (
        <section className={`systemNotice notice-${databaseStatus.state}`}>
          <div>
            <p className="eyebrow">Core operacional REP</p>
            <h3>
              {databaseStatus.state === "schema_missing"
                ? "Esquema operativo incompleto"
                : databaseStatus.state === "unavailable"
                  ? "Base operacional temporalmente no disponible"
                  : "Persistencia operacional no configurada"}
            </h3>
            <p>{databaseStatus.detail}</p>
          </div>
          <span>{databaseStatus.state === "schema_missing" ? "ACCIÓN REQUERIDA" : "ESTADO TÉCNICO"}</span>
        </section>
      ) : null}

      <section className="decisionStrip" aria-label="Estado REP principal">
        <article>
          <span>REP Readiness</span>
          <strong>{readiness === null ? "—" : readiness.toFixed(1) + "%"}</strong>
          <p>{readiness === null ? "Sin obligación operacional cargada" : "Sobre cantidad acreditable"}</p>
        </article>
        <article>
          <span>Gap actual</span>
          <strong className={gap < 0 ? "negative" : undefined}>
            {hasOperationalData ? fmt(gap) + " kg" : "—"}
          </strong>
          <p>vs. obligación vigente</p>
        </article>
        <article>
          <span>Evidencia pendiente</span>
          <strong className={evidenceGap > 0 ? "negative" : undefined}>
            {hasOperationalData ? fmt(evidenceGap) + " kg" : "—"}
          </strong>
          <p>Elegible aún sin evidencia completa</p>
        </article>
      </section>

      <section className="streams">
        {priorityStreams.map((stream, i) => (
          <Link
            href={`/productos/${slugMap[stream.id]}`}
            key={stream.id}
            className={i === 0 ? "stream activeStream streamLink" : "stream streamLink"}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{stream.label}</strong>
            <p>{stream.regulatoryMilestone} · {stream.traceability}</p>
          </Link>
        ))}
      </section>

      <section className="panel statePulse">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Official data layer · Live</p>
            <h3>RETC conectado al contexto operativo</h3>
          </div>
          <Link className="buttonLink" href="/state-intelligence">Abrir State Intelligence →</Link>
        </div>
        <div className="decisionStrip statePulseStrip">
          <article>
            <span>Registros productor</span>
            <strong>{priorityProducerSync?.rowCount?.toLocaleString("es-CL") ?? "—"}</strong>
            <p>{priorityProducerSync?.sourceYear ? `Fuente RETC ${priorityProducerSync.sourceYear}` : "Sin sync confirmado"}</p>
          </article>
          <article>
            <span>Snapshots actores</span>
            <strong>{actorSnapshots.length}</strong>
            <p>Evidencia externa persistida</p>
          </article>
          <article>
            <span>Requieren revisión</span>
            <strong>{reviewRequiredSnapshots.length}</strong>
            <p>No equivalen a cumplimiento REP</p>
          </article>
        </div>
      </section>

      <section className="focusBand">
        <article className="focusClient">
          <span className="label">Cobertura operacional</span>
          <h2>{focusClient?.name ?? "Sin cliente REP cargado"}</h2>
          <p>
            {focusClient
              ? `${focusClient.period} · obligación ${fmt(focusObligation)} kg`
              : "La Control Tower se activará con datos operacionales persistidos."}
          </p>
          {focusReadiness !== null ? (
            <div className="progress"><div style={{ width: `${focusReadiness}%` }} /></div>
          ) : null}
        </article>
        <article className="focusAction">
          <span className="label">Qué importa ahora</span>
          <h3>{evidenceGap > 0 ? "Cerrar evidencia antes de aumentar volumen acreditable." : "Mantener reconciliación y evidencia al día."}</h3>
          <p>
            {hasOperationalData
              ? `${fmt(evidenceGap)} kg elegibles todavía no tienen evidencia completa.`
              : "No se muestran cifras operacionales hasta que exista información real en el REP Ledger."}
          </p>
          <Link className="buttonLink" href="/evidence">Abrir Evidence Graph →</Link>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div><p className="eyebrow">REP Ledger</p><h3>Estado regulatorio de la masa física</h3></div>
          <Link className="buttonLink" href="/ledger">Ver lineage</Link>
        </div>
        {hasOperationalData ? (
          <div className="stages">
            {stages.map(([label, value], i) => (
              <div className="stage" key={label}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <strong>{fmt(value)}</strong>
                <p>{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin masa operacional cargada.</strong>
            <p>El REP Ledger mostrará cantidades cuando existan registros reales persistidos.</p>
          </div>
        )}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div><p className="eyebrow">Audit Room</p><h3>Lo que impide acreditar hoy</h3></div>
            <b>{openFindings.length}</b>
          </div>
          {openFindings.length ? (
            openFindings.slice(0, 5).map((finding) => (
              <div className="finding" key={finding.id}>
                <i className={finding.severity} />
                <span>
                  {finding.code.replaceAll("_", " ")}
                  <small>{finding.detail}</small>
                </span>
                <strong>{finding.occurrenceCount}</strong>
              </div>
            ))
          ) : (
            <div className="emptyState compactEmpty">
              <strong>Sin hallazgos abiertos persistidos.</strong>
              <p>Audit Room mostrará únicamente observaciones derivadas de datos reales.</p>
            </div>
          )}
        </article>

        <article className="panel">
          <p className="eyebrow">Evidence Graph</p>
          <h3>Cada número abre su evidencia.</h3>
          <div className="path">
            <span>Retiro</span><span>Pesaje</span><span>Lote</span><span>Valorización</span><span>Certificado</span>
          </div>
          <div className="notReady">
            <span>REPORT READINESS</span>
            <strong>{readiness !== null && readiness >= 100 && openFindings.length === 0 ? "LISTO" : "NO LISTO"}</strong>
            <p>
              {hasOperationalData
                ? "El estado depende de masa acreditable, evidencia y hallazgos persistidos."
                : "Sin datos operacionales no se declara un estado listo."}
            </p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
