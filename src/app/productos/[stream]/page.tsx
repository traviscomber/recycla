import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStreamAdapter, streamAdapters } from "@/lib/streams";

export function generateStaticParams() {
  return streamAdapters.map((stream) => ({ stream: stream.slug }));
}

export default async function StreamPage({
  params
}: {
  params: Promise<{ stream: string }>;
}) {
  const { stream } = await params;
  const adapter = getStreamAdapter(stream);

  if (!adapter) notFound();

  return (
    <AppShell active="">
      <header className="topbar">
        <div>
          <p className="eyebrow">Perfil de trazabilidad REP</p>
          <h1>{adapter.label}</h1>
          <p className="muted">{adapter.subtitle}</p>
        </div>
        <div className="period">
          <span>Unidad principal</span>
          <strong>{adapter.primaryUnit}</strong>
        </div>
      </header>

      <nav className="productSwitcher" aria-label="Productos prioritarios">
        {streamAdapters.map((item, index) => (
          <Link
            key={item.id}
            href={`/productos/${item.slug}`}
            className={item.id === adapter.id ? "active" : ""}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{item.label}</strong>
          </Link>
        ))}
      </nav>

      <section className="adapterHero">
        <article className="card dark">
          <span className="label">Regla de acreditación</span>
          <h2>{adapter.readinessRule}</h2>
        </article>
        <article className="card balanceCard">
          <span className="label">Balance físico</span>
          <h3>{adapter.massBalance}</h3>
          <p>La reconciliación física debe poder explicarse antes de pasar al estado regulatorio siguiente.</p>
        </article>
      </section>

      <section className="adapterGrid">
        <article className="panel">
          <p className="eyebrow">01 · Captura</p>
          <h3>Qué debemos conocer al recibir el residuo</h3>
          <div className="checkList indexedList">
            {adapter.intakeIdentity.map((item, index) => (
              <span key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</span>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">02 · Evidencia</p>
          <h3>Qué debe existir antes de acreditar</h3>
          <div className="checkList indexedList">
            {adapter.mandatoryEvidence.map((item, index) => (
              <span key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">03 · Auditoría</p>
            <h3>Validaciones específicas para {adapter.label}</h3>
          </div>
          <Link className="buttonLink" href="/audit">Abrir Audit Room →</Link>
        </div>
        <div className="auditCards">
          {adapter.auditChecks.map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="coreFlow" aria-label="Flujo compartido REP">
        <div>
          <p className="eyebrow">Shared REP Core</p>
          <h3>El producto cambia la captura. El ledger mantiene un único lenguaje.</h3>
        </div>
        <ol>
          <li>Recolectado</li>
          <li>Procesado</li>
          <li>Valorizado</li>
          <li>Elegible</li>
          <li>Evidencia completa</li>
          <li>Acreditable</li>
        </ol>
      </section>
    </AppShell>
  );
}
