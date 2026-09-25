import { AppShell } from "@/components/app-shell";
import { repRegulatoryUniverse } from "@/lib/rep";
import { repRegulatoryMilestones, repRulePacks } from "@/lib/rep-rule-packs";

export default function RegulatoryRadarPage() {
  const operationalProducts = repRegulatoryUniverse.filter((item) => item.operational);
  const monitoredProducts = repRegulatoryUniverse.filter((item) => !item.operational);
  const operational = operationalProducts.length;
  const radarOnly = monitoredProducts.length;
  const rulePacks = Object.values(repRulePacks);
  const enforceablePacks = rulePacks.filter((item) => item.enginePolicy === "APPLY");

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
          <p>Total visible entre operación y monitoreo</p>
        </article>
        <article>
          <span>Productos operacionales</span>
          <strong>{operational}</strong>
          <p>Con flujo activo dentro de Recycla</p>
        </article>
        <article>
          <span>Sólo monitoreo</span>
          <strong>{radarOnly}</strong>
          <p>Observados sin ampliar el alcance operativo</p>
        </article>
      </section>

      <section className="decisionStrip" aria-label="Aplicabilidad regulatoria">
        <article>
          <span>Rule packs</span>
          <strong>{rulePacks.length}</strong>
          <p>Versionados por producto prioritario</p>
        </article>
        <article>
          <span>Aplicables al motor</span>
          <strong>{enforceablePacks.length}</strong>
          <p>Sólo normas vigentes y verificadas</p>
        </article>
        <article>
          <span>Monitoreo regulatorio</span>
          <strong>{rulePacks.length - enforceablePacks.length}</strong>
          <p>No alteran cálculos automáticos</p>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Calendario regulatorio</p>
            <h3>Hitos oficiales sin inventar fechas.</h3>
          </div>
          <b>{repRegulatoryMilestones.length}</b>
        </div>
        <div className="regulatoryMatrix">
          {repRegulatoryMilestones.map((item, index) => (
            <article className="regulatoryRow operational" key={item.id}>
              <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="regProduct">
                <strong>{item.title}</strong>
                <span>{item.status === "SCHEDULED" ? "PROGRAMADO" : "FECHA PENDIENTE"}</span>
              </div>
              <div className="regStage">
                <span>Ventana oficial</span>
                <strong>{item.windowLabel}</strong>
              </div>
              <div className="regMilestone">
                <span>Motor</span>
                <strong>{item.status === "SCHEDULED" ? "CALENDARIZABLE" : "NO HARDcode"}</strong>
              </div>
              <p>{item.sourceTitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Operativo ahora</p>
            <h3>Productos que forman parte del flujo actual</h3>
          </div>
          <b>{operationalProducts.length}</b>
        </div>
        <div className="regulatoryMatrix">
          {operationalProducts.map((item, index) => (
            <article className="regulatoryRow operational" key={item.id}>
              <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="regProduct">
                <strong>{item.label}</strong>
                <span>OPERACIONAL</span>
              </div>
              <div className="regStage">
                <span>Etapa</span>
                <strong>{item.stage}</strong>
              </div>
              <div className="regMilestone">
                <span>Próximo hito</span>
                <strong>{item.milestone}</strong>
              </div>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <details className="secondaryDetail">
        <summary>Ver productos en monitoreo ({monitoredProducts.length})</summary>
        <section className="regulatoryMatrix">
          {monitoredProducts.map((item, index) => (
            <article className="regulatoryRow radarOnly" key={item.id}>
              <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="regProduct">
                <strong>{item.label}</strong>
                <span>MONITOREO</span>
              </div>
              <div className="regStage">
                <span>Etapa</span>
                <strong>{item.stage}</strong>
              </div>
              <div className="regMilestone">
                <span>Hito observado</span>
                <strong>{item.milestone}</strong>
              </div>
              <p>{item.note}</p>
            </article>
          ))}
        </section>
      </details>

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
