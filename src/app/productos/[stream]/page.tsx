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
          <p className="eyebrow">Product-specific REP adapter</p>
          <h1>{adapter.label}</h1>
          <p className="muted">{adapter.subtitle}</p>
        </div>
        <div className="period">
          <span>Unidad principal</span>
          <strong>{adapter.primaryUnit}</strong>
        </div>
      </header>

      <section className="adapterHero">
        <article className="card dark">
          <span className="label">Regla de readiness</span>
          <h2>{adapter.readinessRule}</h2>
        </article>
        <article className="card">
          <span className="label">Mass balance</span>
          <h3>{adapter.massBalance}</h3>
        </article>
      </section>

      <section className="adapterGrid">
        <article className="panel">
          <p className="eyebrow">01 · Intake identity</p>
          <h3>Qué debemos conocer al recibir el residuo</h3>
          <div className="checkList">
            {adapter.intakeIdentity.map((item) => <span key={item}>{item}</span>)}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">02 · Mandatory evidence</p>
          <h3>Qué debe existir antes de acreditar</h3>
          <div className="checkList">
            {adapter.mandatoryEvidence.map((item) => <span key={item}>{item}</span>)}
          </div>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">03 · Audit profile</p>
        <h3>Validaciones específicas para {adapter.label}</h3>
        <div className="auditCards">
          {adapter.auditChecks.map((item, index) => (
            <article key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Shared REP Core</p>
        <h3>El adapter cambia la captura y validación, no el ledger.</h3>
        <p className="muted">
          Todos los productos convergen al mismo estado canónico:
          recolectado → procesado → valorizado → elegible → evidencia completa → acreditable.
        </p>
      </section>
    </AppShell>
  );
}
