import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";

const blockers = [
  { label: "Certificados pendientes", count: 3, quantity: 18240 },
  { label: "Diferencias de pesaje", count: 2, quantity: 3120 },
  { label: "Clasificación pendiente", count: 1, quantity: 890 }
];

const gates = [
  ["01", "Ledger", "Completo", "done"],
  ["02", "Evidencia", "Pendiente", "blocked"],
  ["03", "Auditoría", "En espera", "next"],
  ["04", "Dataset", "En espera", "next"],
  ["05", "Entrega", "En espera", "next"]
] as const;

export default function ReportingPage() {
  const blocked = blockers.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppShell active="/reporting">
      <header className="topbar">
        <div>
          <p className="eyebrow">Preparación de reporte</p>
          <h1>Report Readiness</h1>
          <p className="muted">Qué está listo, qué está bloqueado y qué falta antes del cierre.</p>
        </div>
        <div className="period"><span>Período</span><strong>2027</strong></div>
      </header>

      <section className="reportHero">
        <article className="reportState">
          <span>ESTADO DE CIERRE</span>
          <strong>NO LISTO</strong>
          <p>La evidencia pendiente mantiene parte de la operación fuera del dataset reportable.</p>
        </article>
        <div className="reportMetrics">
          <article><span>Completitud</span><strong>96,8%</strong><p>Documentos + lineage</p></article>
          <article><span>Bloqueado</span><strong className="negative">{fmt(blocked)} kg</strong><p>Hasta resolución</p></article>
        </div>
      </section>

      <section className="gateRail" aria-label="Gates de preparación">
        {gates.map(([index, label, state, tone]) => (
          <article className={`gate gate-${tone}`} key={index}>
            <span>{index}</span>
            <div><strong>{label}</strong><p>{state}</p></div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div><p className="eyebrow">Bloqueadores</p><h3>Resolver antes de avanzar al siguiente gate</h3></div>
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

      <section className="panel ledgerRule">
        <p className="eyebrow">Reporting boundary</p>
        <h3>Recycla REP OS prepara y valida; el portal regulatorio sigue siendo el destino final.</h3>
        <p className="muted">El objetivo de esta pantalla es evitar que un dataset incompleto llegue al gate de entrega.</p>
      </section>
    </AppShell>
  );
}
