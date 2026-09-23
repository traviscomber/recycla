import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listRecentSnapshots } from "@/lib/state-snapshots";

export const dynamic = "force-dynamic";

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

  return (
    <AppShell active="/network">
      <header className="topbar">
        <div>
          <p className="eyebrow">REP operating model</p>
          <h1>REP Network</h1>
          <p className="muted">Material y financiamiento recorren cadenas distintas. Recycla OS debe modelar ambas sin mezclarlas.</p>
        </div>
      </header>

      <section className="networkRoles">
        {roles.map((role, index) => (
          <article key={role.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{role.label}</strong>
            <p>{role.description}</p>
            <Link className="networkVerifyLink" href={role.verifyHref}>
              Verificar fuente oficial →
            </Link>
          </article>
        ))}
      </section>

      <section className="panel networkEvidenceRegistry">
        <div className="panelHead">
          <div>
            <p className="eyebrow">External actor evidence</p>
            <h3>Actores REP contrastados con fuentes oficiales</h3>
          </div>
          <b>{actorSnapshots.length}</b>
        </div>

        {actorSnapshots.length ? (
          <div className="networkEvidenceRows">
            {actorSnapshots.slice(0, 8).map((snapshot) => (
              <article key={snapshot.id}>
                <span className={`snapshotStatus snapshot-${snapshot.status.toLowerCase()}`}>
                  {snapshot.status}
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
            <strong>Sin actores REP con snapshot oficial todavía.</strong>
            <p>Las verificaciones persistidas aparecerán aquí antes de asociarlas a operaciones o relaciones.</p>
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
          <p className="eyebrow">State Intelligence</p>
          <h3>La red REP puede contrastarse con fuentes públicas oficiales.</h3>
          <p>Productores, gestores y destinos pueden buscarse en RETC antes de asociarlos a una operación.</p>
        </div>
        <Link className="buttonLink" href="/state-intelligence">
          Abrir verificación oficial →
        </Link>
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Material system of record</p>
          <h3>La masa física vive en el Material / REP Ledger.</h3>
          <p className="muted">
            Retiros, pesajes, lotes, tratamiento, valorización y evidencia mantienen el lineage físico.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Relationship registry</p>
          <h3>Los actores y contratos viven en otra capa.</h3>
          <p className="muted">
            Productor, SIG y gestor pueden cambiar de relación sin reescribir la historia física de una operación.
          </p>
        </article>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Architecture rule</p>
        <h3>No convertir el flujo financiero en toneladas.</h3>
        <p className="muted">
          Recycla OS relaciona ambos mundos, pero mantiene separación entre material, compliance y relaciones económicas.
        </p>
      </section>
    </AppShell>
  );
}
