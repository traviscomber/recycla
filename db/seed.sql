with period as (
  insert into reporting_periods (year, starts_at, ends_at)
  values (2027, '2027-01-01', '2027-12-31')
  on conflict (year) do update set starts_at = excluded.starts_at
  returning id
), org1 as (
  insert into organizations (rut, slug, legal_name, display_name)
  values ('76.000.000-0', 'cliente-piloto-recycla', 'Cliente Piloto Recycla SpA', 'Cliente piloto Recycla')
  on conflict (rut) do update set slug = excluded.slug, display_name = excluded.display_name
  returning id
), org2 as (
  insert into organizations (rut, slug, legal_name, display_name)
  values ('77.100.000-1', 'industria-norte', 'Industria Norte SpA', 'Industria Norte')
  on conflict (rut) do update set slug = excluded.slug, display_name = excluded.display_name
  returning id
), org3 as (
  insert into organizations (rut, slug, legal_name, display_name)
  values ('78.200.000-2', 'operador-industrial-sur', 'Operador Industrial Sur SpA', 'Operador Industrial Sur')
  on conflict (rut) do update set slug = excluded.slug, display_name = excluded.display_name
  returning id
)
insert into rep_obligations (organization_id, reporting_period_id, stream, quantity, unit)
select org1.id, period.id, 'AEE_RAEE', 128000, 'kg' from org1, period
union all select org1.id, period.id, 'BATERIAS', 42000, 'kg' from org1, period
union all select org2.id, period.id, 'NEUMATICOS', 84200, 'kg' from org2, period
union all select org2.id, period.id, 'PILAS', 4200, 'kg' from org2, period
union all select org3.id, period.id, 'ACEITES_LUBRICANTES', 61200, 'l' from org3, period
on conflict (organization_id, reporting_period_id, stream)
do update set quantity = excluded.quantity, unit = excluded.unit;

-- Ledger entries are intentionally not seeded here.
-- Production readiness must come from real operational events and evidence.
