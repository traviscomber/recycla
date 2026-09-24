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

export default async function ClientPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { slug } = await params;
  const { year: yearParam } = await searchParams;
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
  if (!hasDatabase()) notFound();
  const client = await getRepClient(slug, year);
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
          <span>Próxima acción</span>
          <strong>{status}</strong>
          <p>{gaps.length ? `Resolver ${gaps.length} gap(s) REP antes del cierre.` : ficha?.reporting.latestCheck?.status === "PASS" ? "Continuar al cierre regulatorio." : "Ejecutar pre-check de cumplimiento."}</p>
        </article>
        <article className="ficha360Signal">
          <span>Evidencia</span>
          <strong>{ficha?.documentCount ?? 0}</strong>
          <p>{ficha?.expiringDocumentCount ? `${ficha.expiringDocumentCount} documento(s) vencen dentro de 60 días.` : "Sin vencimientos próximos detectados."}</p>
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

      <section className="panel ficha360Core">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Productos REP</p>
            <h3>Qué está cubierto y dónde intervenir.</h3>
          </div>
          <Link className="buttonLink secondary" href="/clientes">Volver a clientes</Link>
        </div>
        <div className="ficha360Products">
          {client.obligations.map((item) => {
            const pct = readiness(item);
            const currentGap = gap(item);
            return (
              <details key={item.stream} className="ficha360Product">
                <summary>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{pct.toFixed(1)}% readiness</span>
                  </div>
                  <b className={currentGap < 0 ? "negative" : "positive"}>
                    {currentGap < 0 ? "" : "+"}{fmt(currentGap)} {item.unit}
                  </b>
                </summary>
                <div className="ficha360ProductDetail">
                  <div><span>Obligación</span><strong>{fmt(item.obligation)} {item.unit}</strong></div>
                  <div><span>Recolectado</span><strong>{fmt(item.collected)} {item.unit}</strong></div>
                  <div><span>Valorizado</span><strong>{fmt(item.valued)} {item.unit}</strong></div>
                  <div><span>Elegible</span><strong>{fmt(item.eligible)} {item.unit}</strong></div>
                  <div><span>Evidencia completa</span><strong>{fmt(item.evidenceComplete)} {item.unit}</strong></div>
                  <div><span>Acreditable</span><strong>{fmt(item.accreditable)} {item.unit}</strong></div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <details className="ficha360Disclosure">
        <summary>Ver circularidad y detalle operacional</summary>
        <section className="clientDualView">
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
      </details>

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

    </AppShell>
  );
}
