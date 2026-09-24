import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import {
  listRecentSnapshots,
  persistOfficialSnapshot
} from "@/lib/state-snapshots";
import { getStateSyncOverview } from "@/lib/state-ingestion";
import { listGestorIntelligence } from "@/lib/gestor-intelligence";
import {
  getStateSourceMetadata,
  stateSources,
  searchLatestOfficialResource,
  summarizeOfficialRecord,
  type VerificationKind
} from "@/lib/state-intelligence";

export const dynamic = "force-dynamic";

async function saveSnapshotAction(formData: FormData) {
  "use server";

  const query = String(formData.get("query") ?? "").trim();
  const rawKind = String(formData.get("kind") ?? "producer");
  const matchIndex = Number(formData.get("matchIndex") ?? 0);

  const kind: VerificationKind =
    rawKind === "hazardous_destination" || rawKind === "storage_site"
      ? rawKind
      : "producer";

  if (query.length < 3 || !Number.isInteger(matchIndex) || matchIndex < 0) {
    redirect("/state-intelligence?snapshot=invalid");
  }

  const subjectType =
    kind === "producer"
      ? "rep_actor_producer"
      : kind === "hazardous_destination"
        ? "rep_actor_hazardous_destination"
        : "rep_actor_storage_site";

  const result = await persistOfficialSnapshot({
    kind,
    query,
    matchIndex,
    subjectType,
    status: "REVIEW_REQUIRED"
  });

  revalidatePath("/state-intelligence");
  revalidatePath("/network");
  revalidatePath("/audit");

  const params = new URLSearchParams({
    kind,
    q: query,
    snapshot: result.ok ? "saved" : "error"
  });

  redirect(`/state-intelligence?${params.toString()}`);
}

function gestorStatusLabel(status: string) {
  const labels: Record<string, string> = {
    VERIFIED_REFERENCE: "REFERENCIA CONFIRMADA",
    REVIEW_NAME_MATCH: "REVISAR IDENTIDAD",
    NOT_FOUND: "SIN REFERENCIA",
    MISSING_IDENTITY: "IDENTIDAD INCOMPLETA"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function snapshotStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REVIEW_REQUIRED: "REQUIERE REVISIÓN",
    VERIFIED: "VERIFICADO",
    NOT_FOUND: "SIN COINCIDENCIA",
    NO DISPONIBLE: "NO DISPONIBLE"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

const verificationLabels: Record<VerificationKind, string> = {
  producer: "Productor / establecimiento",
  hazardous_destination: "Destinatario de residuos peligrosos",
  storage_site: "Instalación de recepción / almacenamiento"
};

export default async function StateIntelligencePage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    kind?: VerificationKind;
    snapshot?: "saved" | "error" | "invalid";
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const snapshotFeedback = params.snapshot;
  const kind: VerificationKind =
    params.kind === "hazardous_destination" || params.kind === "storage_site"
      ? params.kind
      : "producer";

  const [metadata, verification, snapshots, syncOverview, gestorRows] = await Promise.all([
    Promise.all(stateSources.map(getStateSourceMetadata)),
    query ? searchLatestOfficialResource(kind, query) : Promise.resolve(null),
    listRecentSnapshots(8),
    getStateSyncOverview(),
    listGestorIntelligence("recycla-os", 100)
  ]);

  const metaById = new Map(metadata.map((item) => [item.id, item]));
  const syncById = new Map(syncOverview.map((item) => [item.sourceId, item]));
  const ready = metadata.filter((item) => item.status === "ready").length;
  const gestoresVerified = gestorRows.filter((item) => item.status === "VERIFIED_REFERENCE");
  const gestoresReview = gestorRows.filter((item) => item.status === "REVIEW_NAME_MATCH");
  const gestoresNotFound = gestorRows.filter((item) => item.status === "NOT_FOUND" || item.status === "MISSING_IDENTITY");

  return (
    <AppShell active="/state-intelligence">
      <header className="topbar">
        <div>
          <p className="eyebrow">Fuentes oficiales</p>
          <h1>Verifica una contraparte antes de usarla</h1>
          <p className="muted">
            Busca productores, gestores y destinos en fuentes públicas para respaldar identidad y contexto sin confundir una coincidencia con cumplimiento.
          </p>
        </div>
        <div className="period">
          <span>Fuentes activas</span>
          <strong>{ready}/{stateSources.length}</strong>
        </div>
      </header>

      <section className="pageGuide">
        <article>
          <span>Qué haces aquí</span>
          <strong>Buscar una entidad</strong>
          <p>Consulta una contraparte por nombre, establecimiento o identificador disponible.</p>
        </article>
        <article>
          <span>Qué significa un match</span>
          <strong>Referencia para revisar</strong>
          <p>Una coincidencia aporta contexto oficial, pero no prueba por sí sola autorización o cumplimiento.</p>
        </article>
        <article>
          <span>Cuándo guardarlo</span>
          <strong>Cuando respalda una decisión</strong>
          <p>Guarda una referencia sólo cuando necesites conservar qué fuente fue usada y cuándo.</p>
        </article>
      </section>

      <section className="decisionStrip">
        <article>
          <span>Uso</span>
          <strong>Verificación externa</strong>
          <p>Sirve para respaldar identidad y contexto.</p>
        </article>
        <article>
          <span>Fuentes activas</span>
          <strong>{ready}/{stateSources.length}</strong>
          <p>Disponibilidad actual de las fuentes conectadas.</p>
        </article>
        <article>
          <span>Referencias guardadas</span>
          <strong>{snapshots.length}</strong>
          <p>Contexto oficial preservado para revisión posterior.</p>
        </article>
      </section>

      <section className="panel stateVerifier">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Buscar contraparte</p>
            <h3>Consulta la fuente oficial antes de asociarla a una operación</h3>
          </div>
        </div>

        <form className="verificationForm" method="get">
          <label>
            <span>Tipo de entidad</span>
            <select name="kind" defaultValue={kind}>
              <option value="producer">Productor / establecimiento</option>
              <option value="hazardous_destination">Destinatario de residuos peligrosos</option>
              <option value="storage_site">Instalación de recepción / almacenamiento</option>
            </select>
          </label>

          <label className="queryField">
            <span>Razón social, establecimiento o ID VU</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Ej. Recycla, nombre de planta o ID Establecimiento VU"
              minLength={3}
            />
          </label>

          <button type="submit">Buscar en RETC</button>
        </form>

        <p className="verificationHint">
          La búsqueda usa el recurso oficial disponible más reciente. Toda coincidencia requiere revisión de identidad y contexto antes de usarla como respaldo.
        </p>

        {snapshotFeedback ? (
          <div className={`snapshotFeedback snapshotFeedback-${snapshotFeedback}`}>
            {snapshotFeedback === "saved"
              ? "Referencia oficial guardada. Quedó disponible en Red REP y Auditoría."
              : snapshotFeedback === "invalid"
                ? "La solicitud de snapshot no era válida."
                : "No fue posible persistir el snapshot oficial."}
          </div>
        ) : null}

        {verification ? (
          <div className="verificationResult">
            <div className="verificationSummary">
              <div>
                <span>Consulta</span>
                <strong>{verificationLabels[kind]}</strong>
                <p>{verification.detail}</p>
              </div>
              <div>
                <span>Recurso más reciente</span>
                <strong>{verification.resource?.year ?? "—"}</strong>
                <p>{verification.resource?.format ?? "s/i"} · {verification.matches.length} coincidencias</p>
              </div>
            </div>

            {verification.matches.length ? (
              <div className="matchList">
                {verification.matches.map((match, index) => (
                  <article className="matchCard" key={`${match.resourceId}-${index}`}>
                    <div className="matchHead">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <b>{match.status === "REVIEW_REQUIRED" ? "REQUIERE REVISIÓN" : match.status}</b>
                    </div>
                    <strong>{match.sourceLabel}</strong>
                    <p>{match.resourceName}</p>

                    <dl>
                      {summarizeOfficialRecord(match.record).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{String(value)}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="matchFoot">
                      <span>Coincidencia por texto o ID en fuente oficial</span>
                      <span className={match.isHistorical ? "historicalSource" : ""}>
                        Año fuente: {match.sourceYear ?? "s/i"}{match.isHistorical ? " · histórica" : ""}
                      </span>
                    </div>

                    <form action={saveSnapshotAction} className="snapshotAction">
                      <input type="hidden" name="query" value={query} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="matchIndex" value={index} />
                      <div>
                        <span>Guardar referencia</span>
                        <p>Conserva esta coincidencia y su fuente para poder reconstruir la revisión después.</p>
                      </div>
                      <button type="submit">Guardar referencia</button>
                    </form>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyState compactEmpty">
                <strong>Sin coincidencias verificables en el recurso consultado.</strong>
                <p>
                  Esto no demuestra que la entidad no exista. Puede significar que el nombre usado difiere, que el registro pertenece a otra categoría o que la fuente oficial no contiene esa entidad.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {gestorRows.length ? (
      <section className="panel gestorIntelligencePanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Gestores y destinos</p>
            <h3>Contrapartes operacionales que ya fueron contrastadas con fuentes oficiales.</h3>
          </div>
          <span className="workbenchUpdated">La coincidencia ayuda a revisar identidad; no equivale a autorización vigente</span>
        </div>

        <section className="decisionStrip">
          <article>
            <span>Identidad confirmada</span>
            <strong>{gestoresVerified.length}</strong>
            <p>Coincidencia exacta por identificador.</p>
          </article>
          <article>
            <span>Revisión pendiente</span>
            <strong>{gestoresReview.length}</strong>
            <p>Coincidencia exacta sólo por nombre.</p>
          </article>
          <article>
            <span>Sin referencia suficiente</span>
            <strong>{gestoresNotFound.length}</strong>
            <p>Requiere investigación antes del cierre.</p>
          </article>
        </section>

        {gestorRows.length ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Contraparte</th><th>Referencia</th><th>Operaciones</th><th>Última operación</th>
                  <th>Estado</th><th>Fuente</th><th>Año</th>
                </tr>
              </thead>
              <tbody>
                {gestorRows.slice(0, 30).map((row, index) => (
                  <tr key={(row.counterpartyRef ?? row.counterpartyName ?? "sin-id") + "-" + index}>
                    <td><strong>{row.counterpartyName ?? "Sin nombre"}</strong></td>
                    <td>{row.counterpartyRef ?? "—"}</td>
                    <td>{row.operationCount}</td>
                    <td>{new Date(row.lastSeenAt).toLocaleDateString("es-CL")}</td>
                    <td>
                      <span className={"gestorStatus gestor-" + row.status.toLowerCase()}>
                        {gestorStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>{row.sourceId ?? "—"}</td>
                    <td>{row.sourceYear ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin contrapartes reportables para contrastar.</strong>
            <p>Gestor Intelligence se activa cuando existen operaciones de gestión con contraparte persistida.</p>
          </div>
        )}

        <div className="stateGuardrail">
          <strong>Límite de uso</strong>
          <p>
            Una coincidencia RETC demuestra presencia en el dataset consultado, no vigencia de permisos ni cumplimiento REP. SNIFA permanece como capa de contexto de fiscalización y sancionatorios.
          </p>
        </div>
      </section>

      ) : null}

      <details className="secondaryDetail">
        <summary>Ver fuentes, sincronización y evidencia técnica</summary>
      <section className="stateSourceGrid">
        {stateSources.map((source, index) => {
          const meta = metaById.get(source.id);
          const sync = syncById.get(source.id);
          return (
            <article className="stateSourceCard" key={source.id}>
              <div className="stateSourceHead">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b className={`sourceStatus source-${meta?.status ?? "unavailable"}`}>
                  {meta?.status === "ready" ? "DISPONIBLE" : meta?.status === "not_applicable" ? "EXTERNA" : "UNAVAILABLE"}
                </b>
              </div>

              <strong>{source.label}</strong>
              <p>{source.purpose}</p>

              <dl>
                <div><dt>Agencia</dt><dd>{source.agency}</dd></div>
                <div><dt>Uso</dt><dd>{source.productUse.join(" · ")}</dd></div>
                {meta?.lastModified ? <div><dt>Metadata</dt><dd>{new Date(meta.lastModified).toLocaleDateString("es-CL")}</dd></div> : null}
                {typeof meta?.resources === "number" ? <div><dt>Recursos</dt><dd>{meta.resources}</dd></div> : null}
                {sync ? (
                  <div>
                    <dt>Ingesta</dt>
                    <dd>{sync.rowCount.toLocaleString("es-CL")} filas · {sync.status}</dd>
                  </div>
                ) : null}
                {sync?.finishedAt ? (
                  <div>
                    <dt>Último sync</dt>
                    <dd>{new Date(sync.finishedAt).toLocaleString("es-CL")}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="stateSourceFoot">
                <span>{meta?.detail ?? "Sin metadata"}</span>
                <a href={source.officialUrl} target="_blank" rel="noreferrer">Fuente oficial ↗</a>
              </div>
            </article>
          );
        })}
      </section>

      <section className="panel snapshotRegistry">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Referencias guardadas</p>
            <h3>Qué contexto oficial quedó preservado para revisiones posteriores.</h3>
          </div>
          <b>{snapshots.length}</b>
        </div>

        {snapshots.length ? (
          <div className="snapshotRows">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <span className={`snapshotStatus snapshot-${snapshot.status.toLowerCase()}`}>
                  {snapshotStatusLabel(snapshot.status)}
                </span>
                <div>
                  <strong>{snapshot.externalIdentifier ?? "Sin identificador externo"}</strong>
                  <p>{snapshot.sourceId} · {snapshot.subjectType}</p>
                </div>
                <time>{new Date(snapshot.fetchedAt).toLocaleString("es-CL")}</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Aún no hay referencias oficiales guardadas.</strong>
            <p>El registro aparecerá cuando una verificación se guarde como respaldo de una revisión.</p>
          </div>
        )}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Flujo de verificación</p>
          <h3>Actor / destino → búsqueda oficial → match → evidencia → auditoría.</h3>
          <p className="muted">
            El resultado operativo debe evolucionar de “requiere revisión” a “verificado” sólo cuando identidad, fuente y contexto coincidan de forma suficiente.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Referencia preservada</p>
          <h3>Congelar el contexto externo cuando una operación cambia de estado.</h3>
          <p className="muted">
            Fuente, identificador, fecha de consulta, contenido normalizado y hash quedan ligados al historial sin sobrescribir el histórico.
          </p>
        </article>
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Límite de uso</p>
        <h3>“Aparece en RETC/SNIFA” no significa “cumple REP”.</h3>
        <p className="muted">
          State Intelligence aporta contexto verificable. La elegibilidad y acreditación siguen dependiendo de reglas versionadas, operación y evidencia.
        </p>
      </section>
      </details>
    </AppShell>
  );
}
