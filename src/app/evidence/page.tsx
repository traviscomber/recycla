import { AppShell } from "@/components/app-shell";
import { listEvidenceDocuments, listRepLedgerEntries } from "@/lib/rep-repository";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const [documents, ledgerEntries] = await Promise.all([
    listEvidenceDocuments(100),
    listRepLedgerEntries(100)
  ]);

  const linkedDocuments = documents.filter((document) => document.linkedEntities > 0);
  const checksummed = documents.filter((document) => Boolean(document.checksumSha256));
  const ledgerWithEvidence = ledgerEntries.filter((entry) => entry.evidenceCount > 0);

  return (
    <AppShell active="/evidence">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lineage verificable</p>
          <h1>Evidence Graph</h1>
          <p className="muted">Abre cada cifra hasta la operación física y el documento que la respalda.</p>
        </div>
        <div className="period"><span>Documentos</span><strong>{documents.length}</strong></div>
      </header>

      <section className="decisionStrip" aria-label="Resumen de evidencia">
        <article>
          <span>Documentos vinculados</span>
          <strong>{linkedDocuments.length}</strong>
          <p>Con relación persistida a entidades operacionales</p>
        </article>
        <article>
          <span>Integridad hash</span>
          <strong>{documents.length ? `${checksummed.length}/${documents.length}` : "—"}</strong>
          <p>Documentos con checksum SHA-256</p>
        </article>
        <article>
          <span>Ledger con evidencia</span>
          <strong>{ledgerEntries.length ? `${ledgerWithEvidence.length}/${ledgerEntries.length}` : "—"}</strong>
          <p>Entradas visibles con evidencia asociada</p>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Documentos persistidos</p>
            <h3>Evidencia disponible y su nivel de vinculación.</h3>
          </div>
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
            <p>Evidence Graph no mostrará expedientes hasta que existan documentos reales y vínculos verificables.</p>
          </div>
        )}
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div><p className="eyebrow">Cobertura de lineage</p><h3>Entradas REP respaldadas por evidencia.</h3></div>
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
              <p>La cobertura aparecerá al asociar documentos reales con las entidades operacionales.</p>
            </div>
          )}
        </article>

        <article className="panel blockerPanel">
          <p className="eyebrow">Regla de acreditación</p>
          <h3>La evidencia debe ser verificable antes de acreditar.</h3>
          <p className="muted">
            El sistema conserva documento, checksum y vínculo con la entidad operacional. La ausencia de respaldo no se reemplaza con supuestos.
          </p>
          <div className="notReady">
            <span>ESTADO DOCUMENTAL</span>
            <strong>{documents.length && ledgerWithEvidence.length ? "CON EVIDENCIA" : "PENDIENTE"}</strong>
            <p>El estado refleja únicamente información persistida.</p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
