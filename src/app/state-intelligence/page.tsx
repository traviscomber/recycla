import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import {
  listRecentSnapshots,
  persistOfficialSnapshot
} from "@/lib/state-snapshots";
import { getStateSyncOverview } from "@/lib/state-ingestion";
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

  const [metadata, verification, snapshots, syncOverview] = await Promise.all([
    Promise.all(stateSources.map(getStateSourceMetadata)),
    query ? searchLatestOfficialResource(kind, query) : Promise.resolve(null),
    listRecentSnapshots(8),
    getStateSyncOverview()
  ]);

  const metaById = new Map(metadata.map((item) => [item.id, item]));
  const syncById = new Map(syncOverview.map((item) => [item.sourceId, item]));
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

      <section className="panel stateVerifier">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Verificación oficial</p>
            <h3>Buscar una entidad en datasets públicos RETC</h3>
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
          Busca sobre el recurso oficial más reciente publicado por RETC, incluyendo XLSX/CSV. Una coincidencia se marca como <strong>requiere revisión</strong> hasta corroborar identidad y contexto.
        </p>

        {snapshotFeedback ? (
          <div className={`snapshotFeedback snapshotFeedback-${snapshotFeedback}`}>
            {snapshotFeedback === "saved"
              ? "Snapshot oficial persistido. Quedó disponible en REP Network y Audit Room."
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
                      <span>Match: texto / ID en dataset oficial</span>
                      <span className={match.isHistorical ? "historicalSource" : ""}>
                        Año fuente: {match.sourceYear ?? "s/i"}{match.isHistorical ? " · histórica" : ""}
                      </span>
                    </div>

                    <form action={saveSnapshotAction} className="snapshotAction">
                      <input type="hidden" name="query" value={query} />
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="matchIndex" value={index} />
                      <div>
                        <span>State Snapshot</span>
                        <p>Congela esta coincidencia oficial como evidencia externa. No la convierte en cumplimiento REP.</p>
                      </div>
                      <button type="submit">Guardar snapshot</button>
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

      <section className="stateSourceGrid">
        {stateSources.map((source, index) => {
          const meta = metaById.get(source.id);
          const sync = syncById.get(source.id);
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
            <p className="eyebrow">State Snapshot Registry</p>
            <h3>Qué evidencia externa quedó congelada para decisiones operacionales.</h3>
          </div>
          <b>{snapshots.length}</b>
        </div>

        {snapshots.length ? (
          <div className="snapshotRows">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id}>
                <span className={`snapshotStatus snapshot-${snapshot.status.toLowerCase()}`}>
                  {snapshot.status}
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
            <strong>Aún no hay snapshots persistidos.</strong>
            <p>El registro se poblará cuando una verificación oficial se congele como evidencia del expediente.</p>
          </div>
        )}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Verification flow</p>
          <h3>Actor / destino → búsqueda oficial → match → evidencia → auditoría.</h3>
          <p className="muted">
            El resultado operativo debe evolucionar de “requiere revisión” a “verificado” sólo cuando identidad, fuente y contexto coincidan de forma suficiente.
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
