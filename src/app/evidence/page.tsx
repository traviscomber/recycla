import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listEvidenceChains } from "@/lib/evidence-chain";
import { fmt } from "@/lib/rep";
import { listEvidenceDocuments, listRepLedgerEntries } from "@/lib/rep-repository";
import { listGestorIntelligence } from "@/lib/gestor-intelligence";

export const dynamic = "force-dynamic";

const streamLabel: Record<string, string> = {
  AEE_RAEE: "AEE / RAEE",
  NEUMATICOS: "Neumáticos",
  BATERIAS: "Baterías",
  PILAS: "Pilas",
  ACEITES_LUBRICANTES: "Aceites lubricantes"
};

function stageClass(done: boolean) {
  return done ? "chainStage chainStageDone" : "chainStage";
}

export default async function EvidencePage() {
  const [documents, ledgerEntries, chains, gestores] = await Promise.all([
    listEvidenceDocuments(100),
    listRepLedgerEntries(100),
    listEvidenceChains(100),
    listGestorIntelligence("recycla-os", 100)
  ]);

  const linkedDocuments = documents.filter((document) => document.linkedEntities > 0);
  const checksummed = documents.filter((document) => Boolean(document.checksumSha256));
  const ledgerWithEvidence = ledgerEntries.filter((entry) => entry.evidenceCount > 0);
  const completeChains = chains.filter((chain) => chain.completedStages === chain.totalStages);
  const evidenceReadyChains = chains.filter((chain) => chain.evidenceCount > 0 && chain.checksummedEvidence === chain.evidenceCount);
  const blockedChains = chains.filter((chain) => chain.blockers.length > 0);
  const verifiedGestores = gestores.filter((item) => item.status === "VERIFIED_REFERENCE");
  const unresolvedGestores = gestores.filter((item) => item.status !== "VERIFIED_REFERENCE");

  const hasOperationalEvidence = chains.length > 0 || documents.length > 0 || ledgerEntries.length > 0;

  if (!hasOperationalEvidence) {
    return (
      <AppShell active="/evidence">
        <header className="topbar">
          <div>
            <p className="eyebrow">Evidencia</p>
            <h1>Aún no hay operaciones que respaldar</h1>
            <p className="muted">
              La evidencia aparece cuando existen movimientos reales del período. Primero carga la operación; después podrás revisar documentos y trazabilidad.
            </p>
          </div>
          <div className="period"><span>Estado</span><strong>SIN OPERACIÓN</strong></div>
        </header>

        <section className="pageGuide">
          <article>
            <span>Primero</span>
            <strong>Cargar la operación</strong>
            <p>Registra los datos del período que originan retiro, pesaje, valorización o gestión.</p>
          </article>
          <article>
            <span>Después</span>
            <strong>Adjuntar y vincular respaldo</strong>
            <p>Los documentos se conectan a la operación concreta para conservar trazabilidad.</p>
          </article>
          <article>
            <span>Resultado</span>
            <strong>Una historia verificable</strong>
            <p>La vista mostrará qué etapas están completas y cuál es el primer pendiente.</p>
          </article>
        </section>

        <section className="panel reportingEmptyGate">
          <div>
            <p className="eyebrow">Punto de partida</p>
            <h2>Sin operación no hay evidencia que evaluar.</h2>
            <p className="muted">La app evita mostrar tablas y métricas vacías hasta que exista información operacional real.</p>
          </div>
          <div className="firstRunActions">
            <Link className="buttonLink" href="/reporting/intake">Cargar datos →</Link>
            <Link className="buttonLink secondary" href="/clientes">Ver clientes →</Link>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell active="/evidence">
      <header className="topbar">
        <div>
          <p className="eyebrow">Evidencia</p>
          <h1>Prueba qué pasó en cada operación</h1>
          <p className="muted">
            Sigue cada retiro desde la operación física hasta sus documentos, valorización y respaldo REP.
          </p>
        </div>
        <div className="period"><span>Cadenas visibles</span><strong>{chains.length}</strong></div>
      </header>

      <section className="pageGuide">
        <article>
          <span>Qué ves aquí</span>
          <strong>La historia completa de cada retiro</strong>
          <p>Retiro, pesaje, lote, valorización, documentos y estado final en una sola secuencia.</p>
        </article>
        <article>
          <span>Qué debes mirar</span>
          <strong>Operaciones incompletas</strong>
          <p>Si una etapa está pendiente, la app indica exactamente qué falta para cerrar la trazabilidad.</p>
        </article>
        <article>
          <span>Siguiente paso</span>
          <strong>Completar el primer bloqueo</strong>
          <p>No necesitas entender toda la arquitectura: resuelve el primer pendiente de cada operación.</p>
        </article>
      </section>

      <section className="decisionStrip" aria-label="Cobertura de evidencia">
        <article>
          <span>Operaciones completas</span>
          <strong>{chains.length ? completeChains.length + "/" + chains.length : "—"}</strong>
          <p>Retiro → pesaje → lote → valorización → evidencia → ledger</p>
        </article>
        <article>
          <span>Documentación íntegra</span>
          <strong>{chains.length ? evidenceReadyChains.length + "/" + chains.length : "—"}</strong>
          <p>Con documentos asociados y checksum SHA-256 completo</p>
        </article>
        <article>
          <span>Requieren acción</span>
          <strong>{blockedChains.length}</strong>
          <p>Operaciones con uno o más pasos todavía pendientes</p>
        </article>
      </section>

      <section className="panel evidenceChainPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Trazabilidad de la operación</p>
            <h3>Cada operación debe poder explicarse de principio a fin.</h3>
          </div>
          <span className="chainLegend">6 pasos de trazabilidad · completar la cadena no reemplaza el cierre REP</span>
        </div>

        {chains.length ? (
          <div className="evidenceChainList">
            {chains.map((chain) => {
              const weighingDone = chain.netKg !== null;
              const lotDone = chain.lotCount > 0;
              const valuationDone = chain.allocatedKg > 0;
              const evidenceDone = chain.evidenceCount > 0 && chain.checksummedEvidence === chain.evidenceCount;
              const ledgerDone = chain.latestLedgerState === "ACCREDITABLE";

              return (
                <article className="evidenceChainRow" key={chain.collectionId}>
                  <div className="chainIdentity">
                    <div>
                      <span>{new Date(chain.collectedAt).toLocaleDateString("es-CL")}</span>
                      <strong>{chain.client}</strong>
                      <p>{(streamLabel[chain.stream] ?? chain.stream) + " · " + (chain.externalRef ?? chain.collectionId.slice(0, 8))}</p>
                    </div>
                    <div className="chainCoverage">
                      <strong>{chain.coveragePercent}%</strong>
                      <span>{chain.completedStages}/{chain.totalStages} etapas</span>
                    </div>
                  </div>

                  <div className="chainStages" aria-label="Etapas de trazabilidad">
                    <div className={stageClass(true)}>
                      <span>01</span><strong>Retiro</strong>
                      <small>{chain.declaredQuantity !== null ? fmt(chain.declaredQuantity) + " " + (chain.declaredUnit ?? "") : "Registrado"}</small>
                    </div>
                    <div className={stageClass(weighingDone)}>
                      <span>02</span><strong>Pesaje</strong>
                      <small>{chain.netKg !== null ? fmt(chain.netKg) + " kg" : "Pendiente"}</small>
                    </div>
                    <div className={stageClass(lotDone)}>
                      <span>03</span><strong>Lote</strong>
                      <small>{chain.lotCodes.length ? chain.lotCodes.slice(0, 2).join(" · ") : "Pendiente"}</small>
                    </div>
                    <div className={stageClass(valuationDone)}>
                      <span>04</span><strong>Valorización</strong>
                      <small>{valuationDone ? fmt(chain.allocatedKg) + " kg" : "Pendiente"}</small>
                    </div>
                    <div className={stageClass(evidenceDone)}>
                      <span>05</span><strong>Evidencia</strong>
                      <small>{chain.evidenceCount ? chain.checksummedEvidence + "/" + chain.evidenceCount + " hash" : "Pendiente"}</small>
                    </div>
                    <div className={stageClass(ledgerDone)}>
                      <span>06</span><strong>Estado REP</strong>
                      <small>{chain.latestLedgerState?.replaceAll("_", " ") ?? "Pendiente"}</small>
                    </div>
                  </div>

                  <div className="chainFooter">
                    <div>
                      <span>Destino / valorización</span>
                      <strong>{chain.valuationRoutes.length ? chain.valuationRoutes.join(" · ").replaceAll("_", " ") : "Sin valorización cerrada"}</strong>
                      {chain.destinations.length ? <small>{chain.destinations.join(" · ")}</small> : null}
                    </div>
                    <div>
                      <span>Qué hacer ahora</span>
                      <strong>{chain.blockers[0] ?? "Cadena técnicamente completa"}</strong>
                      {chain.blockers.length > 1 ? <small>+{chain.blockers.length - 1} pendientes adicionales</small> : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="emptyState">
            <strong>Aún no hay operaciones trazables para mostrar.</strong>
            <p>Esta vista se activará cuando existan retiros reales conectados a pesaje, lote, valorización y documentos.</p>
          </div>
        )}
      </section>

      <section className="panel evidenceGestorContext">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Gestores / destinos</p>
            <h3>Contexto oficial conectado al respaldo operacional.</h3>
          </div>
          <Link className="buttonLink secondary" href="/state-intelligence">
            Revisar gestores y destinos →
          </Link>
        </div>
        <div className="workbenchPulse">
          <div>
            <span>Contrapartes reportables</span>
            <strong>{gestores.length}</strong>
            <p>Derivadas de operaciones de gestión persistidas</p>
          </div>
          <div>
            <span>Match exacto por referencia</span>
            <strong>{verifiedGestores.length}</strong>
            <p>Coincidencia en datasets RETC ingeridos</p>
          </div>
          <div>
            <span>Requieren revisión</span>
            <strong>{unresolvedGestores.length}</strong>
            <p>No se convierten automáticamente en evidencia suficiente</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Documentos</p>
            <h3>Qué respaldo existe y a qué operación pertenece.</h3>
          </div>
          <b>{linkedDocuments.length} vinculados</b>
        </div>

        {documents.length ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Documento</th><th>Cliente</th><th>Tipo</th><th>Emitido</th>
                  <th>Vence</th><th>Vínculos</th><th>Checksum</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td><strong>{document.fileName}</strong></td>
                    <td>{document.client ?? "Sin organización asociada"}</td>
                    <td>{document.documentType}</td>
                    <td>{document.issuedAt ? new Date(document.issuedAt).toLocaleDateString("es-CL") : "—"}</td>
                    <td>{document.expiresAt ? new Date(document.expiresAt).toLocaleDateString("es-CL") : "—"}</td>
                    <td>{document.linkedEntities}</td>
                    <td>{document.checksumSha256 ? document.checksumSha256.slice(0, 12) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState">
            <strong>Sin documentos operacionales persistidos.</strong>
            <p>No se muestra evidencia hasta que existan documentos reales y vínculos verificables.</p>
          </div>
        )}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div><p className="eyebrow">Cobertura REP</p><h3>Registros que ya tienen respaldo documental.</h3></div>
            <b>{ledgerWithEvidence.length}</b>
          </div>
          {ledgerWithEvidence.length ? (
            ledgerWithEvidence.slice(0, 8).map((entry) => (
              <div className="finding" key={entry.id}>
                <i className="info" />
                <span>
                  {entry.client}
                  <small>{entry.state.replaceAll("_", " ")} · {entry.sourceEntityType}</small>
                </span>
                <strong>{entry.evidenceCount}</strong>
              </div>
            ))
          ) : (
            <div className="emptyState compactEmpty">
              <strong>Sin entradas del ledger con evidencia vinculada.</strong>
              <p>La cobertura aparecerá al asociar documentos reales con entidades operacionales.</p>
            </div>
          )}
        </article>

        <article className="panel blockerPanel">
          <p className="eyebrow">Principio de acreditación</p>
          <h3>La ausencia de respaldo nunca se reemplaza con un supuesto.</h3>
          <p className="muted">
            La cadena conserva operación física, transformación, documento, checksum y estado REP como capas separadas y verificables.
          </p>
          <div className="notReady">
            <span>INTEGRIDAD DOCUMENTAL</span>
            <strong>{documents.length ? checksummed.length + "/" + documents.length : "PENDIENTE"}</strong>
            <p>Documentos persistidos con checksum SHA-256.</p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
