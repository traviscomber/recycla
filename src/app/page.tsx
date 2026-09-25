import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getRepDatabaseStatus, listRepClients } from "@/lib/rep-repository";
import { listComplianceFindings } from "@/lib/compliance-findings";
import { getStateSyncOverview } from "@/lib/state-ingestion";
import { listRecentSnapshots } from "@/lib/state-snapshots";
import { buildComplianceWorkbench } from "@/lib/workbench";
import { buildComplianceAutopilot } from "@/lib/compliance-autopilot";
import { evaluateComplianceReadiness } from "@/lib/compliance-engine";
import { listEvidenceChains } from "@/lib/evidence-chain";
import { listGestorIntelligence } from "@/lib/gestor-intelligence";

export const dynamic = "force-dynamic";

function autopilotSourceLabel(source: string) {
  const labels: Record<string, string> = {
    COMPLIANCE_GATE: "Control de cierre",
    EVIDENCE_CHAIN: "Evidencia",
    GESTOR_INTELLIGENCE: "Gestor / destino",
    FINDING: "Observación"
  };
  return labels[source] ?? source.replaceAll("_", " ").toLocaleLowerCase("es-CL");
}

function autopilotActionLabel(href: string) {
  if (href.startsWith("/reporting")) return "Abrir cierre";
  if (href.startsWith("/audit")) return "Revisar";
  if (href.startsWith("/evidence")) return "Completar evidencia";
  if (href.startsWith("/state-intelligence")) return "Revisar fuente";
  return "Abrir";
}

function clientState(client: Awaited<ReturnType<typeof listRepClients>>[number]) {
  const applicable = client.obligations.filter((item) => item.regulatoryMode === "APPLY");
  if (!applicable.length) return { label: "Monitoreo", tone: "review", count: 0 };

  const gaps = applicable.filter(
    (item) => item.accreditable - item.obligation < 0
  );
  const evidenceGaps = applicable.filter(
    (item) => item.eligible - item.evidenceComplete > 0
  );

  if (gaps.length) return { label: "Atención", tone: "critical", count: gaps.length };
  if (evidenceGaps.length) return { label: "Evidencia", tone: "warning", count: evidenceGaps.length };
  return { label: "Sin excepción", tone: "ok", count: 0 };
}

export default async function Home() {
  const [
    stateSyncs,
    stateSnapshots,
    databaseStatus,
    clients,
    complianceFindings,
    evidenceChains,
    complianceGates,
    gestores
  ] = await Promise.all([
    getStateSyncOverview(),
    listRecentSnapshots(100),
    getRepDatabaseStatus(),
    listRepClients(),
    listComplianceFindings("recycla-os", 100),
    listEvidenceChains(100),
    evaluateComplianceReadiness(),
    listGestorIntelligence("recycla-os", 100)
  ]);

  const workItems = buildComplianceWorkbench({
    clients,
    findings: complianceFindings,
    snapshots: stateSnapshots
  });

  const autopilotActions = buildComplianceAutopilot({
    findings: complianceFindings,
    chains: evidenceChains,
    gates: complianceGates,
    gestores
  });
  const autopilotBlockers = autopilotActions.filter((item) => item.priority === "BLOCKER");

  const criticalItems = workItems.filter((item) => item.priority === "critical");
  const warningItems = workItems.filter((item) => item.priority === "warning");
  const reviewItems = workItems.filter((item) => item.priority === "review");
  const clientStates = clients.map((client) => ({
    client,
    state: clientState(client)
  }));
  const cleanClients = clientStates.filter((item) => item.state.tone === "ok").length;

  const producerSync = stateSyncs.find(
    (sync) => sync.sourceId === "retc-priority-products"
  );
  const actorSnapshots = stateSnapshots.filter((snapshot) =>
    snapshot.subjectType.startsWith("rep_actor_")
  );
  const hasOperationalClients = clients.length > 0;

  return (
    <AppShell active="/">
      <header className="topbar">
        <div>
          <p className="eyebrow">Inicio</p>
          <h1>Control REP para tu empresa</h1>
          <p className="muted">
            Consolida obligaciones, operación, evidencia y cierre regulatorio de cada empresa sujeta a REP.
          </p>
        </div>
        <div className="period">
          <span>{hasOperationalClients ? "Pendientes de hoy" : "Estado"}</span>
          <strong>{hasOperationalClients ? workItems.length : "INICIAL"}</strong>
        </div>
      </header>

      <section className="friendlyFlow" aria-label="Cómo funciona Recycla REP OS">
        <article>
          <span>01</span>
          <div>
            <strong>Empresa y obligación</strong>
            <p>Define el actor REP, período, productos prioritarios, reglas aplicables y metas verificadas.</p>
          </div>
        </article>
        <article>
          <span>02</span>
          <div>
            <strong>Operación y evidencia</strong>
            <p>Conecta retiros, pesajes, lotes, gestores, valorización y documentos con trazabilidad por empresa.</p>
          </div>
        </article>
        <article>
          <span>03</span>
          <div>
            <strong>Cierre corporativo y auditoría</strong>
            <p>Resuelve brechas, deja evidencia defendible y prepara el reporte de cumplimiento de la empresa.</p>
          </div>
        </article>
      </section>

      {clients.length === 0 ? (
        <section className="panel firstRunPanel">
          <div>
            <p className="eyebrow">Tu punto de partida</p>
            <h2>Aún no hay clientes REP operacionales cargados.</h2>
            <p>
              Puedes revisar las empresas publicadas por Recycla, pero todavía no cuentan como cartera activa
              hasta que tengan organización, período y obligaciones REP asociadas.
            </p>
          </div>
          <div className="firstRunActions">
            <Link className="buttonLink" href="/clientes">Ver clientes →</Link>
            <Link className="buttonLink secondary" href="/state-intelligence">Revisar fuentes oficiales →</Link>
          </div>
        </section>
      ) : null}

      {databaseStatus.state !== "ready" ? (
        <section className={`systemNotice notice-${databaseStatus.state}`}>
          <div>
            <p className="eyebrow">Core operacional REP</p>
            <h3>
              {databaseStatus.state === "schema_missing"
                ? "Esquema operativo incompleto"
                : databaseStatus.state === "unavailable"
                  ? "Base operacional temporalmente no disponible"
                  : "Persistencia operacional no configurada"}
            </h3>
            <p>{databaseStatus.detail}</p>
          </div>
          <span>ATENCIÓN TÉCNICA</span>
        </section>
      ) : null}

      {hasOperationalClients ? (
        <>
          <section className="panel autopilotPanel">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Siguiente paso recomendado</p>
                <h3>Haz primero lo que más impacta el cierre.</h3>
              </div>
              <span className="workbenchUpdated">Priorizado desde datos reales · sin inventar cumplimiento</span>
            </div>

            <div className="autopilotSummary">
              <article>
                <span>Bloqueos</span>
                <strong>{autopilotBlockers.length}</strong>
              </article>
              <article>
                <span>Pendientes</span>
                <strong>{autopilotActions.length}</strong>
              </article>
              <article>
                <span>Operaciones trazables</span>
                <strong>{evidenceChains.length}</strong>
              </article>
            </div>

            {autopilotActions.length ? (
              <div className="autopilotList">
                {autopilotActions.slice(0, 6).map((action, index) => (
                  <article className={"autopilotItem autopilot-" + action.priority.toLowerCase()} key={action.id}>
                    <span className="autopilotIndex">{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <small>{action.priority === "BLOCKER" ? "BLOQUEO" : action.priority === "ACTION" ? "ACCIÓN" : "REVISIÓN"} · {autopilotSourceLabel(action.source)}</small>
                      <strong>{action.title}</strong>
                      <p>{action.detail}</p>
                    </div>
                    <div className="autopilotAffected">
                      <span>Afectados</span>
                      <strong>{action.affected}</strong>
                    </div>
                    <Link className="buttonLink secondary" href={action.href}>
                      {autopilotActionLabel(action.href)} →
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyState compactEmpty">
                <strong>Sin acciones derivadas de los controles actuales.</strong>
                <p>El cierre final mantiene su propia validación antes de habilitar la exportación.</p>
              </div>
            )}
          </section>

          <section className="workbenchSignals" aria-label="Prioridad operacional">
            <article className={criticalItems.length ? "workbenchSignal signal-critical" : "workbenchSignal"}>
              <span>Críticas</span>
              <strong>{criticalItems.length}</strong>
              <p>{criticalItems.length ? "Bloquean acreditación o cierre." : "Sin bloqueos críticos detectados."}</p>
            </article>
            <article className={warningItems.length ? "workbenchSignal signal-warning" : "workbenchSignal"}>
              <span>Requieren acción</span>
              <strong>{warningItems.length}</strong>
              <p>{warningItems.length ? "Evidencia o controles pendientes." : "Sin acciones operativas pendientes."}</p>
            </article>
            <article className={reviewItems.length ? "workbenchSignal signal-review" : "workbenchSignal"}>
              <span>Revisión humana</span>
              <strong>{reviewItems.length}</strong>
              <p>{reviewItems.length ? "Fuentes externas por validar." : "Sin evidencia externa pendiente."}</p>
            </article>
            <article className="workbenchSignal">
              <span>Clientes sin excepción</span>
              <strong>{cleanClients}/{clients.length}</strong>
              <p>Calculado por producto, sin mezclar kg y litros.</p>
            </article>
          </section>

          <section className="panel workbenchQueue">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Pendientes del día</p>
                <h3>Qué requiere tu atención, en orden.</h3>
              </div>
              <span className="workbenchUpdated">Calculado desde datos persistidos</span>
            </div>

            {workItems.length ? (
              <div className="workbenchList">
                {workItems.slice(0, 12).map((item) => (
                  <article className={`workbenchItem priority-${item.priority}`} key={item.id}>
                    <div className="workbenchPriority">
                      <i />
                      <span>{item.priority === "critical" ? "CRÍTICA" : item.priority === "warning" ? "ACCIÓN" : "REVISAR"}</span>
                    </div>
                    <div className="workbenchBody">
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                      <small>
                        {item.subject} · {item.context}
                        {item.sourceAt ? ` · ${new Date(item.sourceAt).toLocaleDateString("es-CL")}` : ""}
                      </small>
                    </div>
                    <Link className="buttonLink secondary" href={item.href}>
                      {item.actionLabel} →
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="emptyState">
                <strong>No hay excepciones abiertas derivadas de los datos actuales.</strong>
                <p>
                  Esto no equivale por sí solo a cumplimiento final. El cierre regulatorio mantiene sus propios gates.
                </p>
                <Link className="buttonLink" href="/reporting">Abrir cierre REP →</Link>
              </div>
            )}
          </section>

        </>
      ) : null}

      <section className={hasOperationalClients ? "workbenchGrid" : "workbenchGrid workbenchGridSingle"}>
        {hasOperationalClients ? (
          <article className="panel">
            <div className="panelHead">
              <div>
                <p className="eyebrow">Empresas REP</p>
                <h3>Estado REP por empresa</h3>
              </div>
              <Link className="buttonLink secondary" href="/clientes">Ver todos →</Link>
            </div>
            <div className="workbenchClients">
              {clientStates.slice(0, 8).map(({ client, state }) => (
                <Link href={`/clientes/${client.slug}`} key={`${client.slug}-${client.period}`}>
                  <div>
                    <strong>{client.name}</strong>
                    <span>{client.rut} · {client.period}</span>
                  </div>
                  <b className={`clientState state-${state.tone}`}>
                    {state.label}{state.count ? ` · ${state.count}` : ""}
                  </b>
                </Link>
              ))}
            </div>
          </article>
        ) : null}

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Fuentes oficiales</p>
              <h3>Información externa conectada</h3>
            </div>
            <Link className="buttonLink secondary" href="/state-intelligence">Revisar fuentes →</Link>
          </div>
          <div className="workbenchPulse">
            <div>
              <span>Registros productor RETC</span>
              <strong>{producerSync?.rowCount?.toLocaleString("es-CL") ?? "—"}</strong>
              <p>{producerSync?.sourceYear ? `Fuente ${producerSync.sourceYear}` : "Sin sync confirmado"}</p>
            </div>
            <div>
              <span>Referencias de actores</span>
              <strong>{actorSnapshots.length}</strong>
              <p>Evidencia externa persistida</p>
            </div>
            <div>
              <span>Observaciones abiertas</span>
              <strong>{complianceFindings.filter((finding) => finding.status === "open").length}</strong>
              <p>Detectadas desde datos persistidos</p>
            </div>
          </div>
        </article>
      </section>

      {hasOperationalClients ? (
      <section className="panel workbenchPaths">
        <div>
          <p className="eyebrow">Control REP</p>
          <h3>Opera por excepción y entra al detalle sólo cuando una empresa lo requiera.</h3>
        </div>
        <div className="workbenchPathLinks">
          <Link href="/reporting"><span>Cierre REP</span><strong>Preparar y validar →</strong></Link>
          <Link href="/audit"><span>Auditoría</span><strong>Resolver observaciones →</strong></Link>
          <Link href="/evidence"><span>Evidencia</span><strong>Completar respaldo →</strong></Link>
          <Link href="/ledger"><span>Trazabilidad</span><strong>Seguir historial →</strong></Link>
        </div>
      </section>
      ) : null}
    </AppShell>
  );
}
