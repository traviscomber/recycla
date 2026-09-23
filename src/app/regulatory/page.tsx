import { AppShell } from "@/components/app-shell";
import { repRegulatoryUniverse } from "@/lib/rep";

export default function RegulatoryRadarPage() {
  const operational = repRegulatoryUniverse.filter((item) => item.operational).length;
  const radarOnly = repRegulatoryUniverse.length - operational;

  return (
    <AppShell active="/regulatory">
      <header className="topbar">
        <div>
          <p className="eyebrow">Regulatory intelligence</p>
          <h1>Regulatory Radar</h1>
          <p className="muted">Separar el universo REP del alcance operacional evita tratar todos los productos como si estuvieran en la misma etapa.</p>
        </div>
        <div className="period"><span>Referencia</span><strong>23.09.2026</strong></div>
      </header>

      <section className="decisionStrip" aria-label="Cobertura regulatoria">
        <article>
          <span>Productos prioritarios</span>
          <strong>{repRegulatoryUniverse.length}</strong>
          <p>Universo REP monitoreado</p>
        </article>
        <article>
          <span>Streams operacionales</span>
          <strong>{operational}</strong>
          <p>Con adapter activo en Recycla OS</p>
        </article>
        <article>
          <span>Radar only</span>
          <strong>{radarOnly}</strong>
          <p>Monitoreados sin ampliar el scope operativo</p>
        </article>
      </section>

      <section className="regulatoryMatrix">
        {repRegulatoryUniverse.map((item, index) => (
          <article className={item.operational ? "regulatoryRow operational" : "regulatoryRow radarOnly"} key={item.id}>
            <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
            <div className="regProduct">
              <strong>{item.label}</strong>
              <span>{item.operational ? "OPERACIONAL" : "RADAR"}</span>
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
          <p className="eyebrow">Product rule</p>
          <h3>El sistema debe versionar reglas por producto y por período.</h3>
          <p className="muted">Una etapa regulatoria no se debe inferir desde la existencia de datos operacionales. El motor debe saber si el producto está en metas vigentes, implementación, elaboración de decreto o solo monitoreo.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Scope discipline</p>
          <h3>Textiles y envases permanecen fuera del alcance operacional activo.</h3>
          <p className="muted">Sí deben estar en radar para anticipar cambios sin convertir la interfaz en un ERP REP genérico.</p>
        </article>
      </section>
    </AppShell>
  );
}
