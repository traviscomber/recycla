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

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">R</div>
          <div><strong>RECYCLA</strong><span>REP OS</span></div>
        </div>

        <nav>
          <a className="active">Control Tower</a>
          <a>Clientes REP</a>
          <a>REP Ledger</a>
          <a>Evidence Graph</a>
          <a>Audit Room</a>
          <a>Report Readiness</a>
        </nav>

        <div className="scope">
          <span>Alcance MVP</span>
          {priorityStreams.map((s) => <b key={s.id}>{s.label}</b>)}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operational REP Intelligence</p>
            <h1>REP Control Tower</h1>
            <p className="muted">De la operación física a toneladas acreditables y defendibles.</p>
          </div>
          <div className="period"><span>Período</span><strong>{demo.period}</strong></div>
        </header>

        <section className="streams">
          {priorityStreams.map((s, i) => (
            <article key={s.id} className={i === 0 ? "stream activeStream" : "stream"}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{s.label}</strong>
              <p>{s.traceability}</p>
            </article>
          ))}
        </section>

        <section className="heroGrid">
          <article className="card dark">
            <span className="label">Cliente</span>
            <h2>{demo.client}</h2>
            <p>AEE / RAEE · obligación {fmt(demo.obligation)} kg</p>
          </article>

          <article className="card">
            <span className="label">REP Readiness</span>
            <div className="big">{readiness.toFixed(1)}%</div>
            <div className="progress"><div style={{ width: `${readiness}%` }} /></div>
            <p className="muted">Calculado sobre kg acreditables.</p>
          </article>

          <article className="card risk">
            <span className="label">Gap actual</span>
            <div className="gap">{fmt(gap)} kg</div>
            <p className="muted">vs. obligación</p>
            <hr />
            <span className="label">Gap proyectado</span>
            <strong>{fmt(projectedGap)} kg</strong>
          </article>
        </section>

        <section className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">REP Ledger</p>
              <h3>Estado regulatorio de la masa física</h3>
            </div>
            <button>Ver lineage</button>
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
            <h3>Cada número debe abrir su evidencia</h3>
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
      </section>
    </main>
  );
}
