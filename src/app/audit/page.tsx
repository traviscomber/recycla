import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";

const findings = [
  { id: "AUD-001", severity: "critical", type: "Evidencia", entity: "VAL-551", affected: 18240, detail: "Valorización sin certificado final." },
  { id: "AUD-002", severity: "warning", type: "Mass balance", entity: "LOT-2291", affected: 7310, detail: "Entrada y salidas del lote no reconcilian dentro del umbral esperado." },
  { id: "AUD-003", severity: "warning", type: "Pesaje", entity: "PES-1938", affected: 3120, detail: "Diferencia entre peso declarado y peso de recepción." },
  { id: "AUD-004", severity: "info", type: "Clasificación", entity: "RCL-4799", affected: 890, detail: "Categoría REP aún no confirmada." }
];

const checks = [
  ["Doble imputación", "PASS"],
  ["Gestor / destino", "PASS"],
  ["Cadena de custodia", "PASS"],
  ["Mass balance", "2 observaciones"],
  ["Evidencia documental", "1 crítica"],
  ["Clasificación REP", "1 pendiente"]
];

export default function AuditPage() {
  return (
    <AppShell active="/audit">
      <header className="topbar">
        <div>
          <p className="eyebrow">Pre-fiscalización</p>
          <h1>Audit Room</h1>
          <p className="muted">Detecta inconsistencias antes de convertir operación física en cumplimiento reportable.</p>
        </div>
        <div className="period"><span>Hallazgos abiertos</span><strong>{findings.length}</strong></div>
      </header>

      <section className="auditSummary">
        {checks.map(([label, value]) => (
          <article className="stream" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Hallazgos</p>
            <h3>Qué bloquea o debilita la acreditación</h3>
          </div>
          <button>Ejecutar auditoría</button>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>ID</th><th>Severidad</th><th>Tipo</th><th>Entidad</th><th>Cantidad</th><th>Detalle</th>
              </tr>
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
        <h3>El sistema no “arregla” silenciosamente una inconsistencia.</h3>
        <p className="muted">
          Cada corrección conserva el hallazgo, la resolución, quién la realizó y qué entrada
          del ledger fue reemplazada o suspendida.
        </p>
      </section>
    </AppShell>
  );
}
