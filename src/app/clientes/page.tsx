import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { hasDatabase } from "@/lib/db";
import { getRepDatabaseStatus, listRepClients } from "@/lib/rep-repository";
import { listClientDirectory } from "@/lib/client-directory";

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

export default async function ClientesPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    stream?: string;
    year?: string;
  }>;
}) {
  const params = await searchParams;
  const configured = hasDatabase();
  const databaseStatus = await getRepDatabaseStatus();
  const clients = databaseStatus.state === "ready" ? await listRepClients() : [];
  const directory = databaseStatus.state === "ready" ? await listClientDirectory() : [];

  const query = params.q?.trim().toLocaleLowerCase("es-CL") ?? "";
  const statusFilter = params.status ?? "all";
  const streamFilter = params.stream ?? "all";
  const yearFilter = params.year ?? "all";

  const years = [...new Set(clients.map((client) => client.period))]
    .sort((a, b) => Number(b) - Number(a));

  const streamOptions = [...new Map(
    clients
      .flatMap((client) => client.obligations)
      .map((item) => [item.stream, item.label] as const)
  ).entries()];

  const filteredDirectory = directory.filter((entry) => {
    if (!query) return true;
    return (
      entry.displayName.toLocaleLowerCase("es-CL").includes(query) ||
      (entry.rut?.toLocaleLowerCase("es-CL").includes(query) ?? false)
    );
  });
  const referenceDirectory = filteredDirectory.filter((entry) => !entry.hasCanonicalOrganization);
  const linkedDirectory = filteredDirectory.filter((entry) => entry.hasCanonicalOrganization);

  const filteredClients = clients.filter((client) => {
    const status = clientStatus(client);
    const matchesQuery =
      !query ||
      client.name.toLocaleLowerCase("es-CL").includes(query) ||
      client.rut.toLocaleLowerCase("es-CL").includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      status.toLocaleLowerCase("es-CL").replaceAll(" ", "-") === statusFilter;

    const matchesStream =
      streamFilter === "all" ||
      client.obligations.some((item) => item.stream === streamFilter);

    const matchesYear = yearFilter === "all" || client.period === yearFilter;

    return matchesQuery && matchesStatus && matchesStream && matchesYear;
  });

  const clientsWithGap = clients.filter((client) =>
    client.obligations.some((item) => gap(item) < 0)
  ).length;
  const activeObligations = clients.reduce((sum, client) => sum + client.obligations.length, 0);
  const products = new Set(
    clients.flatMap((client) => client.obligations.map((item) => item.stream))
  ).size;

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div>
          <p className="eyebrow">Cartera REP</p>
          <h1>Clientes REP</h1>
          <p className="muted">Consulta por cliente, RUT, período, producto prioritario o estado de cierre.</p>
        </div>
        <div className="period">
          <span>Fichas operacionales</span>
          <strong>{filteredClients.length}/{clients.length}</strong>
        </div>
      </header>

      {databaseStatus.state !== "ready" ? (
        <section className={"systemNotice notice-" + databaseStatus.state}>
          <div>
            <p className="eyebrow">Estado de datos</p>
            <h3>
              {databaseStatus.state === "schema_missing"
                ? "Base conectada · esquema REP pendiente"
                : databaseStatus.state === "unavailable"
                  ? "Base temporalmente no disponible"
                  : "Persistencia pendiente"}
            </h3>
            <p>{databaseStatus.detail}</p>
          </div>
          <span>{configured ? "CONEXIÓN DETECTADA" : "SIN CONEXIÓN"}</span>
        </section>
      ) : null}

      <section className="clientSummary">
        <article className="card">
          <span className="label">Obligaciones activas</span>
          <div className="big">{activeObligations}</div>
          <p className="muted">Separadas por producto prioritario.</p>
        </article>
        <article className="card">
          <span className="label">Productos cubiertos</span>
          <div className="big">{products}</div>
          <p className="muted">Calculado desde obligaciones persistidas.</p>
        </article>
        <article className="card risk">
          <span className="label">Clientes con gap</span>
          <div className="gap">{clientsWithGap}</div>
          <p className="muted">Requieren intervención antes del cierre.</p>
        </article>
      </section>

      {clients.length === 0 && directory.length > 0 ? (
        <section className="systemNotice notice-schema_missing">
          <div>
            <p className="eyebrow">Límite de la cartera actual</p>
            <h3>El directorio publicado todavía no es cartera REP operacional.</h3>
            <p>
              Hay {directory.length} referencias publicadas por Recycla, pero aún no existen organizaciones,
              períodos ni obligaciones REP persistidas. Ninguna referencia se cuenta como obligación, volumen
              o estado de cumplimiento.
            </p>
          </div>
          <span>REFERENCIA ≠ OPERACIÓN</span>
        </section>
      ) : null}

      <section className="panel publishedClientDirectory">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Directorio publicado por Recycla</p>
            <h3>Referencias identificadas desde la sección oficial “Nuestros clientes”.</h3>
          </div>
          <span className="workbenchUpdated">
            {referenceDirectory.length} referencia{referenceDirectory.length === 1 ? "" : "s"} · {linkedDirectory.length} vinculada{linkedDirectory.length === 1 ? "" : "s"} al core
          </span>
        </div>

        {filteredDirectory.length ? (
          <div className="publishedClientGrid">
            {filteredDirectory.map((entry) => (
              <article className="publishedClientCard" key={entry.slug}>
                <div>
                  <strong>{entry.displayName}</strong>
                  <span>{entry.rut ?? "RUT aún no incorporado"}</span>
                </div>
                <div>
                  <span className="publishedClientStatus">
                    {entry.hasCanonicalOrganization ? "VINCULADO AL CORE" : "REFERENCIA"}
                  </span>
                  {entry.website ? (
                    <a href={entry.website} target="_blank" rel="noreferrer">Sitio empresa ↗</a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin coincidencias en el directorio publicado.</strong>
            <p>El filtro de nombre/RUT también se aplica a esta capa.</p>
          </div>
        )}

        <p className="ficha360Footnote">
          Este directorio sólo acredita la publicación observada en recycla.cl. Una entrada pasa a la cartera operacional únicamente cuando queda vinculada a una organización canónica con período y obligaciones REP persistidas.
        </p>
      </section>

      <section className="panel clientDirectory">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Directorio consultable</p>
            <h3>Encuentra la ficha correcta sin ambigüedad de período.</h3>
          </div>
          {(query || statusFilter !== "all" || streamFilter !== "all" || yearFilter !== "all") ? (
            <Link className="buttonLink secondary" href="/clientes">Limpiar filtros</Link>
          ) : null}
        </div>

        <form className="clientFilters" method="get">
          <label className="clientSearch">
            <span>Cliente o RUT</span>
            <input name="q" defaultValue={params.q ?? ""} placeholder="Buscar por nombre o RUT" />
          </label>

          <label>
            <span>Período</span>
            <select name="year" defaultValue={yearFilter}>
              <option value="all">Todos</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>

          <label>
            <span>Producto</span>
            <select name="stream" defaultValue={streamFilter}>
              <option value="all">Todos</option>
              {streamOptions.map(([stream, label]) => (
                <option key={stream} value={stream}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Estado</span>
            <select name="status" defaultValue={statusFilter}>
              <option value="all">Todos</option>
              <option value="atención">Atención</option>
              <option value="casi-listo">Casi listo</option>
              <option value="listo">Listo</option>
            </select>
          </label>

          <button type="submit">Consultar</button>
        </form>

        {clients.length === 0 ? (
          <div className="emptyState">
            <strong>No hay clientes REP persistidos todavía.</strong>
            <p>La cartera aparecerá cuando existan organizaciones con obligaciones reales.</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="emptyState compactEmpty">
            <strong>Sin coincidencias para esta consulta.</strong>
            <p>Prueba otro nombre, RUT, período, producto o estado.</p>
          </div>
        ) : (
          <div className="clientCards">
            {filteredClients.map((client) => {
              const status = clientStatus(client);
              return (
                <Link
                  className="clientCard"
                  href={"/clientes/" + client.slug + "?year=" + client.period}
                  key={client.rut + "-" + client.period}
                >
                  <div className="clientCardHead">
                    <div>
                      <strong>{client.name}</strong>
                      <span>{client.rut} · {client.period}</span>
                    </div>
                    <span className={"status status-" + status.toLowerCase().replace(" ", "-")}>{status}</span>
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
                            {currentGap < 0 ? "" : "+"}
                            {Math.round(currentGap).toLocaleString("es-CL")} {item.unit}
                          </b>
                        </div>
                      );
                    })}
                  </div>

                  <div className="clientCardFoot">
                    <span>{client.obligations.length} obligaciones · período {client.period}</span>
                    <strong>Consultar ficha →</strong>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
