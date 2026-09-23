import { AppShell } from "@/components/app-shell";

const evidenceChain = [
  { id: "RCL-4821", type: "Retiro", detail: "Origen: Cliente piloto Recycla", status: "ok" },
  { id: "PES-1944", type: "Pesaje", detail: "8.420 kg netos", status: "ok" },
  { id: "LOT-2318", type: "Lote", detail: "AEE / RAEE", status: "ok" },
  { id: "PROC-772", type: "Proceso", detail: "Desarme + separación", status: "ok" },
  { id: "VAL-551", type: "Valorización", detail: "8.120 kg valorizados", status: "warning" },
  { id: "DOC-991", type: "Certificado", detail: "Pendiente firma final", status: "critical" }
];

const documents = [
  { type: "Guía / retiro", id: "DOC-981", state: "Validado" },
  { type: "Ticket pesaje", id: "DOC-983", state: "Validado" },
  { type: "Acta recepción", id: "DOC-985", state: "Validado" },
  { type: "Registro proceso", id: "DOC-988", state: "Validado" },
  { type: "Certificado valorización", id: "DOC-991", state: "Pendiente" }
];

export default function EvidencePage() {
  return (
    <AppShell active="/evidence">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lineage verificable</p>
          <h1>Evidence Graph</h1>
          <p className="muted">Abre cada cifra hasta la operación física y el documento que la respalda.</p>
        </div>
        <div className="period"><span>Lineage</span><strong>8.420 kg</strong></div>
      </header>

      <section className="decisionStrip" aria-label="Resumen de evidencia">
        <article>
          <span>Estado</span>
          <strong className="negative">Incompleto</strong>
          <p>1 documento crítico pendiente</p>
        </article>
        <article>
          <span>Completitud</span>
          <strong>4 / 5</strong>
          <p>80% de evidencia requerida</p>
        </article>
        <article>
          <span>Cantidad afectada</span>
          <strong>8.120 kg</strong>
          <p>No acreditable hasta cierre</p>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Cadena de evidencia</p>
            <h3>Cliente piloto Recycla · AEE / RAEE</h3>
          </div>
          <button>Exportar expediente</button>
        </div>

        <div className="evidenceGraph">
          {evidenceChain.map((node, index) => (
            <div className="evidenceNodeWrap" key={node.id}>
              <article className={`evidenceNode node-${node.status}`}>
                <span>{node.type}</span>
                <strong>{node.id}</strong>
                <p>{node.detail}</p>
              </article>
              {index < evidenceChain.length - 1 && <div className="connector" aria-hidden="true">→</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div><p className="eyebrow">Documentos</p><h3>Qué existe y qué falta</h3></div>
            <b>4/5</b>
          </div>
          {documents.map((doc) => (
            <div className="finding" key={doc.id}>
              <i className={doc.state === "Validado" ? "info" : "critical"} />
              <span>{doc.type}<small>{doc.id}</small></span>
              <strong>{doc.state}</strong>
            </div>
          ))}
        </article>

        <article className="panel blockerPanel">
          <p className="eyebrow">Bottleneck</p>
          <h3>Certificado final de valorización</h3>
          <p className="muted">
            La operación física y la valorización están registradas, pero este lineage no
            debe promoverse a acreditable hasta completar la evidencia final.
          </p>
          <div className="notReady">
            <span>ESTADO DEL LINEAGE</span>
            <strong>EVIDENCIA INCOMPLETA</strong>
            <p>8.120 kg permanecen bloqueados.</p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
