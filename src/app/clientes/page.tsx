import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { clientStatus, gap, readiness, repClients } from "@/lib/clients";

export default function ClientesPage() {
  const clientsWithGap = repClients.filter((client) =>
    client.obligations.some((item) => gap(item) < 0)
  ).length;

  const activeObligations = repClients.reduce(
    (sum, client) => sum + client.obligations.length,
    0
  );

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cartera REP</p>
          <h1>Clientes REP</h1>
          <p className="muted">Quién está listo, quién tiene gap y en qué producto intervenir.</p>
        </div>
        <div className="period"><span>Clientes</span><strong>{repClients.length}</strong></div>
      </header>

      <section className="clientSummary">
        <article className="card">
          <span className="label">Obligaciones activas</span>
          <div className="big">{activeObligations}</div>
          <p className="muted">Separadas por producto prioritario.</p>
        </article>
        <article className="card">
          <span className="label">Productos cubiertos</span>
          <div className="big">5</div>
          <p className="muted">AEE, neumáticos, baterías, pilas y aceites.</p>
        </article>
        <article className="card risk">
          <span className="label">Clientes con gap</span>
          <div className="gap">{clientsWithGap}</div>
          <p className="muted">Requieren intervención antes del cierre.</p>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Readiness por cliente</p>
            <h3>Consolidado sin mezclar unidades incompatibles.</h3>
          </div>
          <button>Agregar cliente</button>
        </div>

        <div className="clientCards">
          {repClients.map((client) => {
            const status = clientStatus(client);
            return (
              <Link className="clientCard" href={`/clientes/${client.slug}`} key={client.rut}>
                <div className="clientCardHead">
                  <div>
                    <strong>{client.name}</strong>
                    <span>{client.rut}</span>
                  </div>
                  <span className={`status status-${status.toLowerCase().replace(" ", "-")}`}>{status}</span>
                </div>

                <div className="productRows">
                  {client.obligations.map((item) => {
                    const pct = readiness(item);
                    const currentGap = gap(item);
                    return (
                      <div className="productRow" key={item.stream}>
                        <div>
                          <strong>{item.label}</strong>
                          <span>{pct.toFixed(1)}% readiness</span>
                        </div>
                        <b className={currentGap < 0 ? "negative" : "positive"}>
                          {currentGap < 0 ? "" : "+"}{Math.round(currentGap).toLocaleString("es-CL")} {item.unit}
                        </b>
                      </div>
                    );
                  })}
                </div>

                <div className="clientCardFoot">
                  <span>{client.obligations.length} obligaciones</span>
                  <strong>Ver detalle →</strong>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
