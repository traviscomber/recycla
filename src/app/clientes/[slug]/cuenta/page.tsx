import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db, hasDatabase } from "@/lib/db";
import { requireWriteSession } from "@/lib/auth/server";
import { priorityStreams } from "@/lib/rep";

export const dynamic = "force-dynamic";

type AccountSchema = {
  contacts: string | null;
  contracts: string | null;
  services: string | null;
  slas: string | null;
  audit: string | null;
};

async function getAccountContext(slug: string) {
  if (!hasDatabase()) return null;
  const sql = db();

  const organizations = await sql<Array<{ id: string; name: string; legalName: string; rut: string }>>`
    select id::text as id, display_name as name, legal_name as "legalName", rut
    from organizations
    where slug = ${slug}
    limit 1
  `;
  const organization = organizations[0];
  if (!organization) return null;

  const schemaRows = await sql<AccountSchema[]>`
    select
      to_regclass('public.b2b_account_contacts')::text as contacts,
      to_regclass('public.b2b_service_contracts')::text as contracts,
      to_regclass('public.b2b_contract_services')::text as services,
      to_regclass('public.b2b_service_slas')::text as slas,
      to_regclass('public.b2b_account_change_log')::text as audit
  `;
  const schema = schemaRows[0];

  const [sites, contracts, contacts, services, slas, audit] = await Promise.all([
    sql<Array<{ id: string; name: string }>>`
      select id::text as id, name
      from sites
      where organization_id = ${organization.id}::uuid
      order by name asc
    `,
    schema?.contracts
      ? sql<Array<{ id: string; contractRef: string | null; status: string }>>`
          select id::text as id, contract_ref as "contractRef", status
          from b2b_service_contracts
          where client_organization_id = ${organization.id}::uuid
          order by updated_at desc
        `
      : Promise.resolve([]),
    schema?.contacts
      ? sql<Array<{ id: string; side: string; fullName: string; email: string | null; responsibility: string | null; isPrimary: boolean }>>`
          select id::text as id, side, full_name as "fullName", email,
            responsibility, is_primary as "isPrimary"
          from b2b_account_contacts
          where client_organization_id = ${organization.id}::uuid
            and (valid_to is null or valid_to >= current_date)
          order by is_primary desc, side asc, full_name asc
        `
      : Promise.resolve([]),
    schema?.services && schema?.contracts
      ? sql<Array<{ id: string; contractId: string; serviceName: string; site: string | null; stream: string | null }>>`
          select cs.id::text as id, cs.contract_id::text as "contractId",
            cs.service_name as "serviceName", s.name as site, cs.stream::text as stream
          from b2b_contract_services cs
          join b2b_service_contracts sc on sc.id = cs.contract_id
          left join sites s on s.id = cs.site_id
          where sc.client_organization_id = ${organization.id}::uuid
            and cs.active = true
          order by cs.created_at desc
        `
      : Promise.resolve([]),
    schema?.slas && schema?.contracts
      ? sql<Array<{ id: string; contractId: string; label: string; targetValue: number; targetUnit: string }>>`
          select sla.id::text as id, sla.contract_id::text as "contractId",
            sla.label, sla.target_value::float8 as "targetValue", sla.target_unit as "targetUnit"
          from b2b_service_slas sla
          join b2b_service_contracts sc on sc.id = sla.contract_id
          where sc.client_organization_id = ${organization.id}::uuid
            and sla.active = true
          order by sla.created_at desc
        `
      : Promise.resolve([]),
    schema?.audit
      ? sql<Array<{ id: string; entityType: string; action: string; actorRef: string | null; createdAt: string }>>`
          select id::text as id, entity_type as "entityType", action,
            actor_ref as "actorRef", created_at::text as "createdAt"
          from b2b_account_change_log
          where client_organization_id = ${organization.id}::uuid
          order by created_at desc
          limit 12
        `
      : Promise.resolve([])
  ]);

  return { organization, schema, sites, contracts, contacts, services, slas, audit };
}

async function resolveOrganization(slug: string) {
  if (!hasDatabase()) throw new Error("DB_UNAVAILABLE");
  const sql = db();
  const rows = await sql<Array<{ id: string }>>`
    select id::text as id from organizations where slug = ${slug} limit 1
  `;
  if (!rows[0]) throw new Error("ORGANIZATION_NOT_FOUND");
  return rows[0].id;
}

async function assertSchema(table: string) {
  const sql = db();
  const rows = await sql<Array<{ value: string | null }>>`
    select to_regclass(${"public." + table})::text as value
  `;
  if (!rows[0]?.value) throw new Error("B2B_SCHEMA_MISSING");
}

async function logChange(input: {
  organizationId: string;
  entityType: "CONTACT" | "CONTRACT" | "SERVICE" | "SLA";
  entityId: string;
  action: "CREATE" | "UPDATE" | "END" | "DEACTIVATE";
  actorRef: string | null;
  changedFields: Record<string, unknown>;
}) {
  const sql = db();
  const rows = await sql<Array<{ value: string | null }>>`
    select to_regclass('public.b2b_account_change_log')::text as value
  `;
  if (!rows[0]?.value) return;
  await sql`
    insert into b2b_account_change_log (
      client_organization_id, entity_type, entity_id, action, actor_ref, changed_fields
    ) values (
      ${input.organizationId}::uuid,
      ${input.entityType},
      ${input.entityId}::uuid,
      ${input.action},
      ${input.actorRef},
      ${JSON.stringify(input.changedFields)}::jsonb
    )
  `;
}

async function createContactAction(slug: string, formData: FormData) {
  "use server";
  const session = await requireWriteSession();
  await assertSchema("b2b_account_contacts");
  const organizationId = await resolveOrganization(slug);
  const side = String(formData.get("side") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const responsibility = String(formData.get("responsibility") ?? "").trim() || null;
  const isPrimary = formData.get("isPrimary") === "on";
  if (!["CLIENT", "RECYCLA"].includes(side) || !fullName) redirect(`/clientes/${slug}/cuenta?result=invalid`);

  const sql = db();
  if (isPrimary) {
    await sql`
      update b2b_account_contacts
      set is_primary = false, updated_at = now()
      where client_organization_id = ${organizationId}::uuid
        and side = ${side}
        and valid_to is null
    `;
  }
  const rows = await sql<Array<{ id: string }>>`
    insert into b2b_account_contacts (
      client_organization_id, side, full_name, email, phone, title, responsibility, is_primary, valid_from
    ) values (
      ${organizationId}::uuid, ${side}, ${fullName}, ${email}, ${phone}, ${title}, ${responsibility}, ${isPrimary}, current_date
    )
    returning id::text as id
  `;
  await logChange({
    organizationId, entityType: "CONTACT", entityId: rows[0].id, action: "CREATE",
    actorRef: session.session?.user?.email ?? null,
    changedFields: { side, fullName, email, phone, title, responsibility, isPrimary }
  });
  revalidatePath(`/clientes/${slug}`);
  revalidatePath(`/clientes/${slug}/cuenta`);
  redirect(`/clientes/${slug}/cuenta?result=contact_created`);
}

async function createContractAction(slug: string, formData: FormData) {
  "use server";
  const session = await requireWriteSession();
  await assertSchema("b2b_service_contracts");
  const organizationId = await resolveOrganization(slug);
  const contractRef = String(formData.get("contractRef") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "DRAFT");
  const startsAt = String(formData.get("startsAt") ?? "").trim() || null;
  const endsAt = String(formData.get("endsAt") ?? "").trim() || null;
  const renewalAt = String(formData.get("renewalAt") ?? "").trim() || null;
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase() || null;
  const billingModel = String(formData.get("billingModel") ?? "").trim() || null;
  if (!["DRAFT","ACTIVE","SUSPENDED","EXPIRED","ENDED"].includes(status)) redirect(`/clientes/${slug}/cuenta?result=invalid`);
  if (currency && currency.length !== 3) redirect(`/clientes/${slug}/cuenta?result=invalid`);

  const sql = db();
  const rows = await sql<Array<{ id: string }>>`
    insert into b2b_service_contracts (
      client_organization_id, contract_ref, status, starts_at, ends_at, renewal_at, currency, billing_model
    ) values (
      ${organizationId}::uuid, ${contractRef}, ${status},
      ${startsAt}::date, ${endsAt}::date, ${renewalAt}::date, ${currency}, ${billingModel}
    )
    returning id::text as id
  `;
  await logChange({
    organizationId, entityType: "CONTRACT", entityId: rows[0].id, action: "CREATE",
    actorRef: session.session?.user?.email ?? null,
    changedFields: { contractRef, status, startsAt, endsAt, renewalAt, currency, billingModel }
  });
  revalidatePath(`/clientes/${slug}`);
  revalidatePath(`/clientes/${slug}/cuenta`);
  redirect(`/clientes/${slug}/cuenta?result=contract_created`);
}

async function createServiceAction(slug: string, formData: FormData) {
  "use server";
  const session = await requireWriteSession();
  await assertSchema("b2b_contract_services");
  const organizationId = await resolveOrganization(slug);
  const contractId = String(formData.get("contractId") ?? "");
  const siteId = String(formData.get("siteId") ?? "").trim() || null;
  const stream = String(formData.get("stream") ?? "").trim() || null;
  const serviceCode = String(formData.get("serviceCode") ?? "").trim();
  const serviceName = String(formData.get("serviceName") ?? "").trim();
  const frequency = String(formData.get("frequency") ?? "").trim() || null;
  const quantityRaw = String(formData.get("includedQuantity") ?? "").trim();
  const includedQuantity = quantityRaw ? Number(quantityRaw) : null;
  const unit = String(formData.get("unit") ?? "").trim() || null;
  if (!contractId || !serviceCode || !serviceName || (includedQuantity !== null && (!Number.isFinite(includedQuantity) || includedQuantity < 0))) {
    redirect(`/clientes/${slug}/cuenta?result=invalid`);
  }

  const sql = db();
  const owned = await sql<Array<{ id: string }>>`
    select id::text as id from b2b_service_contracts
    where id = ${contractId}::uuid and client_organization_id = ${organizationId}::uuid
    limit 1
  `;
  if (!owned[0]) redirect(`/clientes/${slug}/cuenta?result=invalid_contract`);
  if (siteId) {
    const site = await sql<Array<{ id: string }>>`
      select id::text as id from sites
      where id = ${siteId}::uuid and organization_id = ${organizationId}::uuid
      limit 1
    `;
    if (!site[0]) redirect(`/clientes/${slug}/cuenta?result=invalid_site`);
  }

  const rows = await sql<Array<{ id: string }>>`
    insert into b2b_contract_services (
      contract_id, site_id, stream, service_code, service_name, frequency, included_quantity, unit
    ) values (
      ${contractId}::uuid, ${siteId}::uuid, ${stream}::priority_stream,
      ${serviceCode}, ${serviceName}, ${frequency}, ${includedQuantity}, ${unit}
    )
    returning id::text as id
  `;
  await logChange({
    organizationId, entityType: "SERVICE", entityId: rows[0].id, action: "CREATE",
    actorRef: session.session?.user?.email ?? null,
    changedFields: { contractId, siteId, stream, serviceCode, serviceName, frequency, includedQuantity, unit }
  });
  revalidatePath(`/clientes/${slug}`);
  revalidatePath(`/clientes/${slug}/cuenta`);
  redirect(`/clientes/${slug}/cuenta?result=service_created`);
}

async function createSlaAction(slug: string, formData: FormData) {
  "use server";
  const session = await requireWriteSession();
  await assertSchema("b2b_service_slas");
  const organizationId = await resolveOrganization(slug);
  const contractId = String(formData.get("contractId") ?? "");
  const metricCode = String(formData.get("metricCode") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const targetValue = Number(String(formData.get("targetValue") ?? ""));
  const targetUnit = String(formData.get("targetUnit") ?? "").trim();
  const comparison = String(formData.get("comparison") ?? "LE");
  if (!contractId || !metricCode || !label || !targetUnit || !Number.isFinite(targetValue) || targetValue < 0 || !["LT","LE","EQ","GE","GT"].includes(comparison)) {
    redirect(`/clientes/${slug}/cuenta?result=invalid`);
  }

  const sql = db();
  const owned = await sql<Array<{ id: string }>>`
    select id::text as id from b2b_service_contracts
    where id = ${contractId}::uuid and client_organization_id = ${organizationId}::uuid
    limit 1
  `;
  if (!owned[0]) redirect(`/clientes/${slug}/cuenta?result=invalid_contract`);

  const rows = await sql<Array<{ id: string }>>`
    insert into b2b_service_slas (
      contract_id, metric_code, label, target_value, target_unit, comparison
    ) values (
      ${contractId}::uuid, ${metricCode}, ${label}, ${targetValue}, ${targetUnit}, ${comparison}
    )
    returning id::text as id
  `;
  await logChange({
    organizationId, entityType: "SLA", entityId: rows[0].id, action: "CREATE",
    actorRef: session.session?.user?.email ?? null,
    changedFields: { contractId, metricCode, label, targetValue, targetUnit, comparison }
  });
  revalidatePath(`/clientes/${slug}`);
  revalidatePath(`/clientes/${slug}/cuenta`);
  redirect(`/clientes/${slug}/cuenta?result=sla_created`);
}

function resultMessage(result?: string) {
  const messages: Record<string,string> = {
    contact_created: "Responsable registrado.",
    contract_created: "Contrato registrado.",
    service_created: "Servicio agregado.",
    sla_created: "SLA agregado.",
    invalid: "Revisa los campos obligatorios.",
    invalid_contract: "El contrato no pertenece a esta empresa.",
    invalid_site: "La instalación no pertenece a esta empresa."
  };
  return result ? messages[result] ?? null : null;
}

export default async function AccountPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const context = await getAccountContext(slug);
  if (!context) notFound();

  const schemaReady = Boolean(
    context.schema?.contacts &&
    context.schema?.contracts &&
    context.schema?.services &&
    context.schema?.slas
  );
  const message = resultMessage(query.result);

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div>
          <p className="eyebrow">Gestión de cuenta B2B</p>
          <h1>{context.organization.name}</h1>
          <p className="muted">{context.organization.rut} · responsables, contrato, servicios y SLA</p>
        </div>
        <Link className="buttonLink secondary" href={`/clientes/${slug}`}>Volver a ficha 360 →</Link>
      </header>

      {message ? <section className="intakeFeedback"><strong>CUENTA B2B</strong><span>{message}</span></section> : null}

      {!schemaReady ? (
        <section className="systemNotice notice-schema_missing">
          <div>
            <p className="eyebrow">Capa B2B preparada</p>
            <h3>El esquema de cuenta todavía no está aplicado en esta base.</h3>
            <p>La interfaz permanece en modo seguro y no permite escrituras hasta que la migración aditiva sea aplicada.</p>
          </div>
          <span>SCHEMA PENDING</span>
        </section>
      ) : null}

      <section className="ficha360BusinessGrid">
        <article className="panel">
          <p className="eyebrow">01 · Responsables</p>
          <h3>Cliente y Recycla.</h3>
          {schemaReady ? (
            <form action={createContactAction.bind(null, slug)} className="intakeForm">
              <label><span>Lado</span><select name="side" defaultValue="CLIENT"><option value="CLIENT">Cliente</option><option value="RECYCLA">Recycla</option></select></label>
              <label><span>Nombre</span><input name="fullName" required /></label>
              <label><span>Cargo</span><input name="title" /></label>
              <label><span>Responsabilidad</span><input name="responsibility" placeholder="Ej. contraparte REP, ejecutivo de cuenta" /></label>
              <div className="bottomGrid">
                <label><span>Email</span><input name="email" type="email" /></label>
                <label><span>Teléfono</span><input name="phone" /></label>
              </div>
              <label className="accountCheck"><input name="isPrimary" type="checkbox" /><span>Responsable principal de este lado</span></label>
              <button type="submit">Agregar responsable</button>
            </form>
          ) : <p className="muted">Disponible después de aplicar el esquema B2B.</p>}
          {context.contacts.length ? <div className="ficha360AccountList">{context.contacts.map((contact) => <div key={contact.id}><div><strong>{contact.fullName}</strong><p>{contact.side === "RECYCLA" ? "Recycla" : "Cliente"} · {contact.responsibility ?? "Sin responsabilidad definida"}</p></div><div><span>{contact.isPrimary ? "Principal" : "Contacto"}</span><b>{contact.email ?? "Sin email"}</b></div></div>)}</div> : null}
        </article>

        <article className="panel">
          <p className="eyebrow">02 · Contrato</p>
          <h3>Vigencia y modelo comercial.</h3>
          {schemaReady ? (
            <form action={createContractAction.bind(null, slug)} className="intakeForm">
              <label><span>Referencia</span><input name="contractRef" placeholder="Contrato / OC / acuerdo" /></label>
              <label><span>Estado</span><select name="status" defaultValue="ACTIVE"><option value="DRAFT">Borrador</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="EXPIRED">Vencido</option><option value="ENDED">Finalizado</option></select></label>
              <div className="bottomGrid">
                <label><span>Inicio</span><input name="startsAt" type="date" /></label>
                <label><span>Término</span><input name="endsAt" type="date" /></label>
              </div>
              <label><span>Renovación</span><input name="renewalAt" type="date" /></label>
              <div className="bottomGrid">
                <label><span>Moneda</span><input name="currency" maxLength={3} placeholder="CLP" /></label>
                <label><span>Modelo facturación</span><input name="billingModel" placeholder="Mensual, por retiro, etc." /></label>
              </div>
              <button type="submit">Registrar contrato</button>
            </form>
          ) : <p className="muted">Disponible después de aplicar el esquema B2B.</p>}
        </article>
      </section>

      <section className="ficha360BusinessGrid">
        <article className="panel">
          <p className="eyebrow">03 · Servicios</p>
          <h3>Qué está incluido.</h3>
          {schemaReady && context.contracts.length ? (
            <form action={createServiceAction.bind(null, slug)} className="intakeForm">
              <label><span>Contrato</span><select name="contractId" required>{context.contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.contractRef ?? "Sin referencia"} · {contract.status}</option>)}</select></label>
              <label><span>Instalación</span><select name="siteId" defaultValue=""><option value="">Todas / no especificada</option>{context.sites.map((site) => <option value={site.id} key={site.id}>{site.name}</option>)}</select></label>
              <label><span>Producto REP</span><select name="stream" defaultValue=""><option value="">No específico</option>{priorityStreams.map((stream) => <option value={stream.id} key={stream.id}>{stream.label}</option>)}</select></label>
              <div className="bottomGrid">
                <label><span>Código</span><input name="serviceCode" required placeholder="RETIRO, REP_REPORT..." /></label>
                <label><span>Servicio</span><input name="serviceName" required /></label>
              </div>
              <label><span>Frecuencia</span><input name="frequency" placeholder="Semanal, mensual, on demand" /></label>
              <div className="bottomGrid">
                <label><span>Cantidad incluida</span><input name="includedQuantity" type="number" min="0" step="0.001" /></label>
                <label><span>Unidad</span><select name="unit" defaultValue=""><option value="">N/A</option><option value="kg">kg</option><option value="l">l</option></select></label>
              </div>
              <button type="submit">Agregar servicio</button>
            </form>
          ) : <p className="muted">{schemaReady ? "Registra primero un contrato." : "Disponible después de aplicar el esquema B2B."}</p>}
          {context.services.length ? <div className="ficha360AccountList">{context.services.map((service) => <div key={service.id}><div><strong>{service.serviceName}</strong><p>{service.site ?? "Sin sitio específico"} · {service.stream ?? "Sin producto específico"}</p></div></div>)}</div> : null}
        </article>

        <article className="panel">
          <p className="eyebrow">04 · SLA</p>
          <h3>Compromisos medibles.</h3>
          {schemaReady && context.contracts.length ? (
            <form action={createSlaAction.bind(null, slug)} className="intakeForm">
              <label><span>Contrato</span><select name="contractId" required>{context.contracts.map((contract) => <option value={contract.id} key={contract.id}>{contract.contractRef ?? "Sin referencia"} · {contract.status}</option>)}</select></label>
              <div className="bottomGrid">
                <label><span>Código métrica</span><input name="metricCode" required placeholder="PICKUP_HOURS" /></label>
                <label><span>Nombre</span><input name="label" required placeholder="Tiempo máximo de retiro" /></label>
              </div>
              <div className="bottomGrid">
                <label><span>Comparación</span><select name="comparison" defaultValue="LE"><option value="LT">&lt;</option><option value="LE">≤</option><option value="EQ">=</option><option value="GE">≥</option><option value="GT">&gt;</option></select></label>
                <label><span>Objetivo</span><input name="targetValue" type="number" min="0" step="0.001" required /></label>
              </div>
              <label><span>Unidad</span><input name="targetUnit" required placeholder="horas, %, días" /></label>
              <button type="submit">Agregar SLA</button>
            </form>
          ) : <p className="muted">{schemaReady ? "Registra primero un contrato." : "Disponible después de aplicar el esquema B2B."}</p>}
          {context.slas.length ? <div className="ficha360AccountList">{context.slas.map((sla) => <div key={sla.id}><div><strong>{sla.label}</strong><p>{sla.targetValue} {sla.targetUnit}</p></div></div>)}</div> : null}
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div><p className="eyebrow">Trazabilidad</p><h3>Últimos cambios de cuenta.</h3></div>
          <span className="ficha360Updated">{context.audit.length} evento(s)</span>
        </div>
        {context.audit.length ? <div className="ficha360Timeline">{context.audit.map((item) => <div key={item.id}><span>{new Date(item.createdAt).toLocaleDateString("es-CL")}</span><div><strong>{item.entityType} · {item.action}</strong><p>{item.actorRef ?? "Actor no informado"}</p></div></div>)}</div> : <div className="emptyState compactEmpty"><strong>Sin cambios B2B registrados.</strong><p>La auditoría se activa desde la primera escritura canónica.</p></div>}
      </section>
    </AppShell>
  );
}
