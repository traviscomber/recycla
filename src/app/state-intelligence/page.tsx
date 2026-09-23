import { AppShell } from "@/components/app-shell";
import { getStateSourceMetadata, stateSources } from "@/lib/state-intelligence";

export const dynamic = "force-dynamic";

export default async function StateIntelligencePage() {
  const metadata = await Promise.all(stateSources.map(getStateSourceMetadata));
  const metaById = new Map(metadata.map((item) => [item.id, item]));
  const ready = metadata.filter((item) => item.status === "ready").length;

  return (
    <AppShell active="/state-intelligence">
      <header className="topbar">
        <div>
          <p className="eyebrow">Official data layer</p>
          <h1>State Intelligence</h1>
          <p className="muted">
            Conecta la operación privada con fuentes públicas oficiales sin convertir una coincidencia externa en una decisión automática de cumplimiento.
          </p>
        </div>
        <div className="period">
          <span>Fuentes activas</span>
          <strong>{ready}/{stateSources.length}</strong>
        </div>
      </header>

      <section className="decisionStrip">
        <article>
          <span>Principio</span>
          <strong>Evidencia externa</strong>
          <p>Contextualiza y valida; no reemplaza las reglas REP.</p>
        </article>
        <article>
          <span>Refresh</span>
          <strong>6 h</strong>
          <p>Metadatos RETC cacheados para no sobrecargar fuentes públicas.</p>
        </article>
        <article>
          <span>Snapshot</span>
          <strong>Versionado</strong>
          <p>El estado oficial usado por una decisión debe poder reconstruirse.</p>
        </article>
      </section>

      <section className="stateSourceGrid">
        {stateSources.map((source, index) => {
          const meta = metaById.get(source.id);
          return (
            <article className="stateSourceCard" key={source.id}>
              <div className="stateSourceHead">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b className={`sourceStatus source-${meta?.status ?? "unavailable"}`}>
                  {meta?.status === "ready" ? "LIVE METADATA" : meta?.status === "not_applicable" ? "EXTERNAL" : "UNAVAILABLE"}
                </b>
              </div>

              <strong>{source.label}</strong>
              <p>{source.purpose}</p>

              <dl>
                <div><dt>Agencia</dt><dd>{source.agency}</dd></div>
                <div><dt>Uso</dt><dd>{source.productUse.join(" · ")}</dd></div>
                {meta?.lastModified ? <div><dt>Metadata</dt><dd>{new Date(meta.lastModified).toLocaleDateString("es-CL")}</dd></div> : null}
                {typeof meta?.resources === "number" ? <div><dt>Recursos</dt><dd>{meta.resources}</dd></div> : null}
              </dl>

              <div className="stateSourceFoot">
                <span>{meta?.detail ?? "Sin metadata"}</span>
                <a href={source.officialUrl} target="_blank" rel="noreferrer">Fuente oficial ↗</a>
              </div>
            </article>
          );
        })}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Verification flow</p>
          <h3>Actor / destino → búsqueda oficial → match → evidencia → auditoría.</h3>
          <p className="muted">
            La primera versión prioriza sistemas de gestión, destinatarios e instalaciones. El resultado debe ser “verificado”, “no encontrado” o “requiere revisión”.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">State Snapshot</p>
          <h3>Congelar el contexto externo cuando una operación cambia de estado.</h3>
          <p className="muted">
            Fuente, identificador, fecha de consulta, contenido normalizado y hash quedan ligados al lineage sin sobrescribir el histórico.
          </p>
        </article>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Guardrail</p>
        <h3>“Aparece en RETC/SNIFA” no significa “cumple REP”.</h3>
        <p className="muted">
          State Intelligence aporta contexto verificable. La elegibilidad y acreditación siguen dependiendo de reglas versionadas, operación y evidencia.
        </p>
      </section>
    </AppShell>
  );
}
