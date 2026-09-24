import { AppShell } from "@/components/app-shell";
import { circularityHierarchy, routeLabel, type CircularityOutcome } from "@/lib/circularity";
import { fmt } from "@/lib/rep";
import { getClientCircularityOutcomes, listRepClients } from "@/lib/rep-repository";

export const dynamic = "force-dynamic";

export default async function CircularityPage() {
  const clients = await listRepClients();
  const outcomeSets = await Promise.all(
    clients.map((client) => getClientCircularityOutcomes(client.slug, Number(client.period)))
  );

  const byRoute = new Map<CircularityOutcome["route"], number>();
  for (const outcomes of outcomeSets) {
    for (const item of outcomes) {
      byRoute.set(item.route, (byRoute.get(item.route) ?? 0) + item.quantityKg);
    }
  }

  const outcomes: CircularityOutcome[] = Array.from(byRoute.entries()).map(([route, quantityKg]) => ({
    route,
    quantityKg
  }));
  const total = outcomes.reduce((sum, item) => sum + item.quantityKg, 0);
  const reuseAndRecycle = outcomes
    .filter((item) => item.route === "PREPARATION_FOR_REUSE" || item.route === "RECYCLING")
    .reduce((sum, item) => sum + item.quantityKg, 0);
  const disposal = outcomes.find((item) => item.route === "DISPOSAL")?.quantityKg ?? 0;

  if (total === 0) {
    return (
      <AppShell active="/circularity">
        <header className="topbar">
          <div>
            <p className="eyebrow">Circularidad</p>
            <h1>Aún no hay resultados materiales que comparar</h1>
            <p className="muted">
              Esta vista se activa cuando existen valorizaciones reales asignadas a clientes y podemos distinguir reutilización, reciclaje, valorización energética y disposición.
            </p>
          </div>
          <div className="period"><span>Estado</span><strong>SIN DATOS</strong></div>
        </header>

        <section className="pageGuide">
          <article>
            <span>Primero</span>
            <strong>Registrar la valorización</strong>
            <p>La operación debe tener un destino material real y cantidad asociada.</p>
          </article>
          <article>
            <span>Después</span>
            <strong>Comparar la calidad del resultado</strong>
            <p>La app mostrará cuánto terminó en reutilización, reciclaje, otras valorizaciones o disposición.</p>
          </article>
          <article>
            <span>Objetivo</span>
            <strong>Mejorar la ruta material</strong>
            <p>La circularidad complementa el cumplimiento REP; no lo reemplaza.</p>
          </article>
        </section>

        <section className="panel reportingEmptyGate">
          <div>
            <p className="eyebrow">Punto de partida</p>
            <h2>Primero necesitamos resultados de valorización reales.</h2>
            <p className="muted">No mostramos porcentajes vacíos ni un puntaje artificial mientras no exista material clasificado.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell active="/circularity">
      <header className="topbar">
        <div>
          <p className="eyebrow">Circularidad</p>
          <h1>Qué tan bueno fue el destino del material</h1>
          <p className="muted">
            Cumplir REP y lograr un buen destino material son cosas distintas. Aquí medimos el resultado físico.
          </p>
        </div>
        <div className="period"><span>Clientes con datos</span><strong>{outcomeSets.filter((items) => items.length > 0).length}</strong></div>
      </header>

      <section className="decisionStrip">
        <article>
          <span>Reutilización + reciclaje</span>
          <strong>{total > 0 ? ((reuseAndRecycle / total) * 100).toFixed(1) + "%" : "—"}</strong>
          <p>Preparación para reutilización + reciclaje</p>
        </article>
        <article>
          <span>Material en mejores rutas</span>
          <strong>{total > 0 ? fmt(reuseAndRecycle) + " kg" : "—"}</strong>
          <p>Calculado desde resultados de valorización persistidos</p>
        </article>
        <article>
          <span>Material a disposición</span>
          <strong>{total > 0 ? ((disposal / total) * 100).toFixed(1) + "%" : "—"}</strong>
          <p>Debe explicarse y reducirse cuando sea técnicamente posible</p>
        </article>
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Distribución del resultado</p>
              <h3>La valorización deja de ser una sola caja.</h3>
            </div>
          </div>

          {outcomes.length ? (
            <div className="routeRows">
              {outcomes.map((item) => {
                const pct = total > 0 ? (item.quantityKg / total) * 100 : 0;
                return (
                  <div className="routeRow" key={item.route}>
                    <div>
                      <strong>{routeLabel(item.route)}</strong>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="routeBar"><i style={{ width: `${pct}%` }} /></div>
                    <b>{fmt(item.quantityKg)} kg</b>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="emptyState compactEmpty">
              <strong>Sin resultados de circularidad persistidos.</strong>
              <p>La distribución aparecerá cuando existan resultados de valorización asignados a clientes reales.</p>
            </div>
          )}
        </article>

        <article className="panel">
          <p className="eyebrow">Cómo leer esta vista</p>
          <h3>El destino material complementa el estado REP.</h3>
          <p className="muted">
            Reutilización, reciclaje, valorización energética y disposición son destinos alternativos
            del material. La interfaz muestra su distribución sin inventar un puntaje regulatorio.
          </p>
          <div className="notReady circularityNote">
            <span>CRITERIO</span>
            <strong>DIMENSIÓN COMPLEMENTARIA</strong>
            <p>La trazabilidad conserva el estado REP; Circularidad clasifica el destino físico.</p>
          </div>
        </article>
      </section>

      <details className="secondaryDetail">
        <summary>Ver jerarquía de circularidad y criterio técnico</summary>
        <section className="circularityHierarchy">
          {circularityHierarchy.map((level) => (
            <article className={level.id === "PREVENTION" ? "preWaste" : ""} key={level.id}>
              <span>{String(level.priority).padStart(2, "0")}</span>
              <div>
                <strong>{level.label}</strong>
                <p>{level.description}</p>
              </div>
              <b>{level.appliesAfterWasteGeneration ? "RESULTADO" : "PREVENCIÓN"}</b>
            </article>
          ))}
        </section>
      </details>
    </AppShell>
  );
}
