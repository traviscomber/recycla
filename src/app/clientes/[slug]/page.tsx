import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasDatabase } from "@/lib/db";
import { getClientCircularityOutcomes, getRepClient } from "@/lib/rep-repository";
import { getClient360 } from "@/lib/client-360";
import { fmt } from "@/lib/rep";
import { routeLabel } from "@/lib/circularity";

export const dynamic = "force-dynamic";

function readiness(item: { obligation: number; accreditable: number }) {
  if (item.obligation <= 0) return 0;
  return Math.min(100, (item.accreditable / item.obligation) * 100);
}

function gap(item: { obligation: number; accreditable: number }) {
  return item.accreditable - item.obligation;
}

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!hasDatabase()) notFound();
  const client = await getRepClient(slug);
  if (!client) notFound();

  const [circularity, ficha] = await Promise.all([
    getClientCircularityOutcomes(slug, Number(client.period)),
    getClient360(slug)
  ]);
  const circularityTotal = circularity.reduce((sum, item) => sum + item.quantityKg, 0);
  const materialPriorityKg = circularity
    .filter((item) => item.route === "PREPARATION_FOR_REUSE" || item.route === "RECYCLING")
    .reduce((sum, item) => sum + item.quantityKg, 0);

  const values = client.obligations.map(readiness);
  const status = values.length > 0 && values.every((value) => value >= 100) ? "Listo" : values.length > 0 && values.every((value) => value >= 95) ? "Casi listo" : "Atención";
  const gaps = client.obligations.filter((item) => gap(item) < 0);

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div><p className="eyebrow">Cliente REP · {client.period}</p><h1>{client.name}</h1><p className="muted">{client.rut} · {client.obligations.length} productos prioritarios activos</p></div>
        <div className="period"><span>Estado consolidado</span><strong>{status}</strong></div>
      </header>
      <section className="ficha360Hero">
        <div>
          <p className="eyebrow">Ficha 360 · organización</p>
          <h2>Lo importante ahora</h2>
          <p className="muted">
            Estado REP, evidencia, actividad y cierre en una sola vista. El detalle secundario queda abajo.
          </p>
        </div>
        <div className="ficha360Actions">
          <Link className="buttonLink" href="/reporting">Abrir cierre REP →</Link>
          <Link className="buttonLink secondary" href="/evidence">Ver evidencia →</Link>
        </div>
      </section>

      <section className="ficha360Decision">
        <article className={gaps.length ? "ficha360Signal signal-attention" : "ficha360Signal signal-ok"}>
          <span>Estado actual</span>
          <strong>{status}</strong>
          <p>{gaps.length ? `${gaps.length} producto(s) requieren acción antes del cierre.` : "Sin gaps REP detectados en el período."}</p>
        </article>
        <article className="ficha360Signal">
          <span>Evidencia</span>
          <strong>{ficha?.documentCount ?? 0}</strong>
          <p>{ficha?.expiringDocumentCount ? `${ficha.expiringDocumentCount} documento(s) vencen dentro de 60 días.` : "Sin vencimientos próximos detectados."}</p>
        </article>
        <article className="ficha360Signal">
          <span>Actividad ledger</span>
          <strong>{ficha?.ledgerEventCount ?? 0}</strong>
          <p>{ficha?.lastLedgerAt ? `Último evento ${new Date(ficha.lastLedgerAt).toLocaleDateString("es-CL")}.` : "Sin movimientos enlazados."}</p>
        </article>
        <article className={ficha?.reporting.criticalFindings ? "ficha360Signal signal-attention" : "ficha360Signal"}>
          <span>Hallazgos abiertos</span>
          <strong>{ficha?.reporting.openFindings ?? 0}</strong>
          <p>{ficha?.reporting.criticalFindings ? `${ficha.reporting.criticalFindings} crítico(s).` : "Sin hallazgos críticos enlazados."}</p>
        </article>
      </section>

      <section className="ficha360Identity panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Identidad y cobertura</p>
            <h3>{ficha?.organization.legalName ?? client.name}</h3>
          </div>
          <span className="ficha360Updated">
            Alta {ficha?.organization.createdAt ? new Date(ficha.organization.createdAt).toLocaleDateString("es-CL") : "no informada"}
          </span>
        </div>
        <div className="ficha360Meta">
          <div><span>RUT</span><strong>{client.rut}</strong></div>
          <div><span>Período</span><strong>{client.period}</strong></div>
          <div><span>Productos REP</span><strong>{client.obligations.length}</strong></div>
          <div><span>Cobertura reporting</span><strong>{ficha?.reporting.latestReport ? "Disponible" : "Sin reporte enlazado"}</strong></div>
        </div>
      </section>

      <section className="clientSummary">
        <article className="card"><span className="label">Productos REP</span><div className="big">{client.obligations.length}</div><p className="muted">Cada producto conserva su propia unidad y meta.</p></article>
        <article className="card"><span className="label">Productos sin gap</span><div className="big">{client.obligations.length - gaps.length}</div><p className="muted">Readiness ≥ 100%.</p></article>
        <article className={gaps.length ? "card risk" : "card"}><span className="label">Productos con gap</span><div className={gaps.length ? "gap" : "big"}>{gaps.length}</div><p className="muted">Requieren acción antes del cierre.</p></article>
      </section>
      <section className="panel">
        <div className="panelHead"><div><p className="eyebrow">Readiness por producto</p><h3>No se mezclan kg y litros en una sola cifra.</h3></div><Link className="buttonLink" href="/clientes">Volver a clientes</Link></div>
        <div className="obligationGrid">
          {client.obligations.map((item) => {
            const pct = readiness(item);
            const currentGap = gap(item);
            return (
              <article className="obligationCard" key={item.stream}>
                <div className="obligationHead"><div><span>{item.label}</span><strong>{pct.toFixed(1)}%</strong></div><b className={currentGap < 0 ? "negative" : "positive"}>{currentGap < 0 ? "" : "+"}{fmt(currentGap)} {item.unit}</b></div>
                <div className="miniProgress large"><div style={{ width: `${pct}%` }} /></div>
                <dl className="metricList">
                  <div><dt>Obligación</dt><dd>{fmt(item.obligation)} {item.unit}</dd></div>
                  <div><dt>Recolectado</dt><dd>{fmt(item.collected)} {item.unit}</dd></div>
                  <div><dt>Valorizado</dt><dd>{fmt(item.valued)} {item.unit}</dd></div>
                  <div><dt>Elegible</dt><dd>{fmt(item.eligible)} {item.unit}</dd></div>
                  <div><dt>Evidencia completa</dt><dd>{fmt(item.evidenceComplete)} {item.unit}</dd></div>
                  <div><dt>Acreditable</dt><dd>{fmt(item.accreditable)} {item.unit}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
      <section className="clientDualView">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">REP Readiness</p>
              <h3>¿Cuánto puede acreditar?</h3>
            </div>
          </div>
          <p className="muted">
            Se calcula por producto y unidad. No se suman kg y litros en un único porcentaje.
          </p>
          <div className="dualMetricList">
            {client.obligations.map((item) => (
              <div key={item.stream}>
                <span>{item.label}</span>
                <strong>{readiness(item).toFixed(1)}%</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Circularity Quality</p>
              <h3>¿Qué ruta siguió el material?</h3>
            </div>
          </div>

          {circularityTotal > 0 ? (
            <>
              <div className="circularityClientSummary">
                <span>Rutas materiales prioritarias</span>
                <strong>{((materialPriorityKg / circularityTotal) * 100).toFixed(1)}%</strong>
                <p>{fmt(materialPriorityKg)} kg de {fmt(circularityTotal)} kg con outcome asignado</p>
              </div>

              <div className="dualMetricList">
                {circularity.map((item) => (
                  <div key={item.route}>
                    <span>{routeLabel(item.route)}</span>
                    <strong>{fmt(item.quantityKg)} kg</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="emptyState compactEmpty">
              <strong>Sin outcomes circulares asignados todavía.</strong>
              <p>La métrica aparecerá cuando los outputs de valorización estén asignados explícitamente al cliente.</p>
            </div>
          )}
        </article>
      </section>

      <section className="ficha360Lower">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Actividad reciente</p>
              <h3>Últimos movimientos REP</h3>
            </div>
            <Link className="buttonLink secondary" href="/ledger">Abrir ledger →</Link>
          </div>
          {ficha?.ledgerEvents.length ? (
            <div className="ficha360Timeline">
              {ficha.ledgerEvents.slice(0, 5).map((event) => (
                <div key={event.id}>
                  <span>{new Date(event.createdAt).toLocaleDateString("es-CL")}</span>
                  <div><strong>{event.stream.replaceAll("_", " ")}</strong><p>{event.state.replaceAll("_", " ")} · {fmt(event.quantity)} {event.unit}</p></div>
                  <b>{event.evidenceCount} doc.</b>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState compactEmpty"><strong>Sin historial enlazado.</strong><p>No existen movimientos REP activos para esta organización.</p></div>
          )}
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Documentos y evidencia</p>
              <h3>Respaldo disponible</h3>
            </div>
            <Link className="buttonLink secondary" href="/evidence">Abrir evidencia →</Link>
          </div>
          {ficha?.documents.length ? (
            <div className="ficha360Docs">
              {ficha.documents.slice(0, 5).map((doc) => (
                <div key={doc.id}>
                  <div><strong>{doc.documentType}</strong><p>{doc.fileName}</p></div>
                  <span>{doc.issuedAt ? `Emitido ${new Date(doc.issuedAt).toLocaleDateString("es-CL")}` : `Cargado ${new Date(doc.createdAt).toLocaleDateString("es-CL")}`}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState compactEmpty"><strong>Sin documentos enlazados.</strong><p>La ficha mantiene visible esta ausencia porque afecta la defendibilidad del cierre.</p></div>
          )}
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Reporting</p>
              <h3>Estado del cierre enlazado</h3>
            </div>
            <Link className="buttonLink secondary" href="/reporting">Abrir reporting →</Link>
          </div>
          <div className="ficha360Meta">
            <div><span>Último reporte</span><strong>{ficha?.reporting.latestReport?.status ?? "No informado"}</strong></div>
            <div><span>Último pre-check</span><strong>{ficha?.reporting.latestCheck?.status ?? "No ejecutado"}</strong></div>
            <div><span>Filas mercado</span><strong>{ficha?.reporting.marketRows ?? 0}</strong></div>
            <div><span>Operaciones gestión</span><strong>{ficha?.reporting.wasteRows ?? 0}</strong></div>
          </div>
          <p className="ficha360Footnote">
            Los datos de reporting sólo aparecen cuando están enlazados exactamente al slug canónico de esta organización.
          </p>
        </article>
      </section>

      <section className="panel ledgerRule"><p className="eyebrow">Consolidación correcta</p><h3>Compliance y circularidad son dimensiones distintas.</h3><p className="muted">REP Readiness responde cuánto puede acreditar. Circularity Quality describe la ruta física del material. Ninguna reemplaza a la otra.</p></section>
    </AppShell>
  );
}
