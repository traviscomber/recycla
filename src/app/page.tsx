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

export const dynamic = "force-dynamic";

function clientState(client: Awaited<ReturnType<typeof listRepClients>>[number]) {
  const gaps = client.obligations.filter(
    (item) => item.accreditable - item.obligation < 0
  );
  const evidenceGaps = client.obligations.filter(
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
    complianceGates
  ] = await Promise.all([
    getStateSyncOverview(),
    listRecentSnapshots(100),
    getRepDatabaseStatus(),
    listRepClients(),
    listComplianceFindings("recycla-os", 100),
    listEvidenceChains(100),
    evaluateComplianceReadiness()
  ]);

  const workItems = buildComplianceWorkbench({
    clients,
    findings: complianceFindings,
    snapshots: stateSnapshots
  });

  const autopilotActions = buildComplianceAutopilot({
    findings: complianceFindings,
    chains: evidenceChains,
    gates: complianceGates
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

  return (
    <AppShell active="/">
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance Workbench</p>
          <h1>Qué resolver ahora</h1>
          <p className="muted">
            Excepciones reales primero. Abre el contexto completo sólo cuando lo necesitas.
          </p>
        </div>
        <div className="period">
          <span>Acciones abiertas</span>
          <strong>{workItems.length}</strong>
        </div>
      </header>

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

      <section className="panel autopilotPanel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Compliance Autopilot</p>
            <h3>Qué hacer primero para acercar el cierre a una condición defendible.</h3>
          </div>
          <span className="workbenchUpdated">Motor determinístico · sin inferir cumplimiento</span>
        </div>

        <div className="autopilotSummary">
          <article>
            <span>Bloqueantes</span>
            <strong>{autopilotBlockers.length}</strong>
          </article>
          <article>
            <span>Acciones priorizadas</span>
            <strong>{autopilotActions.length}</strong>
          </article>
          <article>
            <span>Cadenas físicas</span>
            <strong>{evidenceChains.length}</strong>
          </article>
        </div>

        {autopilotActions.length ? (
          <div className="autopilotList">
            {autopilotActions.slice(0, 6).map((action, index) => (
              <article className={"autopilotItem autopilot-" + action.priority.toLowerCase()} key={action.id}>
                <span className="autopilotIndex">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{action.priority} · {action.source.replaceAll("_", " ")}</small>
                  <strong>{action.title}</strong>
                  <p>{action.detail}</p>
                </div>
                <div className="autopilotAffected">
                  <span>Afectados</span>
                  <strong>{action.affected}</strong>
                </div>
                <Link className="buttonLink secondary" href={action.href}>
                  {action.actionLabel} →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin acciones derivadas de los controles actuales.</strong>
            <p>Esto no reemplaza el pre-check final ni constituye una declaración de cumplimiento.</p>
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
            <p className="eyebrow">Cola de trabajo</p>
            <h3>Ordenada por impacto, no por módulo.</h3>
          </div>
          <span className="workbenchUpdated">Datos persistidos · vista derivada</span>
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

      <section className="workbenchGrid">
        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Cartera</p>
              <h3>Estado por cliente</h3>
            </div>
            <Link className="buttonLink secondary" href="/clientes">Ver todos →</Link>
          </div>
          {clientStates.length ? (
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
          ) : (
            <div className="emptyState compactEmpty">
              <strong>Sin clientes REP persistidos.</strong>
              <p>La cartera aparecerá cuando existan organizaciones con obligaciones reales.</p>
            </div>
          )}
        </article>

        <article className="panel">
          <div className="panelHead">
            <div>
              <p className="eyebrow">Pulso de fuentes</p>
              <h3>Contexto estatal disponible</h3>
            </div>
            <Link className="buttonLink secondary" href="/state-intelligence">Abrir fuentes →</Link>
          </div>
          <div className="workbenchPulse">
            <div>
              <span>Registros productor RETC</span>
              <strong>{producerSync?.rowCount?.toLocaleString("es-CL") ?? "—"}</strong>
              <p>{producerSync?.sourceYear ? `Fuente ${producerSync.sourceYear}` : "Sin sync confirmado"}</p>
            </div>
            <div>
              <span>Snapshots actores</span>
              <strong>{actorSnapshots.length}</strong>
              <p>Evidencia externa persistida</p>
            </div>
            <div>
              <span>Hallazgos abiertos</span>
              <strong>{complianceFindings.filter((finding) => finding.status === "open").length}</strong>
              <p>Desde reconciliación persistida</p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel workbenchPaths">
        <div>
          <p className="eyebrow">Cuando necesitas profundidad</p>
          <h3>El Workbench decide dónde entrar.</h3>
        </div>
        <div className="workbenchPathLinks">
          <Link href="/reporting"><span>Cierre REP</span><strong>Preparar y validar →</strong></Link>
          <Link href="/audit"><span>Audit Room</span><strong>Resolver hallazgos →</strong></Link>
          <Link href="/evidence"><span>Evidence Graph</span><strong>Completar respaldo →</strong></Link>
          <Link href="/ledger"><span>REP Ledger</span><strong>Seguir lineage →</strong></Link>
        </div>
      </section>
    </AppShell>
  );
}
