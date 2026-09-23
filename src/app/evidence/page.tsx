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
          <p className="muted">Desde el KPI hasta la operación física y el documento que lo respalda.</p>
        </div>
        <div className="period"><span>Lineage</span><strong>8.420 kg</strong></div>
      </header>

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
              {index < evidenceChain.length - 1 && <div className="connector">→</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="bottomGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Documentos</p>
              <h3>Evidence completeness</h3>
            </div>
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

        <article className="panel">
          <p className="eyebrow">Resultado</p>
          <h3>La operación existe, pero aún no es acreditable.</h3>
          <p className="muted">
            Falta cerrar el certificado final de valorización. El ledger puede mantener
            el estado físico y elegible, pero no promover esta cantidad a acreditable.
          </p>
          <div className="notReady">
            <span>STATUS</span>
            <strong>EVIDENCIA INCOMPLETA</strong>
            <p>8.120 kg quedan temporalmente fuera del cumplimiento acreditable.</p>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
