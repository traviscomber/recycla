import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getStreamAdapter, streamAdapters } from "@/lib/streams";
import { getRepRulePack } from "@/lib/rep-rule-packs";

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
  const rulePack = getRepRulePack(adapter.id);

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

      <section className="regulatoryGate panel">
        <div>
          <p className="eyebrow">Gate regulatorio</p>
          <h3>{rulePack.sourceTitle}</h3>
          <p className="muted">{rulePack.summary}</p>
        </div>
        <div className="regulatoryGateState">
          <span>{rulePack.status.replaceAll("_", " ")}</span>
          <strong>{rulePack.enginePolicy === "APPLY" ? "APLICA AL MOTOR" : "SOLO MONITOREO"}</strong>
          <small>{rulePack.effectiveFrom ? "Vigente desde " + new Date(rulePack.effectiveFrom + "T12:00:00Z").toLocaleDateString("es-CL", { timeZone: "UTC" }) : "Sin fecha automática activada"}</small>
        </div>
      </section>

      <section className="rulePackGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Categorías regulatorias</p>
              <h3>Qué debe clasificarse antes de calcular.</h3>
            </div>
            <b>{rulePack.categories.length}</b>
          </div>
          <div className="rulePackList">
            {rulePack.categories.map((category) => (
              <div key={category.id}>
                <strong>{category.label}</strong>
                <p>{category.definition}</p>
                <span>{category.targetBearing ? "SUJETA A META / REGLA" : "SIN META EN ESTE PACK"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Gates de acreditación</p>
              <h3>Qué debe estar resuelto antes del cierre.</h3>
            </div>
            <b>{rulePack.operationalGates.length}</b>
          </div>
          <div className="checkList indexedList">
            {rulePack.operationalGates.map((gate, index) => (
              <span key={gate}><b>{String(index + 1).padStart(2, "0")}</b>{gate}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="panel rulePackTargets">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Metas y fórmulas</p>
            <h3>{rulePack.enginePolicy === "APPLY" ? "Reglas activas del motor" : "Referencia regulatoria · no calcula cumplimiento"}</h3>
          </div>
          <span className="rulePackPolicy">{rulePack.enginePolicy}</span>
        </div>
        <div className="rulePackTargetGrid">
          {rulePack.targets.map((target) => (
            <article key={target.id}>
              <div className="rulePackTargetHead">
                <strong>{target.label}</strong>
                <span>{target.legalStatus.replaceAll("_", " ")}</span>
              </div>
              <p>{target.basis}</p>
              <div className="rulePackSchedule">
                {target.points.map((point) => (
                  <div key={point.periodLabel}>
                    <span>{point.periodLabel}</span>
                    <b>R {point.collectionPct === null ? "—" : point.collectionPct + "%"}</b>
                    <b>V {point.valorizationPct === null ? "—" : point.valorizationPct + "%"}</b>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rulePackGrid">
        <article className="panel">
          <p className="eyebrow">Evidencia mínima</p>
          <h3>Qué bloquea la acreditación.</h3>
          <div className="rulePackEvidence">
            {rulePack.evidenceRequirements.map((item) => (
              <div key={item.id}>
                <strong>{item.label}</strong>
                <span>{item.blocking ? "BLOQUEANTE" : "CONTROL"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Fuentes</p>
          <h3>De dónde proviene cada regla.</h3>
          <div className="rulePackSources">
            {rulePack.sources.map((source) => (
              <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                <strong>{source.title}</strong>
                <span>{source.authority} · {source.role.replaceAll("_", " ")}</span>
              </a>
            ))}
          </div>
        </article>
      </section>

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
