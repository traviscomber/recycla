import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";

const findings = [
  { id: "AUD-001", severity: "critical", type: "Evidencia", entity: "VAL-551", affected: 18240, detail: "Valorización sin certificado final." },
  { id: "AUD-002", severity: "warning", type: "Mass balance", entity: "LOT-2291", affected: 7310, detail: "Entrada y salidas del lote no reconcilian dentro del umbral esperado." },
  { id: "AUD-003", severity: "warning", type: "Pesaje", entity: "PES-1938", affected: 3120, detail: "Diferencia entre peso declarado y peso de recepción." },
  { id: "AUD-004", severity: "info", type: "Clasificación", entity: "RCL-4799", affected: 890, detail: "Categoría REP aún no confirmada." }
];

const checks = [
  ["Doble imputación", "PASS", "ok"],
  ["Gestor / destino", "PASS", "ok"],
  ["Cadena de custodia", "PASS", "ok"],
  ["Mass balance", "2 observaciones", "warning"],
  ["Evidencia documental", "1 crítica", "critical"],
  ["Clasificación REP", "1 pendiente", "warning"]
] as const;

export default function AuditPage() {
  return (
    <AppShell active="/audit">
      <header className="topbar">
        <div>
          <p className="eyebrow">Control previo</p>
          <h1>Audit Room</h1>
          <p className="muted">Encuentra inconsistencias antes de cerrar el período y preparar el reporte.</p>
        </div>
        <div className="period"><span>Hallazgos abiertos</span><strong>{findings.length}</strong></div>
      </header>

      <section className="decisionStrip auditDecisionStrip" aria-label="Resumen de auditoría">
        <article><span>Críticos</span><strong className="negative">1</strong><p>Bloquea acreditación</p></article>
        <article><span>Advertencias</span><strong>2</strong><p>Requieren reconciliación</p></article>
        <article><span>Pendientes</span><strong>1</strong><p>Clasificación por confirmar</p></article>
      </section>

      <section className="auditSummary">
        {checks.map(([label, value, state]) => (
          <article className={`stream auditCheck auditCheck-${state}`} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div><p className="eyebrow">Hallazgos</p><h3>Qué bloquea o debilita la acreditación</h3></div>
          <button>Ejecutar auditoría</button>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr><th>ID</th><th>Severidad</th><th>Tipo</th><th>Entidad</th><th>Cantidad</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.id}</strong></td>
                  <td><span className={`auditTag audit-${f.severity}`}>{f.severity}</span></td>
                  <td>{f.type}</td>
                  <td>{f.entity}</td>
                  <td>{fmt(f.affected)} kg</td>
                  <td>{f.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Audit principle</p>
        <h3>Una inconsistencia se resuelve; no se oculta.</h3>
        <p className="muted">
          Cada resolución debe conservar el hallazgo original y la trazabilidad de la
          entrada del ledger afectada.
        </p>
      </section>
    </AppShell>
  );
}
