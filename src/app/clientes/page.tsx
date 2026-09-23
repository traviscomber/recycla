import { AppShell } from "@/components/app-shell";
import { fmt } from "@/lib/rep";

const clients = [
  {
    name: "Cliente piloto Recycla",
    rut: "76.000.000-0",
    streams: "AEE / RAEE · Baterías",
    obligation: 128000,
    accreditable: 98440,
    readiness: 76.9,
    status: "Atención"
  },
  {
    name: "Industria Norte",
    rut: "77.100.000-1",
    streams: "Neumáticos",
    obligation: 84200,
    accreditable: 79990,
    readiness: 95.0,
    status: "Casi listo"
  },
  {
    name: "Operador Industrial Sur",
    rut: "78.200.000-2",
    streams: "Aceites lubricantes",
    obligation: 61200,
    accreditable: 61200,
    readiness: 100,
    status: "Listo"
  }
];

export default function ClientesPage() {
  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cartera REP</p>
          <h1>Clientes REP</h1>
          <p className="muted">Quién está listo, quién tiene gap y dónde intervenir primero.</p>
        </div>
        <div className="period"><span>Clientes</span><strong>{clients.length}</strong></div>
      </header>

      <section className="clientSummary">
        <article className="card">
          <span className="label">Obligación total</span>
          <div className="big">{fmt(clients.reduce((a, c) => a + c.obligation, 0))} kg</div>
        </article>
        <article className="card">
          <span className="label">Acreditable hoy</span>
          <div className="big">{fmt(clients.reduce((a, c) => a + c.accreditable, 0))} kg</div>
        </article>
        <article className="card risk">
          <span className="label">Gap cartera</span>
          <div className="gap">
            {fmt(clients.reduce((a, c) => a + c.accreditable - c.obligation, 0))} kg
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Readiness por cliente</p>
            <h3>Prioriza la intervención por evidencia y brecha</h3>
          </div>
          <button>Agregar cliente</button>
        </div>

        <div className="tableWrap">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Productos</th>
                <th>Obligación</th>
                <th>Acreditable</th>
                <th>Readiness</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.rut}>
                  <td>
                    <strong>{client.name}</strong>
                    <span>{client.rut}</span>
                  </td>
                  <td>{client.streams}</td>
                  <td>{fmt(client.obligation)} kg</td>
                  <td>{fmt(client.accreditable)} kg</td>
                  <td>
                    <strong>{client.readiness.toFixed(1)}%</strong>
                    <div className="miniProgress">
                      <div style={{ width: `${client.readiness}%` }} />
                    </div>
                  </td>
                  <td><span className={`status status-${client.status.toLowerCase().replace(" ", "-")}`}>{client.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
