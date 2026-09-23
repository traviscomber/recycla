import crypto from "node:crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL || process.env.VERCEL_GIT_COMMIT_REF !== "feat/state-intelligence") {
  console.log("[historical-benchmark] prerequisites missing; skipping.");
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
  idle_timeout: 10
});

const source = {
  subjectRef: "recycla-os",
  referenceYear: 2025,
  metricScope: "ANNUAL_PROCESSED_RESIDUES",
  sourceLabel: "Recycla Chile · Reporte de Sostenibilidad 2025",
  sourceUrl: "https://www.recycla.cl/",
  categories: [
    ["Residuos peligrosos", 17.4, "t"],
    ["Papel", 24.1, "t"],
    ["Vidrio", 8.2, "t"],
    ["Metales ferrosos", 187.3, "t"],
    ["Cartón", 119.8, "t"],
    ["Plásticos", 12.2, "t"],
    ["Metales no ferrosos", 14.8, "t"],
    ["Madera", 94.9, "t"],
    ["Residuos eléctricos y electrónicos", 155.3, "t"]
  ]
};

const sourceChecksum = crypto
  .createHash("sha256")
  .update(JSON.stringify(source))
  .digest("hex");

try {
  await sql`
    create table if not exists historical_reference_totals (
      id uuid primary key default gen_random_uuid(),
      subject_ref text not null,
      reference_year int not null,
      metric_scope text not null,
      category text not null,
      quantity numeric(18,3) not null check (quantity >= 0),
      unit text not null,
      source_label text not null,
      source_url text not null,
      source_checksum_sha256 text,
      captured_at timestamptz not null default now(),
      metadata jsonb not null default '{}'::jsonb,
      unique(subject_ref, reference_year, metric_scope, category, source_url)
    )
  `;

  await sql`
    create index if not exists historical_reference_totals_year_idx
      on historical_reference_totals(subject_ref, reference_year, metric_scope)
  `;

  for (const [category, quantity, unit] of source.categories) {
    await sql`
      insert into historical_reference_totals (
        subject_ref,
        reference_year,
        metric_scope,
        category,
        quantity,
        unit,
        source_label,
        source_url,
        source_checksum_sha256,
        metadata
      ) values (
        ${source.subjectRef},
        ${source.referenceYear},
        ${source.metricScope},
        ${category},
        ${quantity},
        ${unit},
        ${source.sourceLabel},
        ${source.sourceUrl},
        ${sourceChecksum},
        ${sql.json({
          publicReferenceOnly: true,
          interpretation:
            "Aggregate annual value published by Recycla; not transactional evidence or REP compliance proof."
        })}
      )
      on conflict (
        subject_ref,
        reference_year,
        metric_scope,
        category,
        source_url
      )
      do update set
        quantity = excluded.quantity,
        unit = excluded.unit,
        source_label = excluded.source_label,
        source_checksum_sha256 = excluded.source_checksum_sha256,
        metadata = excluded.metadata,
        captured_at = now()
    `;
  }

  const [summary] = await sql`
    select
      count(*)::int as categories,
      sum(quantity)::float8 as total
    from historical_reference_totals
    where subject_ref = 'recycla-os'
      and reference_year = 2025
      and metric_scope = 'ANNUAL_PROCESSED_RESIDUES'
  `;

  console.log(
    "[historical-benchmark] 2025 reference ready:",
    JSON.stringify(summary)
  );
} finally {
  await sql.end({ timeout: 5 });
}
