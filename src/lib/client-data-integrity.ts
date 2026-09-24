import "server-only";

import { db, hasDatabase } from "@/lib/db";

export type ClientDataIntegrity = {
  state: "ready" | "not_configured" | "unavailable";
  checkedAt: string;
  organizations: number;
  obligations: number;
  reportingPeriods: number;
  clientDirectory: number;
  issues: {
    blankRut: number;
    blankSlug: number;
    blankDisplayName: number;
    blankLegalName: number;
    duplicateNormalizedRut: number;
    duplicateNormalizedSlug: number;
    duplicateNormalizedName: number;
    obligationsWithoutPeriod: number;
    obligationsWithoutOrganization: number;
    invalidUnits: number;
    invalidQuantities: number;
  };
  issueCount: number;
};

export async function inspectClientDataIntegrity(): Promise<ClientDataIntegrity> {
  const checkedAt = new Date().toISOString();
  const emptyIssues = {
    blankRut: 0,
    blankSlug: 0,
    blankDisplayName: 0,
    blankLegalName: 0,
    duplicateNormalizedRut: 0,
    duplicateNormalizedSlug: 0,
    duplicateNormalizedName: 0,
    obligationsWithoutPeriod: 0,
    obligationsWithoutOrganization: 0,
    invalidUnits: 0,
    invalidQuantities: 0
  };

  if (!hasDatabase()) {
    return {
      state: "not_configured",
      checkedAt,
      organizations: 0,
      obligations: 0,
      reportingPeriods: 0,
      clientDirectory: 0,
      issues: emptyIssues,
      issueCount: 0
    };
  }

  try {
    const sql = db();

    const [counts] = await sql<Array<{
      organizations: number;
      obligations: number;
      reportingPeriods: number;
      clientDirectory: number;
    }>>`
      select
        (select count(*)::int from organizations) as organizations,
        (select count(*)::int from rep_obligations) as obligations,
        (select count(*)::int from reporting_periods) as "reportingPeriods",
        case
          when to_regclass('public.client_directory') is null then 0
          else (select count(*)::int from client_directory)
        end as "clientDirectory"
    `;

    const [issues] = await sql<Array<{
      blankRut: number;
      blankSlug: number;
      blankDisplayName: number;
      blankLegalName: number;
      duplicateNormalizedRut: number;
      duplicateNormalizedSlug: number;
      duplicateNormalizedName: number;
      obligationsWithoutPeriod: number;
      obligationsWithoutOrganization: number;
      invalidUnits: number;
      invalidQuantities: number;
    }>>`
      with organization_checks as (
        select
          count(*) filter (where rut is null or length(trim(rut)) = 0)::int as "blankRut",
          count(*) filter (where slug is null or length(trim(slug)) = 0)::int as "blankSlug",
          count(*) filter (where display_name is null or length(trim(display_name)) = 0)::int as "blankDisplayName",
          count(*) filter (where legal_name is null or length(trim(legal_name)) = 0)::int as "blankLegalName"
        from organizations
      ),
      duplicate_checks as (
        select
          (
            select count(*)::int
            from (
              select regexp_replace(lower(rut), '[^0-9k]', '', 'g')
              from organizations
              group by regexp_replace(lower(rut), '[^0-9k]', '', 'g')
              having count(*) > 1
            ) d
          ) as "duplicateNormalizedRut",
          (
            select count(*)::int
            from (
              select lower(trim(slug))
              from organizations
              group by lower(trim(slug))
              having count(*) > 1
            ) d
          ) as "duplicateNormalizedSlug",
          (
            select count(*)::int
            from (
              select lower(trim(display_name))
              from organizations
              where length(trim(display_name)) > 0
              group by lower(trim(display_name))
              having count(*) > 1
            ) d
          ) as "duplicateNormalizedName"
      ),
      obligation_checks as (
        select
          count(*) filter (where rp.id is null)::int as "obligationsWithoutPeriod",
          count(*) filter (where o.id is null)::int as "obligationsWithoutOrganization",
          count(*) filter (where ro.unit not in ('kg','l'))::int as "invalidUnits",
          count(*) filter (where ro.quantity < 0)::int as "invalidQuantities"
        from rep_obligations ro
        left join organizations o on o.id = ro.organization_id
        left join reporting_periods rp on rp.id = ro.reporting_period_id
      )
      select *
      from organization_checks
      cross join duplicate_checks
      cross join obligation_checks
    `;

    const normalizedIssues = issues ?? emptyIssues;
    const issueCount = Object.values(normalizedIssues).reduce(
      (sum, value) => sum + Number(value ?? 0),
      0
    );

    return {
      state: "ready",
      checkedAt,
      organizations: counts?.organizations ?? 0,
      obligations: counts?.obligations ?? 0,
      reportingPeriods: counts?.reportingPeriods ?? 0,
      clientDirectory: counts?.clientDirectory ?? 0,
      issues: normalizedIssues,
      issueCount
    };
  } catch {
    return {
      state: "unavailable",
      checkedAt,
      organizations: 0,
      obligations: 0,
      reportingPeriods: 0,
      clientDirectory: 0,
      issues: emptyIssues,
      issueCount: 0
    };
  }
}
