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

export type Client360 = {
  organization: {
    id: string;
    slug: string;
    name: string;
    legalName: string;
    rut: string;
    createdAt: string;
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

    const [documents, documentStats, ledgerEvents, ledgerStats, reportingRows] =
      await Promise.all([
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
