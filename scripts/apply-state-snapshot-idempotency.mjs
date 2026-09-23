import postgres from "postgres";

if (!process.env.DATABASE_URL || process.env.VERCEL_GIT_COMMIT_REF !== "feat/state-intelligence") {
  console.log("[snapshot-idempotency] prerequisites missing; skipping.");
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
  connect_timeout: 10,
  idle_timeout: 10
});

try {
  const removed = await sql`
    delete from external_source_snapshots older
    using external_source_snapshots newer
    where older.id <> newer.id
      and older.source_id = newer.source_id
      and older.subject_type = newer.subject_type
      and coalesce(older.external_identifier, '') = coalesce(newer.external_identifier, '')
      and coalesce(older.checksum_sha256, '') = coalesce(newer.checksum_sha256, '')
      and older.fetched_at < newer.fetched_at
    returning older.id
  `;

  await sql`
    create unique index if not exists external_source_snapshots_idempotency_idx
      on external_source_snapshots (
        source_id,
        subject_type,
        external_identifier,
        checksum_sha256
      )
      where checksum_sha256 is not null
  `;

  console.log(
    `[snapshot-idempotency] ready; removed ${removed.length} duplicate snapshot(s).`
  );
} finally {
  await sql.end({ timeout: 5 });
}
