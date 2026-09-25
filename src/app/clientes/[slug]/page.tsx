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

function repRoleLabel(role: string) {
  const labels: Record<string, string> = {
    PRODUCER_IMPORTER: "Productor / importador",
    MANAGEMENT_SYSTEM: "Sistema de gestión",
    WASTE_MANAGER: "Gestor",
    CONSUMER: "Consumidor",
    MUNICIPALITY: "Municipalidad"
  };
  return labels[role] ?? role.replaceAll("_", " ");
}

function relationshipLabel(type: string) {
  const labels: Record<string, string> = {
    FINANCES_SYSTEM: "Financia sistema",
    CONTRACTS_MANAGER: "Contrata gestor",
    DELIVERS_WASTE: "Entrega residuos",
    PUTS_PRODUCT_ON_MARKET: "Pone producto en mercado"
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function planStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    PLANNED: "Planificado",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "En curso"
  };
  return labels[status] ?? status.replaceAll("_", " ");
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

  const applicableObligations = client.obligations.filter((item) => item.regulatoryMode === "APPLY");
  const monitoredObligations = client.obligations.filter((item) => item.regulatoryMode === "MONITOR_ONLY");
  const values = applicableObligations.map(readiness);
  const status =
    values.length === 0
      ? "Monitoreo"
      : values.every((value) => value >= 100)
        ? "Listo"
        : values.every((value) => value >= 95)
          ? "Casi listo"
          : "Atención";
  const gaps = applicableObligations.filter((item) => gap(item) < 0);
  const nextPlan = ficha?.upcomingPlans[0] ?? null;
  const activeRoles = ficha?.roles.filter((role) => !role.validTo || new Date(role.validTo) >= new Date()) ?? [];
  const accountAlerts = [
    ...gaps.map((item) => ({
      id: `gap-${item.stream}`,
      tone: "critical",
      title: `Brecha REP · ${item.label}`,
      detail: `Faltan ${fmt(Math.abs(gap(item)))} ${item.unit} acreditables para cubrir la obligación.`,
      href: "/reporting",
      action: "Resolver brecha"
    })),
    ...(ficha?.expiringDocumentCount
      ? [{
          id: "expiring-documents",
          tone: "warning",
          title: "Documentos próximos a vencer",
          detail: `${ficha.expiringDocumentCount} documento(s) vencen dentro de los próximos 60 días.`,
          href: "/evidence",
          action: "Revisar evidencia"
        }]
      : []),
    ...(ficha?.reporting.criticalFindings
      ? [{
          id: "critical-findings",
          tone: "critical",
          title: "Hallazgos críticos abiertos",
          detail: `${ficha.reporting.criticalFindings} hallazgo(s) crítico(s) requieren resolución antes del cierre.`,
          href: "/audit",
          action: "Abrir auditoría"
        }]
      : []),
    ...(!nextPlan
      ? [{
          id: "missing-plan",
          tone: "review",
          title: "Sin próxima operación planificada",
          detail: "No existe un retiro futuro persistido para esta empresa.",
          href: `/planning/new?client=${client.slug}`,
          action: "Planificar retiro"
        }]
      : [])
  ];

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div><p className="eyebrow">Empresa REP · {client.period}</p><h1>{client.name}</h1><p className="muted">{client.rut} · Ficha REP 360 · {applicableObligations.length} regla(s) aplicables · {monitoredObligations.length} en monitoreo</p></div>
        <div className="period"><span>Estado consolidado</span><strong>{status}</strong></div>
      </header>
      <section className="ficha360Hero">
        <div>
          <p className="eyebrow">Ficha REP 360</p>
          <h2>Qué necesita esta empresa ahora</h2>
          <p className="muted">
            Obligaciones, operación, instalaciones, planificación, evidencia y cierre del período en una sola vista.
          </p>
        </div>
        <div className="ficha360Actions">
          <Link className="buttonLink" href={"/planning/new?client=" + client.slug}>Planificar retiro →</Link>
          <Link className="buttonLink secondary" href="/reporting">Abrir cierre REP →</Link>
          <Link className="buttonLink secondary" href="/evidence">Ver evidencia →</Link>
        </div>
      </section>

      <section className="ficha360Decision">
        <article className={gaps.length ? "ficha360Signal signal-attention" : "ficha360Signal signal-ok"}>
          <span>Estado del período</span>
          <strong>{status}</strong>
          <p>{status === "Monitoreo" ? "No hay rule packs vigentes aplicables al cálculo automático de esta empresa." : gaps.length ? `Resolver ${gaps.length} brecha(s) REP antes del cierre.` : ficha?.reporting.latestCheck?.status === "PASS" ? "Continuar al cierre regulatorio." : "Ejecutar la validación final del cierre."}</p>
        </article>
        <article className="ficha360Signal">
          <span>Evidencia</span>
          <strong>{ficha?.documentCount ?? 0}</strong>
          <p>{ficha?.expiringDocumentCount ? `${ficha.expiringDocumentCount} documento(s) vencen dentro de 60 días.` : "Sin vencimientos próximos detectados."}</p>
        </article>
        <article className={ficha?.reporting.criticalFindings ? "ficha360Signal signal-attention" : "ficha360Signal"}>
          <span>Observaciones abiertas</span>
          <strong>{ficha?.reporting.openFindings ?? 0}</strong>
          <p>{ficha?.reporting.criticalFindings ? `${ficha.reporting.criticalFindings} crítico(s).` : "Sin hallazgos críticos enlazados."}</p>
        </article>
        <article className="ficha360Signal">
          <span>Próxima operación</span>
          <strong>{nextPlan ? new Date(nextPlan.plannedStart).toLocaleDateString("es-CL") : "Sin plan"}</strong>
          <p>{nextPlan ? `${nextPlan.site ?? "Sin sitio"} · ${planStatusLabel(nextPlan.status)}` : "No hay un retiro futuro persistido para esta empresa."}</p>
        </article>
      </section>

      <section className="repCockpit panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Control REP</p>
            <h3>Qué requiere acción antes de seguir operando.</h3>
          </div>
          <Link className="buttonLink secondary" href={"/planning?company=" + client.slug + "&summary=1"}>
            Abrir calendario REP →
          </Link>
        </div>
        {accountAlerts.length ? (
          <div className="repAlertList">
            {accountAlerts.slice(0, 8).map((alert, index) => (
              <article className={"repAlert repAlert-" + alert.tone} key={alert.id}>
                <span className="repAlertIndex">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
                <Link href={alert.href}>{alert.action} →</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin alertas accionables derivadas de los datos actuales.</strong>
            <p>Esto no reemplaza la validación formal del cierre REP.</p>
          </div>
        )}
      </section>

      <section className="ficha360Identity panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Identidad corporativa</p>
            <h3>{ficha?.organization.legalName ?? client.name}</h3>
          </div>
          <span className="ficha360Updated">
            Alta {ficha?.organization.createdAt ? new Date(ficha.organization.createdAt).toLocaleDateString("es-CL") : "no informada"}
          </span>
        </div>
        <div className="ficha360Meta">
          <div><span>RUT</span><strong>{client.rut}</strong></div>
          <div><span>Rol REP</span><strong>{activeRoles.length ? activeRoles.map((role) => repRoleLabel(role.role)).join(" · ") : "No informado"}</strong></div>
          <div><span>Instalaciones</span><strong>{ficha?.sites.length ?? 0}</strong></div>
          <div><span>Períodos con obligación</span><strong>{ficha?.periods.length ?? 0}</strong></div>
          <div><span>Operaciones registradas</span><strong>{ficha?.collectionCount ?? 0}</strong></div>
          <div><span>Última operación</span><strong>{ficha?.lastCollectionAt ? new Date(ficha.lastCollectionAt).toLocaleDateString("es-CL") : "Sin historial"}</strong></div>
          <div><span>Relaciones B2B</span><strong>{ficha?.relationships.length ?? 0}</strong></div>
          <div><span>Cierre enlazado</span><strong>{ficha?.reporting.latestReport ? "Disponible" : "Aún no generado"}</strong></div>
        </div>
      </section>

      <section className="ficha360BusinessGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Instalaciones</p>
              <h3>Dónde opera esta cuenta.</h3>
            </div>
            <span className="ficha360Updated">{ficha?.sites.length ?? 0} sitio(s)</span>
          </div>
          {ficha?.sites.length ? (
            <div className="ficha360AccountList">
              {ficha.sites.map((site) => (
                <div key={site.id}>
                  <div>
                    <strong>{site.name}</strong>
                    <p>{[site.address, site.commune, site.region].filter(Boolean).join(" · ") || "Ubicación no informada"}</p>
                  </div>
                  <div>
                    <span>{site.collectionCount} operación(es)</span>
                    <b>{site.nextPlanAt ? `Próximo ${new Date(site.nextPlanAt).toLocaleDateString("es-CL")}` : "Sin retiro planificado"}</b>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState compactEmpty"><strong>Sin instalaciones enlazadas.</strong><p>La empresa existe canónicamente, pero aún no tiene sitios registrados.</p></div>
          )}
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Planificación B2B</p>
              <h3>Próximos servicios operacionales.</h3>
            </div>
            <Link className="buttonLink secondary" href={"/planning?&q=" + encodeURIComponent(client.name)}>Ver calendario →</Link>
          </div>
          {ficha?.upcomingPlans.length ? (
            <div className="ficha360AccountList">
              {ficha.upcomingPlans.slice(0, 5).map((plan) => (
                <div key={plan.id}>
                  <div>
                    <strong>{new Date(plan.plannedStart).toLocaleDateString("es-CL")} · {plan.stream.replaceAll("_", " ")}</strong>
                    <p>{plan.site ?? "Sin sitio"}{plan.counterparty ? ` · ${plan.counterparty}` : ""}</p>
                  </div>
                  <div>
                    <span>{planStatusLabel(plan.status)}</span>
                    <b>{plan.estimatedQuantity !== null && plan.estimatedUnit ? `${fmt(plan.estimatedQuantity)} ${plan.estimatedUnit}` : "Cantidad no informada"}</b>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState compactEmpty"><strong>Sin servicios futuros registrados.</strong><p>No se inventa una planificación. Crea el próximo retiro cuando corresponda.</p><Link className="buttonLink" href={"/planning/new?client=" + client.slug}>Planificar retiro →</Link></div>
          )}
        </article>
      </section>

      <section className="panel ficha360EnterpriseContext">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Relación empresarial</p>
            <h3>Roles, responsables, contratos y cobertura de la cuenta.</h3>
          </div>
        </div>
        <div className="ficha360EnterpriseColumns">
          <div>
            <span className="label">Roles REP</span>
            {ficha?.roles.length ? ficha.roles.map((role) => (
              <p key={role.role}><strong>{repRoleLabel(role.role)}</strong>{role.validFrom ? ` · desde ${new Date(role.validFrom).toLocaleDateString("es-CL")}` : ""}{role.validTo ? ` · hasta ${new Date(role.validTo).toLocaleDateString("es-CL")}` : ""}</p>
            )) : <p className="muted">Rol REP no informado.</p>}
          </div>
          <div>
            <span className="label">Relaciones canónicas</span>
            {ficha?.relationships.length ? ficha.relationships.slice(0, 6).map((relation) => (
              <p key={relation.id}><strong>{relationshipLabel(relation.relationshipType)}</strong> · {relation.organizationName} · {relation.organizationRut}</p>
            )) : <p className="muted">Sin relaciones B2B enlazadas.</p>}
          </div>
          <div>
            <span className="label">Cobertura REP</span>
            <p><strong>Instalaciones</strong> · {ficha?.coverage.sites === "available" ? "Disponible" : "Sin información enlazada"}</p>
            <p><strong>Relaciones REP</strong> · {ficha?.coverage.relationships === "available" ? "Disponible" : "Sin relaciones enlazadas"}</p>
            <p><strong>Planificación de retiros</strong> · {ficha?.coverage.planning === "available" ? "Disponible" : ficha?.coverage.planning === "source_unavailable" ? "Fuente no disponible" : "Sin retiros futuros"}</p>
          </div>
        </div>
      </section>

      <section className="panel ficha360Core">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Productos REP</p>
            <h3>Avance por producto y brechas que requieren acción.</h3>
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
                    <strong>{item.label}</strong><span className={item.regulatoryMode === "APPLY" ? "ruleMode ruleModeApply" : "ruleMode"}>{item.regulatoryMode === "APPLY" ? "REGLA VIGENTE" : "MONITOREO"} · {item.regulatoryVersion}</span>
                    <span>{pct.toFixed(1)}% de avance</span>
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
        <summary>Ver detalle operacional y circularidad</summary>
        <section className="clientDualView">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Circularidad</p>
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
              <h3>Últimos movimientos</h3>
            </div>
            <Link className="buttonLink secondary" href="/ledger">Ver trazabilidad →</Link>
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
              <p className="eyebrow">Cierre REP</p>
              <h3>Estado del período</h3>
            </div>
            <Link className="buttonLink secondary" href="/reporting">Abrir cierre REP →</Link>
          </div>
          <div className="ficha360Meta">
            <div><span>Último reporte</span><strong>{ficha?.reporting.latestReport?.status ?? "No informado"}</strong></div>
            <div><span>Última validación</span><strong>{ficha?.reporting.latestCheck?.status ?? "No ejecutada"}</strong></div>
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
