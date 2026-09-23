import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { auditFindings, demo, fmt, priorityStreams } from "@/lib/rep";

export default function Home() {
  const readiness = Math.min(100, (demo.accreditable / demo.obligation) * 100);
  const gap = demo.accreditable - demo.obligation;
  const projectedGap = demo.projectedAccreditable - demo.obligation;

  const stages = [
    ["Recolectado", demo.collected],
    ["Procesado", demo.processed],
    ["Valorizado", demo.valued],
    ["Elegible REP", demo.eligible],
    ["Evidencia completa", demo.evidenceComplete],
    ["Acreditable", demo.accreditable]
  ] as const;

  const slugMap = {
    AEE_RAEE: "aee-raee",
    NEUMATICOS: "neumaticos",
    BATERIAS: "baterias",
    PILAS: "pilas",
    ACEITES_LUBRICANTES: "aceites-lubricantes"
  } as const;

  return (
    <AppShell active="/" dataMode="demo">
      <header className="topbar">
        <div>
          <p className="eyebrow">Operational REP Intelligence</p>
          <h1>REP Control Tower</h1>
          <p className="muted">Qué está acreditable, qué está bloqueado y dónde actuar primero.</p>
        </div>
        <div className="period"><span>Período</span><strong>{demo.period}</strong></div>
      </header>

      <section className="decisionStrip" aria-label="Estado REP principal">
        <article>
          <span>REP Readiness</span>
          <strong>{readiness.toFixed(1)}%</strong>
          <p>Sobre cantidad acreditable</p>
        </article>
        <article>
          <span>Gap actual</span>
          <strong className="negative">{fmt(gap)} kg</strong>
          <p>vs. obligación vigente</p>
        </article>
        <article>
          <span>Gap proyectado</span>
          <strong className="negative">{fmt(projectedGap)} kg</strong>
          <p>Si continúa la trayectoria actual</p>
        </article>
      </section>

      <section className="streams">
        {priorityStreams.map((s, i) => (
          <Link
            href={`/productos/${slugMap[s.id]}`}
            key={s.id}
            className={i === 0 ? "stream activeStream streamLink" : "stream streamLink"}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{s.label}</strong>
            <p>{s.regulatoryMilestone} · {s.traceability}</p>
          </Link>
        ))}
      </section>

      <section className="focusBand">
        <article className="focusClient">
          <span className="label">Cliente en foco</span>
          <h2>{demo.client}</h2>
          <p>AEE / RAEE · obligación {fmt(demo.obligation)} kg</p>
          <div className="progress"><div style={{ width: `${readiness}%` }} /></div>
        </article>
        <article className="focusAction">
          <span className="label">Qué importa ahora</span>
          <h3>Cerrar evidencia antes de perseguir más volumen.</h3>
          <p>{fmt(demo.eligible - demo.evidenceComplete)} kg son elegibles pero todavía no tienen evidencia completa.</p>
          <Link className="buttonLink" href="/evidence">Abrir Evidence Graph →</Link>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div><p className="eyebrow">REP Ledger</p><h3>Estado regulatorio de la masa física</h3></div>
          <Link className="buttonLink" href="/ledger">Ver lineage</Link>
        </div>
        <div className="stages">
          {stages.map(([label, value], i) => (
            <div className="stage" key={label}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{fmt(value)}</strong>
              <p>{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div><p className="eyebrow">Audit Room</p><h3>Lo que impide acreditar hoy</h3></div>
            <b>{auditFindings.length}</b>
          </div>
          {auditFindings.map((f) => (
            <div className="finding" key={f.label}>
              <i className={f.severity} />
              <span>{f.label}</span>
              <strong>{fmt(f.kg)} kg</strong>
            </div>
          ))}
        </article>

        <article className="panel">
          <p className="eyebrow">Evidence Graph</p>
          <h3>Cada número abre su evidencia.</h3>
          <div className="path">
            <span>Retiro</span><span>Pesaje</span><span>Lote</span><span>Valorización</span><span>Certificado</span>
          </div>
          <div className="notReady">
            <span>REPORT READINESS</span>
            <strong>NO LISTO</strong>
            <p>Hay operación física que aún no es acreditable.</p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
