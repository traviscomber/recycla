import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";

const blockers = [
  { label: "Certificados pendientes", count: 3, quantity: 18240 },
  { label: "Diferencias de pesaje", count: 2, quantity: 3120 },
  { label: "Clasificación pendiente", count: 1, quantity: 890 }
];

export default function ReportingPage() {
  const blocked = blockers.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppShell active="/reporting">
      <header className="topbar">
        <div>
          <p className="eyebrow">SISREP / RETC preparation</p>
          <h1>Report Readiness</h1>
          <p className="muted">El sistema prepara y valida la información; no reemplaza los portales regulatorios.</p>
        </div>
        <div className="period"><span>Período</span><strong>2027</strong></div>
      </header>

      <section className="heroGrid">
        <article className="card dark">
          <span className="label">Estado</span>
          <h2>NO LISTO</h2>
          <p>Hay cantidades físicamente gestionadas que todavía no son defendibles como cumplimiento.</p>
        </article>
        <article className="card">
          <span className="label">Registros completos</span>
          <div className="big">96,8%</div>
          <p className="muted">Completitud documental y de lineage.</p>
        </article>
        <article className="card risk">
          <span className="label">Cantidad bloqueada</span>
          <div className="gap">{fmt(blocked)} kg</div>
          <p className="muted">Fuera del dataset reportable hasta resolución.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Bloqueadores</p>
            <h3>Qué falta antes del cierre regulatorio</h3>
          </div>
          <button>Generar pre-check</button>
        </div>

        {blockers.map((item) => (
          <div className="finding" key={item.label}>
            <i className="warning" />
            <span>{item.label}<small>{item.count} operaciones</small></span>
            <strong>{fmt(item.quantity)} kg</strong>
          </div>
        ))}
      </section>

      <section className="reportFlow">
        <article className="stream activeStream"><span>01</span><strong>Ledger cerrado</strong><p>Cantidades reconciliadas.</p></article>
        <article className="stream"><span>02</span><strong>Evidencia</strong><p>Documentos completos.</p></article>
        <article className="stream"><span>03</span><strong>Auditoría</strong><p>Sin hallazgos críticos.</p></article>
        <article className="stream"><span>04</span><strong>Dataset</strong><p>Estructura de reporte preparada.</p></article>
        <article className="stream"><span>05</span><strong>Entrega</strong><p>Ready para portal regulatorio.</p></article>
      </section>
    </AppShell>
  );
}
