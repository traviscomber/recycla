import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listRecentSnapshots } from "@/lib/state-snapshots";

export const dynamic = "force-dynamic";

function actorStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REVIEW_REQUIRED: "REQUIERE REVISIÓN",
    VERIFIED: "VERIFICADO",
    NOT_FOUND: "SIN COINCIDENCIA",
    UNAVAILABLE: "NO DISPONIBLE"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

const roles = [
  {
    id: "producer",
    label: "Productor / Importador",
    description: "Introduce productos prioritarios al mercado, declara volumen y financia su gestión.",
    verifyHref: "/state-intelligence?kind=producer"
  },
  {
    id: "system",
    label: "Sistema de Gestión",
    description: "Organiza la recolección y valorización y contrata gestores.",
    verifyHref: "/state-intelligence"
  },
  {
    id: "manager",
    label: "Gestor",
    description: "Ejecuta recolección, almacenamiento, transporte, pretratamiento y/o valorización.",
    verifyHref: "/state-intelligence?kind=hazardous_destination"
  },
  {
    id: "consumer",
    label: "Consumidor",
    description: "Recibe el producto y entrega el residuo al circuito de gestión.",
    verifyHref: "/state-intelligence?kind=storage_site"
  }
] as const;

export default async function NetworkPage() {
  const snapshots = await listRecentSnapshots(50);
  const actorSnapshots = snapshots.filter(
    (snapshot) =>
      snapshot.subjectType.startsWith("rep_actor_") &&
      snapshot.status !== "NOT_FOUND" &&
      snapshot.status !== "UNAVAILABLE"
  );
  const actorsVerified = actorSnapshots.filter((snapshot) => snapshot.status === "VERIFIED").length;
  const actorsToReview = actorSnapshots.filter((snapshot) => snapshot.status === "REVIEW_REQUIRED").length;

  return (
    <AppShell active="/network">
      <header className="topbar">
        <div>
          <p className="eyebrow">Red REP</p>
          <h1>Quién participa y qué rol cumple</h1>
          <p className="muted">Ubica productores, sistemas de gestión, gestores y puntos de recepción antes de asociarlos a una operación.</p>
        </div>
        <div className="period"><span>Referencias oficiales</span><strong>{actorSnapshots.length}</strong></div>
      </header>

      <section className="decisionStrip" aria-label="Estado de la red REP">
        <article>
          <span>Verificados</span>
          <strong>{actorsVerified}</strong>
          <p>Actores con referencia oficial confirmada.</p>
        </article>
        <article>
          <span>Por revisar</span>
          <strong>{actorsToReview}</strong>
          <p>Coincidencias que todavía requieren validación humana.</p>
        </article>
        <article>
          <span>Siguiente acción</span>
          <strong>{actorsToReview ? "Revisar" : "Verificar"}</strong>
          <p>{actorsToReview ? "Resuelve primero las identidades pendientes." : "Verifica una contraparte cuando entre a una operación."}</p>
        </article>
      </section>

      <section className="pageGuide">
        <article>
          <span>Qué ves aquí</span>
          <strong>Los actores de la cadena REP</strong>
          <p>Cada actor tiene una responsabilidad distinta y no debe confundirse con otro rol.</p>
        </article>
        <article>
          <span>Qué debes validar</span>
          <strong>Identidad y función</strong>
          <p>Antes de usar una contraparte en una operación, verifica que corresponda al actor correcto.</p>
        </article>
        <article>
          <span>Siguiente paso</span>
          <strong>Contrastar con fuente oficial</strong>
          <p>Usa Fuentes oficiales cuando necesites respaldar identidad o contexto externo.</p>
        </article>
      </section>

      <section className="networkRoles">
        {roles.map((role, index) => (
          <article key={role.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{role.label}</strong>
            <p>{role.description}</p>
            <Link className="networkVerifyLink" href={role.verifyHref}>
              Verificar actor →
            </Link>
          </article>
        ))}
      </section>

      <section className="panel networkEvidenceRegistry">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Actores verificados</p>
            <h3>Contrapartes con contexto oficial disponible</h3>
          </div>
          <b>{actorSnapshots.length}</b>
        </div>

        {actorSnapshots.length ? (
          <div className="networkEvidenceRows">
            {actorSnapshots.slice(0, 8).map((snapshot) => (
              <article key={snapshot.id}>
                <span className={`snapshotStatus snapshot-${snapshot.status.toLowerCase()}`}>
                  {actorStatusLabel(snapshot.status)}
                </span>
                <div>
                  <strong>{snapshot.subjectLabel ?? snapshot.externalIdentifier ?? "Actor sin etiqueta"}</strong>
                  <p>
                    {snapshot.externalIdentifier && snapshot.externalIdentifier !== snapshot.subjectLabel
                      ? `ID oficial: ${snapshot.externalIdentifier} · `
                      : ""}
                    {snapshot.sourceId}
                    {snapshot.sourceYear ? ` · ${snapshot.sourceYear}` : ""}
                  </p>
                </div>
                <time>{new Date(snapshot.fetchedAt).toLocaleDateString("es-CL")}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Aún no hay actores verificados.</strong>
            <p>Cuando una contraparte necesite respaldo externo, verifícala y guarda la referencia oficial.</p>
          </div>
        )}
      </section>

      <section className="networkFlowPanel">
        <div className="flowLane materialLane">
          <div className="flowLaneLabel">
            <span>Flujo material</span>
            <strong>Producto → consumo → residuo → gestión</strong>
          </div>
          <div className="flowNodes">
            <article><span>01</span><strong>Productor</strong></article>
            <i>→</i>
            <article><span>02</span><strong>Consumidor</strong></article>
            <i>→</i>
            <article><span>03</span><strong>Gestor</strong></article>
          </div>
        </div>

        <div className="flowLane financeLane">
          <div className="flowLaneLabel">
            <span>Flujo de financiamiento / coordinación</span>
            <strong>Financia → organiza → contrata</strong>
          </div>
          <div className="flowNodes">
            <article><span>01</span><strong>Productor</strong></article>
            <i>→</i>
            <article><span>02</span><strong>Sistema de Gestión</strong></article>
            <i>→</i>
            <article><span>03</span><strong>Gestor</strong></article>
          </div>
        </div>
      </section>

      <section className="officialVerificationBand">
        <div>
          <p className="eyebrow">Verificación oficial</p>
          <h3>Contrasta una contraparte antes de usarla como respaldo operativo.</h3>
          <p>Productores, gestores y destinos pueden buscarse en RETC antes de asociarlos a una operación.</p>
        </div>
        <Link className="buttonLink" href="/state-intelligence">
          Verificar contraparte →
        </Link>
      </section>

      <details className="secondaryDetail"><summary>Ver modelo técnico de la red</summary><section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Registro material</p>
          <h3>La masa física vive en la trazabilidad operacional.</h3>
          <p className="muted">
            Retiros, pesajes, lotes, tratamiento, valorización y evidencia mantienen el historial físico.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Registro de relaciones</p>
          <h3>Los actores y contratos viven en otra capa.</h3>
          <p className="muted">
            Productor, SIG y gestor pueden cambiar de relación sin reescribir la historia física de una operación.
          </p>
        </article>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Regla de arquitectura</p>
        <h3>No convertir el flujo financiero en toneladas.</h3>
        <p className="muted">
          Recycla OS relaciona ambos mundos, pero mantiene separación entre material, cumplimiento y relaciones económicas.
        </p>
      </section></details>
    </AppShell>
  );
}
