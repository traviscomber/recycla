import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireWriteSession } from "@/lib/auth/server";
import { db, hasDatabase } from "@/lib/db";
import { priorityStreams, type PriorityStream } from "@/lib/rep";

export const dynamic = "force-dynamic";

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

type SiteOption = {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
};

async function listPlanningOptions() {
  if (!hasDatabase()) {
    return { organizations: [] as OrganizationOption[], sites: [] as SiteOption[] };
  }

  const sql = db();
  const organizations = await sql<OrganizationOption[]>`
    select
      id::text as id,
      display_name as name,
      slug
    from organizations
    order by display_name asc
  `;

  const sites = await sql<SiteOption[]>`
    select
      s.id::text as id,
      s.organization_id::text as "organizationId",
      o.display_name as "organizationName",
      s.name
    from sites s
    join organizations o on o.id = s.organization_id
    order by o.display_name asc, s.name asc
  `;

  return { organizations, sites };
}

async function createPlanAction(formData: FormData) {
  "use server";

  await requireWriteSession();

  if (!hasDatabase()) {
    redirect("/planning/new?result=db_unavailable");
  }

  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "").trim() || null;
  const stream = String(formData.get("stream") ?? "").trim() as PriorityStream;
  const plannedStart = String(formData.get("plannedStart") ?? "").trim();
  const plannedEnd = String(formData.get("plannedEnd") ?? "").trim() || null;
  const rawQuantity = String(formData.get("quantity") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const vehicleRef = String(formData.get("vehicleRef") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const validStreams = new Set(priorityStreams.map((item) => item.id));
  const validUnits = new Set(["kg", "l"]);

  if (!organizationId || !validStreams.has(stream) || !plannedStart || !validUnits.has(unit)) {
    redirect("/planning/new?result=invalid");
  }

  const quantity = rawQuantity ? Number(rawQuantity.replace(",", ".")) : null;
  if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
    redirect("/planning/new?result=invalid");
  }

  const start = new Date(`${plannedStart}T12:00:00Z`);
  const end = plannedEnd ? new Date(`${plannedEnd}T12:00:00Z`) : null;
  if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end < start))) {
    redirect("/planning/new?result=invalid");
  }

  const sql = db();
  const schema = await sql<Array<{ plans: string | null }>>`
    select to_regclass('public.collection_plans')::text as plans
  `;

  if (!schema[0]?.plans) {
    redirect("/planning/new?result=schema_missing");
  }

  const organization = await sql<Array<{ id: string }>>`
    select id::text as id
    from organizations
    where id = ${organizationId}::uuid
    limit 1
  `;

  if (!organization.length) {
    redirect("/planning/new?result=invalid_client");
  }

  if (siteId) {
    const site = await sql<Array<{ id: string }>>`
      select id::text as id
      from sites
      where id = ${siteId}::uuid
        and organization_id = ${organizationId}::uuid
      limit 1
    `;
    if (!site.length) {
      redirect("/planning/new?result=invalid_site");
    }
  }

  await sql`
    insert into collection_plans (
      organization_id,
      site_id,
      stream,
      planned_start,
      planned_end,
      estimated_quantity,
      estimated_unit,
      status,
      counterparty_name,
      vehicle_ref,
      notes
    )
    values (
      ${organizationId}::uuid,
      ${siteId}::uuid,
      ${stream}::priority_stream,
      ${start.toISOString()}::timestamptz,
      ${end ? end.toISOString() : null}::timestamptz,
      ${quantity},
      ${unit},
      'PLANNED'::collection_plan_status,
      ${counterparty},
      ${vehicleRef},
      ${notes}
    )
  `;

  revalidatePath("/planning");
  redirect("/planning?created=1");
}

function messageForResult(result?: string) {
  if (!result) return null;
  if (result === "schema_missing") {
    return "La capa de planificación todavía no está habilitada en la base de datos productiva.";
  }
  if (result === "db_unavailable") return "La base de datos no está disponible en este entorno.";
  if (result === "invalid_client") return "El cliente seleccionado ya no está disponible.";
  if (result === "invalid_site") return "El sitio no pertenece al cliente seleccionado.";
  return "Revisa cliente, producto, fechas y cantidad antes de guardar.";
}

export default async function NewPlanningPage({
  searchParams
}: {
  searchParams: Promise<{ result?: string; client?: string }>;
}) {
  const params = await searchParams;
  const { organizations, sites } = await listPlanningOptions();
  const message = messageForResult(params.result);
  const selectedOrganization = params.client
    ? organizations.find((organization) => organization.slug === params.client)
    : undefined;

  return (
    <AppShell active="/planning">
      <header className="topbar">
        <div>
          <p className="eyebrow">Planificación operacional</p>
          <h1>Nueva operación planificada</h1>
          <p className="muted">
            Registra sólo lo necesario para reservar capacidad y anticipar el resultado. La evidencia y el cierre se completan durante la ejecución.
          </p>
        </div>
        <Link className="buttonLink" href="/planning">Volver al calendario →</Link>
      </header>

      {message ? (
        <section className="intakeFeedback intakeFeedback-rejected">
          <strong>NO GUARDADO</strong>
          <span>{message}</span>
        </section>
      ) : null}

      <section className="bottomGrid">
        <article className="panel">
          <p className="eyebrow">01 · Qué y para quién</p>
          <h3>Empresa y flujo REP.</h3>

          {organizations.length ? (
            <form action={createPlanAction} className="intakeForm">
              <label>
                <span>Cliente</span>
                <select name="organizationId" required defaultValue={selectedOrganization?.id ?? ""}>
                  <option value="" disabled>Seleccionar empresa</option>
                  {organizations.map((organization) => (
                    <option value={organization.id} key={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Sitio</span>
                <select name="siteId" defaultValue="">
                  <option value="">Sin sitio asignado</option>
                  {sites.map((site) => (
                    <option value={site.id} key={site.id}>
                      {site.organizationName} · {site.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Producto prioritario</span>
                <select name="stream" required defaultValue="">
                  <option value="" disabled>Seleccionar producto</option>
                  {priorityStreams.map((stream) => (
                    <option value={stream.id} key={stream.id}>
                      {stream.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="bottomGrid">
                <label>
                  <span>Inicio</span>
                  <input name="plannedStart" type="date" required />
                </label>
                <label>
                  <span>Fin estimado</span>
                  <input name="plannedEnd" type="date" />
                </label>
              </div>

              <div className="bottomGrid">
                <label>
                  <span>Cantidad estimada</span>
                  <input name="quantity" type="number" min="0" step="0.001" placeholder="Opcional" />
                </label>
                <label>
                  <span>Unidad</span>
                  <select name="unit" defaultValue="kg" required>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Gestor / contraparte</span>
                <input name="counterparty" type="text" placeholder="Opcional" />
              </label>

              <label>
                <span>Vehículo / referencia</span>
                <input name="vehicleRef" type="text" placeholder="Opcional" />
              </label>

              <label>
                <span>Nota operativa</span>
                <textarea name="notes" rows={3} placeholder="Sólo si cambia la ejecución." />
              </label>

              <button type="submit">Agregar al calendario</button>
            </form>
          ) : (
            <div className="emptyState compactEmpty">
              <strong>No hay clientes disponibles.</strong>
              <p>La planificación se habilita sólo con organizaciones canónicas ya registradas.</p>
            </div>
          )}
        </article>

        <article className="panel ledgerRule">
          <p className="eyebrow">Regla operacional</p>
          <h3>Planificar no significa ejecutar.</h3>
          <p className="muted">
            Esta entrada reserva una operación futura. No crea evidencia, no altera un cierre REP y no se contabiliza como retiro ejecutado hasta que exista la operación real.
          </p>
          <div className="intakeFields">
            <span>PLANNED</span>
            <span>sin evidencia todavía</span>
            <span>sin impacto contable REP</span>
            <span>editable antes de ejecutar</span>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
