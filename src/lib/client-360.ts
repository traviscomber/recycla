import "server-only";

import { db } from "@/lib/db";
import { getRepDatabaseStatus } from "@/lib/rep-repository";
import type { PriorityStream } from "@/lib/rep";

export type Client360Document = {
  id: string;
  documentType: string;
  fileName: string;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type Client360LedgerEvent = {
  id: string;
  createdAt: string;
  stream: PriorityStream;
  state: string;
  quantity: number;
  unit: "kg" | "l";
  evidenceCount: number;
};

export type Client360Site = {
  id: string;
  name: string;
  address: string | null;
  region: string | null;
  commune: string | null;
  createdAt: string;
  collectionCount: number;
  lastCollectionAt: string | null;
  plannedCount: number;
  nextPlanAt: string | null;
};

export type Client360Role = {
  role: string;
  validFrom: string | null;
  validTo: string | null;
};

export type Client360Relationship = {
  id: string;
  direction: "FROM" | "TO";
  relationshipType: string;
  organizationName: string;
  organizationRut: string;
  validFrom: string | null;
  validTo: string | null;
};

export type Client360Plan = {
  id: string;
  site: string | null;
  stream: PriorityStream;
  plannedStart: string;
  plannedEnd: string | null;
  status: string;
  estimatedQuantity: number | null;
  estimatedUnit: "kg" | "l" | null;
  counterparty: string | null;
  vehicleRef: string | null;
  updatedAt: string;
};

export type Client360Period = {
  year: number;
  obligationCount: number;
};

export type Client360Contact = {
  id: string;
  side: "CLIENT" | "RECYCLA";
  fullName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  responsibility: string | null;
  isPrimary: boolean;
  validFrom: string | null;
  validTo: string | null;
  updatedAt: string;
};

export type Client360Contract = {
  id: string;
  contractRef: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  renewalAt: string | null;
  currency: string | null;
  billingModel: string | null;
  serviceCount: number;
  slaCount: number;
  updatedAt: string;
};

export type Client360ContractService = {
  id: string;
  contractId: string;
  site: string | null;
  stream: PriorityStream | null;
  serviceCode: string;
  serviceName: string;
  frequency: string | null;
  includedQuantity: number | null;
  unit: "kg" | "l" | null;
  active: boolean;
};

export type Client360Sla = {
  id: string;
  contractId: string;
  metricCode: string;
  label: string;
  targetValue: number;
  targetUnit: string;
  comparison: "LT" | "LE" | "EQ" | "GE" | "GT";
  active: boolean;
};

export type Client360 = {
  organization: {
    id: string;
    slug: string;
    name: string;
    legalName: string;
    rut: string;
    createdAt: string;
  };
  sites: Client360Site[];
  roles: Client360Role[];
  relationships: Client360Relationship[];
  upcomingPlans: Client360Plan[];
  periods: Client360Period[];
  contacts: Client360Contact[];
  contracts: Client360Contract[];
  contractServices: Client360ContractService[];
  slas: Client360Sla[];
  lastCollectionAt: string | null;
  collectionCount: number;
  coverage: {
    contacts: "available" | "empty" | "source_unavailable";
    contracts: "available" | "empty" | "source_unavailable";
    sites: "available" | "empty";
    relationships: "available" | "empty";
    planning: "available" | "empty" | "source_unavailable";
  };
  documents: Client360Document[];
  documentCount: number;
  expiringDocumentCount: number;
  ledgerEvents: Client360LedgerEvent[];
  ledgerEventCount: number;
  lastLedgerAt: string | null;
  reporting: {
    latestReport: {
      reportingMonth: string;
      status: string;
      version: number;
      generatedAt: string;
      finalizedAt: string | null;
    } | null;
    latestCheck: {
      status: string;
      startedAt: string;
      finishedAt: string | null;
    } | null;
    openFindings: number;
    criticalFindings: number;
    marketRows: number;
    wasteRows: number;
    lastMarketEventAt: string | null;
    lastWasteEventAt: string | null;
  };
};

export async function getClient360(slug: string): Promise<Client360 | null> {
  const status = await getRepDatabaseStatus();
  if (status.state !== "ready") return null;

  try {
    const sql = db();
    const organizations = await sql<Array<{
      id: string;
      slug: string;
      display_name: string;
      legal_name: string;
      rut: string;
      created_at: string;
    }>>`
      select id::text as id, slug, display_name, legal_name, rut,
        created_at::text as created_at
      from organizations
      where slug = ${slug}
      limit 1
    `;

    const organization = organizations[0];
    if (!organization) return null;

    const schemaRows = await sql<Array<{
      plans: string | null;
      contacts: string | null;
      contracts: string | null;
      contractServices: string | null;
      slas: string | null;
    }>>`
      select
        to_regclass('public.collection_plans')::text as plans,
        to_regclass('public.b2b_account_contacts')::text as contacts,
        to_regclass('public.b2b_service_contracts')::text as contracts,
        to_regclass('public.b2b_contract_services')::text as "contractServices",
        to_regclass('public.b2b_service_slas')::text as slas
    `;
    const hasPlans = Boolean(schemaRows[0]?.plans);
    const hasContacts = Boolean(schemaRows[0]?.contacts);
    const hasContracts = Boolean(schemaRows[0]?.contracts);
    const hasContractServices = Boolean(schemaRows[0]?.contractServices);
    const hasSlas = Boolean(schemaRows[0]?.slas);

    const [sites, roles, relationships, periods, collectionStats, upcomingPlans, contacts, contracts, contractServices, slas, documents, documentStats, ledgerEvents, ledgerStats, reportingRows] =
      await Promise.all([
        sql<Client360Site[]>`
          select
            s.id::text as id,
            s.name,
            s.address,
            s.region,
            s.commune,
            s.created_at::text as "createdAt",
            count(distinct c.id)::int as "collectionCount",
            max(c.collected_at)::text as "lastCollectionAt",
            0::int as "plannedCount",
            null::text as "nextPlanAt"
          from sites s
          left join collections c on c.site_id = s.id
          where s.organization_id = ${organization.id}::uuid
          group by s.id
          order by s.name asc
        `,
        sql<Client360Role[]>`
          select role::text as role,
            valid_from::text as "validFrom",
            valid_to::text as "validTo"
          from organization_rep_roles
          where organization_id = ${organization.id}::uuid
          order by valid_from desc nulls last, role asc
        `,
        sql<Client360Relationship[]>`
          select
            rr.id::text as id,
            case when rr.from_organization_id = ${organization.id}::uuid then 'FROM' else 'TO' end as direction,
            rr.relationship_type::text as "relationshipType",
            case when rr.from_organization_id = ${organization.id}::uuid then target.display_name else source.display_name end as "organizationName",
            case when rr.from_organization_id = ${organization.id}::uuid then target.rut else source.rut end as "organizationRut",
            rr.valid_from::text as "validFrom",
            rr.valid_to::text as "validTo"
          from rep_relationships rr
          join organizations source on source.id = rr.from_organization_id
          join organizations target on target.id = rr.to_organization_id
          where rr.from_organization_id = ${organization.id}::uuid
             or rr.to_organization_id = ${organization.id}::uuid
          order by rr.created_at desc
          limit 12
        `,
        sql<Client360Period[]>`
          select rp.year, count(ro.id)::int as "obligationCount"
          from rep_obligations ro
          join reporting_periods rp on rp.id = ro.reporting_period_id
          where ro.organization_id = ${organization.id}::uuid
          group by rp.year
          order by rp.year desc
        `,
        sql<Array<{ total: number; last_at: string | null }>>`
          select count(*)::int as total, max(collected_at)::text as last_at
          from collections
          where organization_id = ${organization.id}::uuid
        `,
        hasPlans
          ? sql<Client360Plan[]>`
              select
                cp.id::text as id,
                s.name as site,
                cp.stream,
                cp.planned_start::text as "plannedStart",
                cp.planned_end::text as "plannedEnd",
                cp.status::text as status,
                cp.estimated_quantity::float8 as "estimatedQuantity",
                cp.estimated_unit as "estimatedUnit",
                cp.counterparty_name as counterparty,
                cp.vehicle_ref as "vehicleRef",
                cp.updated_at::text as "updatedAt"
              from collection_plans cp
              left join sites s on s.id = cp.site_id
              where cp.organization_id = ${organization.id}::uuid
                and cp.status not in ('COMPLETED', 'CANCELLED')
                and coalesce(cp.planned_end, cp.planned_start) >= now()
              order by cp.planned_start asc
              limit 8
            `
          : Promise.resolve([] as Client360Plan[]),
        hasContacts
          ? sql<Client360Contact[]>`
              select
                id::text as id,
                side,
                full_name as "fullName",
                email,
                phone,
                title,
                responsibility,
                is_primary as "isPrimary",
                valid_from::text as "validFrom",
                valid_to::text as "validTo",
                updated_at::text as "updatedAt"
              from b2b_account_contacts
              where client_organization_id = ${organization.id}::uuid
                and (valid_to is null or valid_to >= current_date)
              order by is_primary desc, side asc, full_name asc
              limit 20
            `
          : Promise.resolve([] as Client360Contact[]),
        hasContracts && hasContractServices && hasSlas
          ? sql<Client360Contract[]>`
              select
                sc.id::text as id,
                sc.contract_ref as "contractRef",
                sc.status,
                sc.starts_at::text as "startsAt",
                sc.ends_at::text as "endsAt",
                sc.renewal_at::text as "renewalAt",
                sc.currency,
                sc.billing_model as "billingModel",
                (select count(*)::int from b2b_contract_services cs
                  where cs.contract_id = sc.id and cs.active = true) as "serviceCount",
                (select count(*)::int from b2b_service_slas sla
                  where sla.contract_id = sc.id and sla.active = true) as "slaCount",
                sc.updated_at::text as "updatedAt"
              from b2b_service_contracts sc
              where sc.client_organization_id = ${organization.id}::uuid
              order by
                case sc.status when 'ACTIVE' then 0 when 'DRAFT' then 1 else 2 end,
                coalesce(sc.ends_at, date '9999-12-31') asc,
                sc.updated_at desc
              limit 10
            `
          : hasContracts
            ? sql<Client360Contract[]>`
                select
                  sc.id::text as id,
                  sc.contract_ref as "contractRef",
                  sc.status,
                  sc.starts_at::text as "startsAt",
                  sc.ends_at::text as "endsAt",
                  sc.renewal_at::text as "renewalAt",
                  sc.currency,
                  sc.billing_model as "billingModel",
                  0::int as "serviceCount",
                  0::int as "slaCount",
                  sc.updated_at::text as "updatedAt"
                from b2b_service_contracts sc
                where sc.client_organization_id = ${organization.id}::uuid
                order by
                  case sc.status when 'ACTIVE' then 0 when 'DRAFT' then 1 else 2 end,
                  coalesce(sc.ends_at, date '9999-12-31') asc,
                  sc.updated_at desc
                limit 10
              `
            : Promise.resolve([] as Client360Contract[]),
        hasContracts && hasContractServices
          ? sql<Client360ContractService[]>`
              select
                cs.id::text as id,
                cs.contract_id::text as "contractId",
                s.name as site,
                cs.stream,
                cs.service_code as "serviceCode",
                cs.service_name as "serviceName",
                cs.frequency,
                cs.included_quantity::float8 as "includedQuantity",
                cs.unit,
                cs.active
              from b2b_contract_services cs
              join b2b_service_contracts sc on sc.id = cs.contract_id
              left join sites s on s.id = cs.site_id
              where sc.client_organization_id = ${organization.id}::uuid
                and cs.active = true
              order by cs.service_name asc
              limit 30
            `
          : Promise.resolve([] as Client360ContractService[]),
        hasContracts && hasSlas
          ? sql<Client360Sla[]>`
              select
                sla.id::text as id,
                sla.contract_id::text as "contractId",
                sla.metric_code as "metricCode",
                sla.label,
                sla.target_value::float8 as "targetValue",
                sla.target_unit as "targetUnit",
                sla.comparison,
                sla.active
              from b2b_service_slas sla
              join b2b_service_contracts sc on sc.id = sla.contract_id
              where sc.client_organization_id = ${organization.id}::uuid
                and sla.active = true
              order by sla.label asc
              limit 30
            `
          : Promise.resolve([] as Client360Sla[]),
        sql<Client360Document[]>`
          select id::text as id,
            document_type as "documentType",
            file_name as "fileName",
            issued_at::text as "issuedAt",
            expires_at::text as "expiresAt",
            created_at::text as "createdAt"
          from documents
          where organization_id = ${organization.id}::uuid
          order by coalesce(issued_at::timestamptz, created_at) desc
          limit 8
        `,
        sql<Array<{ total: number; expiring: number }>>`
          select count(*)::int as total,
            count(*) filter (
              where expires_at is not null
                and expires_at <= current_date + interval '60 days'
                and expires_at >= current_date
            )::int as expiring
          from documents
          where organization_id = ${organization.id}::uuid
        `,
        sql<Client360LedgerEvent[]>`
          select le.id::text as id,
            le.created_at::text as "createdAt",
            le.stream,
            le.state::text as state,
            le.quantity::float8 as quantity,
            le.unit,
            count(distinct el.document_id)::int as "evidenceCount"
          from rep_ledger_entries le
          left join evidence_links el
            on el.entity_type = le.source_entity_type
            and el.entity_id = le.source_entity_id
          where le.organization_id = ${organization.id}::uuid
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
          group by le.id
          order by le.created_at desc
          limit 8
        `,
        sql<Array<{ total: number; last_at: string | null }>>`
          select count(*)::int as total, max(created_at)::text as last_at
          from rep_ledger_entries le
          where le.organization_id = ${organization.id}::uuid
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
        `,
        sql<Array<{
          latest_report_month: string | null;
          latest_report_status: string | null;
          latest_report_version: number | null;
          latest_report_generated_at: string | null;
          latest_report_finalized_at: string | null;
          latest_check_status: string | null;
          latest_check_started_at: string | null;
          latest_check_finished_at: string | null;
          open_findings: number;
          critical_findings: number;
          market_rows: number;
          waste_rows: number;
          last_market_event_at: string | null;
          last_waste_event_at: string | null;
        }>>`
          select
            (select reporting_month::text from monthly_rep_reports where subject_ref = ${slug} order by reporting_month desc, version desc limit 1) as latest_report_month,
            (select status from monthly_rep_reports where subject_ref = ${slug} order by reporting_month desc, version desc limit 1) as latest_report_status,
            (select version from monthly_rep_reports where subject_ref = ${slug} order by reporting_month desc, version desc limit 1) as latest_report_version,
            (select generated_at::text from monthly_rep_reports where subject_ref = ${slug} order by reporting_month desc, version desc limit 1) as latest_report_generated_at,
            (select finalized_at::text from monthly_rep_reports where subject_ref = ${slug} order by reporting_month desc, version desc limit 1) as latest_report_finalized_at,
            (select status from compliance_check_runs where subject_ref = ${slug} order by started_at desc limit 1) as latest_check_status,
            (select started_at::text from compliance_check_runs where subject_ref = ${slug} order by started_at desc limit 1) as latest_check_started_at,
            (select finished_at::text from compliance_check_runs where subject_ref = ${slug} order by started_at desc limit 1) as latest_check_finished_at,
            (select count(*)::int from compliance_findings where subject_ref = ${slug} and status = 'open') as open_findings,
            (select count(*)::int from compliance_findings where subject_ref = ${slug} and status = 'open' and severity = 'critical') as critical_findings,
            (select count(*)::int from market_introductions where subject_ref = ${slug}) as market_rows,
            (select count(*)::int from waste_management_operations where subject_ref = ${slug}) as waste_rows,
            (select max(occurred_at)::text from market_introductions where subject_ref = ${slug}) as last_market_event_at,
            (select max(occurred_at)::text from waste_management_operations where subject_ref = ${slug}) as last_waste_event_at
        `
      ]);

    const reporting = reportingRows[0];

    return {
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.display_name,
        legalName: organization.legal_name,
        rut: organization.rut,
        createdAt: organization.created_at
      },
      sites: sites.map((site) => {
        const sitePlans = upcomingPlans.filter((plan) => plan.site === site.name);
        return {
          ...site,
          plannedCount: sitePlans.length,
          nextPlanAt: sitePlans[0]?.plannedStart ?? null
        };
      }),
      roles,
      relationships,
      upcomingPlans,
      periods,
      contacts,
      contracts,
      contractServices,
      slas,
      lastCollectionAt: collectionStats[0]?.last_at ?? null,
      collectionCount: collectionStats[0]?.total ?? 0,
      coverage: {
        contacts: !hasContacts ? "source_unavailable" : contacts.length ? "available" : "empty",
        contracts: !hasContracts ? "source_unavailable" : contracts.length ? "available" : "empty",
        sites: sites.length ? "available" : "empty",
        relationships: relationships.length ? "available" : "empty",
        planning: !hasPlans ? "source_unavailable" : upcomingPlans.length ? "available" : "empty"
      },
      documents,
      documentCount: documentStats[0]?.total ?? 0,
      expiringDocumentCount: documentStats[0]?.expiring ?? 0,
      ledgerEvents,
      ledgerEventCount: ledgerStats[0]?.total ?? 0,
      lastLedgerAt: ledgerStats[0]?.last_at ?? null,
      reporting: {
        latestReport:
          reporting?.latest_report_month &&
          reporting.latest_report_status &&
          reporting.latest_report_generated_at
            ? {
                reportingMonth: reporting.latest_report_month,
                status: reporting.latest_report_status,
                version: reporting.latest_report_version ?? 1,
                generatedAt: reporting.latest_report_generated_at,
                finalizedAt: reporting.latest_report_finalized_at
              }
            : null,
        latestCheck:
          reporting?.latest_check_status && reporting.latest_check_started_at
            ? {
                status: reporting.latest_check_status,
                startedAt: reporting.latest_check_started_at,
                finishedAt: reporting.latest_check_finished_at
              }
            : null,
        openFindings: reporting?.open_findings ?? 0,
        criticalFindings: reporting?.critical_findings ?? 0,
        marketRows: reporting?.market_rows ?? 0,
        wasteRows: reporting?.waste_rows ?? 0,
        lastMarketEventAt: reporting?.last_market_event_at ?? null,
        lastWasteEventAt: reporting?.last_waste_event_at ?? null
      }
    };
  } catch {
    return null;
  }
}
