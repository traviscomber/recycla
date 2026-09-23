import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";

const entries = [
  { id: "REP-000184", date: "2027-04-02", client: "Cliente piloto Recycla", stream: "AEE / RAEE", source: "Retiro RCL-4821", kg: 8420, state: "Acreditable", evidence: "Completa" },
  { id: "REP-000183", date: "2027-04-02", client: "Cliente piloto Recycla", stream: "AEE / RAEE", source: "Lote LOT-2318", kg: 3120, state: "Revisión", evidence: "Diferencia peso" },
  { id: "REP-000182", date: "2027-04-01", client: "Industria Norte", stream: "Neumáticos", source: "Retiro RCL-4819", kg: 12880, state: "Acreditable", evidence: "Completa" },
  { id: "REP-000181", date: "2027-04-01", client: "Operador Industrial Sur", stream: "Aceites lubricantes", source: "Retiro RCL-4818", kg: 9620, state: "Elegible", evidence: "Certificado pendiente" }
];

export default function LedgerPage() {
  return (
    <AppShell active="/ledger" dataMode="demo">
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
            <span>Recolectado</span><span>Procesado</span><span>Valorizado</span>
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
          <button>Exportar período</button>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>ID</th><th>Fecha</th><th>Cliente</th><th>Producto</th>
                <th>Origen</th><th>Cantidad</th><th>Estado</th><th>Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.id}</strong></td>
                  <td>{e.date}</td>
                  <td>{e.client}</td>
                  <td>{e.stream}</td>
                  <td>{e.source}</td>
                  <td>{fmt(e.kg)} kg</td>
                  <td><span className="status">{e.state}</span></td>
                  <td>{e.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Regla de integridad</p>
        <h3>Physical record → REP state → rule version → evidence set → accreditation</h3>
        <p className="muted">El ledger no borra historia. Una corrección genera una nueva transición o suspensión, nunca reescribe silenciosamente el pasado.</p>
      </section>
    </AppShell>
  );
}
