import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { hasDatabase } from "@/lib/db";
import { getRepDatabaseStatus, listRepClients } from "@/lib/rep-repository";

export const dynamic = "force-dynamic";

function readiness(item: { obligation: number; accreditable: number }) {
  if (item.obligation <= 0) return 0;
  return Math.min(100, (item.accreditable / item.obligation) * 100);
}

function gap(item: { obligation: number; accreditable: number }) {
  return item.accreditable - item.obligation;
}

function clientStatus(client: { obligations: Array<{ obligation: number; accreditable: number }> }) {
  const values = client.obligations.map(readiness);
  if (values.length > 0 && values.every((value) => value >= 100)) return "Listo";
  if (values.length > 0 && values.every((value) => value >= 95)) return "Casi listo";
  return "Atención";
}

export default async function ClientesPage() {
  const configured = hasDatabase();
  const databaseStatus = await getRepDatabaseStatus();
  const clients = databaseStatus.state === "ready" ? await listRepClients() : [];
  const clientsWithGap = clients.filter((client) => client.obligations.some((item) => gap(item) < 0)).length;
  const activeObligations = clients.reduce((sum, client) => sum + client.obligations.length, 0);
  const products = new Set(clients.flatMap((client) => client.obligations.map((item) => item.stream))).size;

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cartera REP</p>
          <h1>Clientes REP</h1>
          <p className="muted">Quién está listo, quién tiene gap y en qué producto intervenir.</p>
        </div>
        <div className="period"><span>Clientes</span><strong>{clients.length}</strong></div>
      </header>

      {databaseStatus.state !== "ready" ? (
        <section className={`systemNotice notice-${databaseStatus.state}`}>
          <div>
            <p className="eyebrow">Estado de datos</p>
            <h3>{databaseStatus.state === "schema_missing" ? "Base conectada · esquema REP pendiente" : databaseStatus.state === "unavailable" ? "Base temporalmente no disponible" : "Persistencia pendiente"}</h3>
            <p>{databaseStatus.detail}</p>
          </div>
          <span>{configured ? "CONEXIÓN DETECTADA" : "SIN CONEXIÓN"}</span>
        </section>
      ) : null}

      <section className="clientSummary">
        <article className="card"><span className="label">Obligaciones activas</span><div className="big">{activeObligations}</div><p className="muted">Separadas por producto prioritario.</p></article>
        <article className="card"><span className="label">Productos cubiertos</span><div className="big">{products}</div><p className="muted">Calculado desde obligaciones persistidas.</p></article>
        <article className="card risk"><span className="label">Clientes con gap</span><div className="gap">{clientsWithGap}</div><p className="muted">Requieren intervención antes del cierre.</p></article>
      </section>

      <section className="panel">
        <div className="panelHead"><div><p className="eyebrow">Readiness por cliente</p><h3>Consolidado sin mezclar unidades incompatibles.</h3></div></div>
        {clients.length === 0 ? (
          <div className="emptyState"><strong>No hay clientes REP persistidos todavía.</strong><p>Aplica db/schema.sql y carga obligaciones reales desde las fuentes operacionales autorizadas.</p></div>
        ) : (
          <div className="clientCards">
            {clients.map((client) => {
              const status = clientStatus(client);
              return (
                <Link className="clientCard" href={`/clientes/${client.slug}`} key={`${client.rut}-${client.period}`}>
                  <div className="clientCardHead"><div><strong>{client.name}</strong><span>{client.rut} · {client.period}</span></div><span className={`status status-${status.toLowerCase().replace(" ", "-")}`}>{status}</span></div>
                  <div className="productRows">
                    {client.obligations.map((item) => {
                      const pct = readiness(item);
                      const currentGap = gap(item);
                      return (
                        <div className="productRow" key={item.stream}>
                          <div><strong>{item.label}</strong><span>{pct.toFixed(1)}% readiness</span></div>
                          <b className={currentGap < 0 ? "negative" : "positive"}>{currentGap < 0 ? "" : "+"}{Math.round(currentGap).toLocaleString("es-CL")} {item.unit}</b>
                        </div>
                      );
                    })}
                  </div>
                  <div className="clientCardFoot"><span>{client.obligations.length} obligaciones</span><strong>Ver detalle →</strong></div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
