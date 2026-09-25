import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { repRegulatoryUniverse } from "@/lib/rep";
import { repRegulatoryMilestones, repRulePacks } from "@/lib/rep-rule-packs";
import { getRecyclaSession, requireWriteSession } from "@/lib/auth/server";
import {
  listPendingRepClassifications,
  reviewRepClassification,
  type ClassificationEntityType
} from "@/lib/rep-classification-review";
import type { PriorityStream } from "@/lib/rep";

async function reviewClassificationAction(formData: FormData) {
  "use server";

  const session = await requireWriteSession();
  const entityType = String(formData.get("entityType") ?? "") as ClassificationEntityType;
  const entityId = String(formData.get("entityId") ?? "");
  const stream = String(formData.get("stream") ?? "") as PriorityStream;
  const categoryId = String(formData.get("categoryId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!["MARKET_INTRODUCTION", "WASTE_OPERATION", "COLLECTION"].includes(entityType)) {
    redirect("/regulatory?classification=invalid");
  }
  if (!entityId || !repRulePacks[stream] || !categoryId) {
    redirect("/regulatory?classification=invalid");
  }

  const ok = await reviewRepClassification({
    entityType,
    entityId,
    stream,
    categoryId,
    actorRef: session.session?.user?.email ?? null,
    note
  });

  revalidatePath("/regulatory");
  revalidatePath("/evidence");
  revalidatePath("/ledger");
  redirect("/regulatory?classification=" + (ok ? "resolved" : "not_found"));
}

export default async function RegulatoryRadarPage() {
  const operationalProducts = repRegulatoryUniverse.filter((item) => item.operational);
  const monitoredProducts = repRegulatoryUniverse.filter((item) => !item.operational);
  const [pendingClassifications, authState] = await Promise.all([
    listPendingRepClassifications(60),
    getRecyclaSession()
  ]);
  const canWrite = authState.roles.some((role) =>
    role === "operator" || role === "compliance" || role === "admin"
  );

  const operational = operationalProducts.length;
  const radarOnly = monitoredProducts.length;
  const rulePacks = Object.values(repRulePacks);
  const enforceablePacks = rulePacks.filter((item) => item.enginePolicy === "APPLY");

  return (
    <AppShell active="/regulatory">
      <header className="topbar">
        <div>
          <p className="eyebrow">Normativa</p>
          <h1>Qué productos requieren atención ahora</h1>
          <p className="muted">Distingue lo que ya está operativo de lo que sólo debemos monitorear para anticipar cambios.</p>
        </div>
        <div className="period"><span>Productos monitoreados</span><strong>{repRegulatoryUniverse.length}</strong></div>
      </header>

      <section className="pageGuide">
        <article>
          <span>Qué importa</span>
          <strong>Qué ya está operativo</strong>
          <p>Estos productos tienen reglas y flujo activo dentro de Recycla.</p>
        </article>
        <article>
          <span>Qué observar</span>
          <strong>Qué puede cambiar después</strong>
          <p>El radar mantiene productos fuera del flujo operativo sin perderlos de vista.</p>
        </article>
        <article>
          <span>Cómo usarlo</span>
          <strong>Actuar sólo cuando corresponda</strong>
          <p>Una novedad normativa no se convierte automáticamente en una obligación operacional.</p>
        </article>
      </section>

      <section className="decisionStrip" aria-label="Cobertura regulatoria">
        <article>
          <span>Productos prioritarios</span>
          <strong>{repRegulatoryUniverse.length}</strong>
          <p>Total visible entre operación y monitoreo</p>
        </article>
        <article>
          <span>Productos operacionales</span>
          <strong>{operational}</strong>
          <p>Con flujo activo dentro de Recycla</p>
        </article>
        <article>
          <span>Sólo monitoreo</span>
          <strong>{radarOnly}</strong>
          <p>Observados sin ampliar el alcance operativo</p>
        </article>
      </section>

      <section className="decisionStrip" aria-label="Aplicabilidad regulatoria">
        <article>
          <span>Rule packs</span>
          <strong>{rulePacks.length}</strong>
          <p>Versionados por producto prioritario</p>
        </article>
        <article>
          <span>Aplicables al motor</span>
          <strong>{enforceablePacks.length}</strong>
          <p>Sólo normas vigentes y verificadas</p>
        </article>
        <article>
          <span>Monitoreo regulatorio</span>
          <strong>{rulePacks.length - enforceablePacks.length}</strong>
          <p>No alteran cálculos automáticos</p>
        </article>
      </section>

      <section className="panel classificationQueue">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Clasificación regulatoria</p>
            <h3>Resolver excepciones antes de acreditar.</h3>
          </div>
          <b>{pendingClassifications.length}</b>
        </div>

        {pendingClassifications.length ? (
          <div className="classificationQueueList">
            {pendingClassifications.map((item) => {
              const pack = item.stream ? repRulePacks[item.stream] : null;
              return (
                <article key={item.entityType + ":" + item.entityId}>
                  <div>
                    <span>{item.entityType.replaceAll("_", " ")}</span>
                    <strong>{item.priorityProduct}</strong>
                    <p>
                      {new Date(item.occurredAt).toLocaleDateString("es-CL")}
                      {item.rawCategory ? " · " + item.rawCategory : ""}
                      {item.quantity !== null ? " · " + item.quantity + " " + (item.unit ?? "") : ""}
                    </p>
                    <small>{item.basis ?? "Clasificación pendiente."}</small>
                  </div>

                  {pack && canWrite ? (
                    <form action={reviewClassificationAction} className="classificationReviewForm">
                      <input type="hidden" name="entityType" value={item.entityType} />
                      <input type="hidden" name="entityId" value={item.entityId} />
                      <input type="hidden" name="stream" value={item.stream ?? ""} />
                      <label>
                        <span>Categoría</span>
                        <select name="categoryId" required defaultValue="">
                          <option value="" disabled>Seleccionar</option>
                          {pack.categories.map((category) => (
                            <option value={category.id} key={category.id}>{category.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Nota</span>
                        <input name="note" placeholder="Evidencia o criterio de revisión" />
                      </label>
                      <button type="submit">Confirmar clasificación</button>
                    </form>
                  ) : (
                    <div className="classificationReviewState">
                      <strong>{pack ? "REVISIÓN REQUERIDA" : "PRODUCTO NO MAPEADO"}</strong>
                      <span>{pack ? pack.version : "Corregir fuente"}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin clasificaciones regulatorias pendientes.</strong>
            <p>Las filas reconocidas quedaron resueltas por taxonomía determinística o revisión humana.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Calendario regulatorio</p>
            <h3>Hitos oficiales sin inventar fechas.</h3>
          </div>
          <b>{repRegulatoryMilestones.length}</b>
        </div>
        <div className="regulatoryMatrix">
          {repRegulatoryMilestones.map((item, index) => (
            <article className="regulatoryRow operational" key={item.id}>
              <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="regProduct">
                <strong>{item.title}</strong>
                <span>{item.status === "SCHEDULED" ? "PROGRAMADO" : "FECHA PENDIENTE"}</span>
              </div>
              <div className="regStage">
                <span>Ventana oficial</span>
                <strong>{item.windowLabel}</strong>
              </div>
              <div className="regMilestone">
                <span>Motor</span>
                <strong>{item.status === "SCHEDULED" ? "CALENDARIZABLE" : "NO HARDcode"}</strong>
              </div>
              <p>{item.sourceTitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Operativo ahora</p>
            <h3>Productos que forman parte del flujo actual</h3>
          </div>
          <b>{operationalProducts.length}</b>
        </div>
        <div className="regulatoryMatrix">
          {operationalProducts.map((item, index) => (
            <article className="regulatoryRow operational" key={item.id}>
              <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="regProduct">
                <strong>{item.label}</strong>
                <span>OPERACIONAL</span>
              </div>
              <div className="regStage">
                <span>Etapa</span>
                <strong>{item.stage}</strong>
              </div>
              <div className="regMilestone">
                <span>Próximo hito</span>
                <strong>{item.milestone}</strong>
              </div>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <details className="secondaryDetail">
        <summary>Ver productos en monitoreo ({monitoredProducts.length})</summary>
        <section className="regulatoryMatrix">
          {monitoredProducts.map((item, index) => (
            <article className="regulatoryRow radarOnly" key={item.id}>
              <span className="regIndex">{String(index + 1).padStart(2, "0")}</span>
              <div className="regProduct">
                <strong>{item.label}</strong>
                <span>MONITOREO</span>
              </div>
              <div className="regStage">
                <span>Etapa</span>
                <strong>{item.stage}</strong>
              </div>
              <div className="regMilestone">
                <span>Hito observado</span>
                <strong>{item.milestone}</strong>
              </div>
              <p>{item.note}</p>
            </article>
          ))}
        </section>
      </details>

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">Regla operacional</p>
          <h3>Cada producto mantiene reglas propias por período.</h3>
          <p className="muted">Una etapa regulatoria no se debe inferir desde la existencia de datos operacionales. El motor debe saber si el producto está en metas vigentes, implementación, elaboración de decreto o solo monitoreo.</p>
        </article>
        <article className="panel">
          <p className="eyebrow">Alcance actual</p>
          <h3>Lo monitoreado no entra al flujo hasta que realmente corresponda.</h3>
          <p className="muted">Se mantienen visibles para anticipar cambios sin convertir la operación diaria en un sistema genérico.</p>
        </article>
      </section>
    </AppShell>
  );
}
