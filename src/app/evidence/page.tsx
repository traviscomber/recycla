import { AppShell } from "@/components/app-shell";
import { listEvidenceChains } from "@/lib/evidence-chain";
import { fmt } from "@/lib/rep";
import { listEvidenceDocuments, listRepLedgerEntries } from "@/lib/rep-repository";

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
  const [documents, ledgerEntries, chains] = await Promise.all([
    listEvidenceDocuments(100),
    listRepLedgerEntries(100),
    listEvidenceChains(100)
  ]);

  const linkedDocuments = documents.filter((document) => document.linkedEntities > 0);
  const checksummed = documents.filter((document) => Boolean(document.checksumSha256));
  const ledgerWithEvidence = ledgerEntries.filter((entry) => entry.evidenceCount > 0);
  const completeChains = chains.filter((chain) => chain.completedStages === chain.totalStages);
  const evidenceReadyChains = chains.filter((chain) => chain.evidenceCount > 0 && chain.checksummedEvidence === chain.evidenceCount);
  const blockedChains = chains.filter((chain) => chain.blockers.length > 0);

  return (
    <AppShell active="/evidence">
      <header className="topbar">
        <div>
          <p className="eyebrow">REP Evidence Chain</p>
          <h1>Evidence Graph</h1>
          <p className="muted">
            Reconstruye cada movimiento desde el retiro físico hasta evidencia, valorización y estado REP.
          </p>
        </div>
        <div className="period"><span>Cadenas visibles</span><strong>{chains.length}</strong></div>
      </header>

      <section className="decisionStrip" aria-label="Cobertura de Evidence Chain">
        <article>
          <span>Cadena completa</span>
          <strong>{chains.length ? completeChains.length + "/" + chains.length : "—"}</strong>
          <p>Retiro → pesaje → lote → valorización → evidencia → ledger</p>
        </article>
        <article>
          <span>Evidencia íntegra</span>
          <strong>{chains.length ? evidenceReadyChains.length + "/" + chains.length : "—"}</strong>
          <p>Con documentos asociados y checksum SHA-256 completo</p>
        </article>
        <article>
          <span>Requieren acción</span>
          <strong>{blockedChains.length}</strong>
          <p>Cadenas con una o más etapas técnicas pendientes</p>
        </article>
      </section>

      <section className="panel evidenceChainPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Cadena operacional verificable</p>
            <h3>Una operación física, una historia reconstruible.</h3>
          </div>
          <span className="chainLegend">6 etapas técnicas · no equivale por sí sola a cumplimiento</span>
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
                      <span>06</span><strong>Ledger</strong>
                      <small>{chain.latestLedgerState?.replaceAll("_", " ") ?? "Pendiente"}</small>
                    </div>
                  </div>

                  <div className="chainFooter">
                    <div>
                      <span>Ruta</span>
                      <strong>{chain.valuationRoutes.length ? chain.valuationRoutes.join(" · ").replaceAll("_", " ") : "Sin valorización cerrada"}</strong>
                      {chain.destinations.length ? <small>{chain.destinations.join(" · ")}</small> : null}
                    </div>
                    <div>
                      <span>Siguiente acción</span>
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
            <strong>Sin cadenas operacionales persistidas.</strong>
            <p>Evidence Chain aparecerá cuando existan retiros reales conectados a pesaje, lote, valorización, evidencia y ledger.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Documentos persistidos</p>
            <h3>Evidencia disponible y nivel de vinculación.</h3>
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
            <div><p className="eyebrow">Cobertura del ledger</p><h3>Entradas REP respaldadas por evidencia.</h3></div>
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
