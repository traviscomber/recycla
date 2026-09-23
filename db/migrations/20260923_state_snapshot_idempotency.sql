-- State Snapshot idempotency
-- Removes exact duplicate snapshots while preserving the newest copy.

delete from external_source_snapshots older
using external_source_snapshots newer
where older.id <> newer.id
  and older.source_id = newer.source_id
  and older.subject_type = newer.subject_type
  and coalesce(older.external_identifier, '') = coalesce(newer.external_identifier, '')
  and coalesce(older.checksum_sha256, '') = coalesce(newer.checksum_sha256, '')
  and older.fetched_at < newer.fetched_at;

create unique index if not exists external_source_snapshots_idempotency_idx
  on external_source_snapshots (
    source_id,
    subject_type,
    external_identifier,
    checksum_sha256
  )
  where checksum_sha256 is not null;
