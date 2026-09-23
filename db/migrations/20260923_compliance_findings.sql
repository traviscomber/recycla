-- Persisted compliance findings generated from reconciliation.

create table if not exists compliance_findings (
  id uuid primary key default gen_random_uuid(),
  subject_ref text not null,
  reporting_month date not null,
  code text not null,
  severity text not null
    check (severity in ('critical','warning','info')),
  status text not null default 'open'
    check (status in ('open','resolved','accepted')),
  detail text not null,
  occurrence_count int not null default 1,
  fingerprint_sha256 text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(subject_ref, reporting_month, fingerprint_sha256)
);

create index if not exists compliance_findings_open_idx
  on compliance_findings(subject_ref, reporting_month, severity, status);
