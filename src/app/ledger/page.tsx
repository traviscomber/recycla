import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";
import { listRepLedgerEntries } from "@/lib/rep-repository";

export const dynamic = "force-dynamic";

const streamLabel: Record<string, string> = {
  AEE_RAEE: "AEE / RAEE",
  NEUMATICOS: "Neumáticos",
  BATERIAS: "Baterías",
  PILAS: "Pilas",
  ACEITES_LUBRICANTES: "Aceites lubricantes"
};

export default async function LedgerPage() {
  const entries = await listRepLedgerEntries(100);

  return (
    <AppShell active="/ledger">
      <header className="topbar">
        <div>
          <p className="eyebrow">System of record</p>
          <h1>REP Ledger</h1>
          <p className="muted">Cada movimiento conserva cantidad, estado regulatorio, evidencia y lineage.</p>
        </div>
        <div className="period"><span>Entradas visibles</span><strong>{entries.length}</strong></div>
      </header>

      <section className="ledgerKpis">
        <article className="card dark">
          <span className="label">Principio</span>
          <h2>Una tonelada no se acredita dos veces.</h2>
          <p>Cada imputación mantiene un lineage único hasta la operación física que la originó.</p>
        </article>
        <article className="card">
          <span className="label">Estados</span>
          <div className="stateList">
            <span>Recolectado</span><span>Valorizado</span>
            <span>Elegible</span><span>Evidencia completa</span><span>Acreditable</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Ledger entries</p>
            <h3>Trazabilidad regulatoria por operación</h3>
          </div>
        </div>

        {entries.length ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>ID</th><th>Fecha</th><th>Cliente</th><th>Período</th><th>Producto</th>
                  <th>Origen</th><th>Cantidad</th><th>Estado</th><th>Evidencias</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.id.slice(0, 8)}</strong></td>
                    <td>{new Date(entry.createdAt).toLocaleDateString("es-CL")}</td>
                    <td>{entry.client}</td>
                    <td>{entry.period}</td>
                    <td>{streamLabel[entry.stream] ?? entry.stream}</td>
                    <td>{entry.sourceEntityType} · {entry.sourceEntityId.slice(0, 8)}</td>
                    <td>{fmt(entry.quantity)} {entry.unit}</td>
                    <td><span className="status">{entry.state.replaceAll("_", " ")}</span></td>
                    <td>{entry.evidenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState">
            <strong>Sin entradas operacionales persistidas.</strong>
            <p>El ledger se poblará únicamente desde movimientos reales y sus transiciones regulatorias.</p>
          </div>
        )}
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Regla de integridad</p>
        <h3>Physical record → REP state → rule version → evidence set → accreditation</h3>
        <p className="muted">El ledger no borra historia. Una corrección genera una nueva transición o suspensión, nunca reescribe silenciosamente el pasado.</p>
      </section>
    </AppShell>
  );
}
