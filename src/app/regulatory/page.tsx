import { AppShell } from "@/components/app-shell";
import { repRegulatoryUniverse } from "@/lib/rep";

export default function RegulatoryRadarPage() {
  const operational = repRegulatoryUniverse.filter((item) => item.operational).length;
  const radarOnly = repRegulatoryUniverse.length - operational;

  return (
    <AppShell active="/regulatory">
      <header className="topbar">
        <div>
          <p className="eyebrow">Normativa</p>
          <h1>Qué productos requieren atención ahora</h1>
          <p className="muted">Distingue lo que ya está operativo de lo que sólo debemos monitorear para anticipar cambios.</p>
        </div>
        <div className="period"><span>Productos monitoreados</span><strong>{repRegulatoryUniverse.length}</strong></div>
      </header>

      <section className="pageGuide">
        <article>
          <span>Qué importa</span>
          <strong>Qué ya está operativo</strong>
          <p>Estos productos tienen reglas y flujo activo dentro de Recycla.</p>
        </article>
        <article>
          <span>Qué observar</span>
          <strong>Qué puede cambiar después</strong>
          <p>El radar mantiene productos fuera del flujo operativo sin perderlos de vista.</p>
        </article>
        <article>
          <span>Cómo usarlo</span>
          <strong>Actuar sólo cuando corresponda</strong>
          <p>Una novedad normativa no se convierte automáticamente en una obligación operacional.</p>
        </article>
      </section>

      <section className="decisionStrip" aria-label="Cobertura regulatoria">
        <article>
          <span>Productos prioritarios</span>
          <strong>{repRegulatoryUniverse.length}</strong>
          <p>Universo REP monitoreado</p>
        </article>
        <article>
          <span>Productos operacionales</span>
          <strong>{operational}</strong>
          <p>Con adapter activo en Recycla OS</p>
        </article>
        <article>
          <span>Sólo monitoreo</span>
          <strong>{radarOnly}</strong>
          <p>Observados sin ampliar el alcance operativo</p>
        </article>
      </section>

      <section className="regulatoryMatrix">
        {repRegulatoryUniverse.map((item, index) => (
          <article className={item.operational ? "regulatoryRow operational" : "regulatoryRow radarOnly"} key={item.id}>
            <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
            <div className="regProduct">
              <strong>{item.label}</strong>
              <span>{item.operational ? "OPERACIONAL" : "MONITOREO"}</span>
            </div>
            <div className="regStage">
              <span>Etapa</span>
              <strong>{item.stage}</strong>
            </div>
            <div className="regMilestone">
              <span>Hito</span>
              <strong>{item.milestone}</strong>
            </div>
            <p>{item.note}</p>
          </article>
        ))}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Regla operacional</p>
          <h3>Cada producto mantiene reglas propias por período.</h3>
          <p className="muted">Una etapa regulatoria no se debe inferir desde la existencia de datos operacionales. El motor debe saber si el producto está en metas vigentes, implementación, elaboración de decreto o solo monitoreo.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Alcance actual</p>
          <h3>Lo monitoreado no entra al flujo hasta que realmente corresponda.</h3>
          <p className="muted">Se mantienen visibles para anticipar cambios sin convertir la operación diaria en un sistema genérico.</p>
        </article>
      </section>
    </AppShell>
  );
}
