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

  return (
    <AppShell active="/circularity">
      <header className="topbar">
        <div>
          <p className="eyebrow">Circularity intelligence</p>
          <h1>Circularity Quality</h1>
          <p className="muted">
            Cumplir una meta REP no dice por sí solo qué tan alta fue la calidad circular del resultado.
          </p>
        </div>
        <div className="period"><span>Clientes con datos</span><strong>{outcomeSets.filter((items) => items.length > 0).length}</strong></div>
      </header>

      <section className="decisionStrip">
        <article>
          <span>Rutas materiales prioritarias</span>
          <strong>{total > 0 ? ((reuseAndRecycle / total) * 100).toFixed(1) + "%" : "—"}</strong>
          <p>Preparación para reutilización + reciclaje</p>
        </article>
        <article>
          <span>Masa en rutas materiales</span>
          <strong>{total > 0 ? fmt(reuseAndRecycle) + " kg" : "—"}</strong>
          <p>Calculado desde outputs de valorización persistidos</p>
        </article>
        <article>
          <span>Disposición</span>
          <strong>{total > 0 ? ((disposal / total) * 100).toFixed(1) + "%" : "—"}</strong>
          <p>Debe explicarse y reducirse cuando sea técnicamente posible</p>
        </article>
      </section>

      <section className="circularityHierarchy">
        {circularityHierarchy.map((level) => (
          <article className={level.id === "PREVENTION" ? "preWaste" : ""} key={level.id}>
            <span>{String(level.priority).padStart(2, "0")}</span>
            <div>
              <strong>{level.label}</strong>
              <p>{level.description}</p>
            </div>
            <b>{level.appliesAfterWasteGeneration ? "OUTCOME" : "PRE-WASTE"}</b>
          </article>
        ))}
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
              <strong>Sin outcomes circulares persistidos.</strong>
              <p>La distribución aparecerá cuando existan outputs de valorización asignados a clientes reales.</p>
            </div>
          )}
        </article>

        <article className="panel">
          <p className="eyebrow">Arquitectura</p>
          <h3>Ruta circular ≠ estado del REP Ledger.</h3>
          <p className="muted">
            Reutilización, reciclaje, valorización energética y disposición son outcomes alternativos
            del material. La interfaz muestra su distribución sin inventar un puntaje regulatorio.
          </p>
          <div className="notReady circularityNote">
            <span>REGLA DE MODELO</span>
            <strong>ORTHOGONAL DIMENSION</strong>
            <p>El ledger conserva estado regulatorio; Circularity Quality clasifica el destino físico.</p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
