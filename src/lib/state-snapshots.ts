import "server-only";

import { createHash } from "crypto";
import { db, hasDatabase } from "@/lib/db";
import {
  searchLatestOfficialResource,
  stateSources,
  type VerificationKind
} from "@/lib/state-intelligence";

export type SnapshotStatus =
  | "VERIFIED"
  | "NOT_FOUND"
  | "REVIEW_REQUIRED"
  | "UNAVAILABLE";

export type PersistSnapshotInput = {
  kind: VerificationKind;
  query: string;
  matchIndex?: number;
  subjectType: string;
  subjectId?: string | null;
  status?: SnapshotStatus;
};

function checksum(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function normalizeRecordKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function officialIdentifier(
  record: Record<string, string | number | null>,
  fallback: string
) {
  const priorities = [
    "id_vu",
    "ID Establecimiento VU",
    "ID Establecimiento",
    "RUT",
    "Rut",
    "RUT Destinatario",
    "Identificador"
  ].map(normalizeRecordKey);

  const entries = Object.entries(record).map(([key, value]) => ({
    key: normalizeRecordKey(key),
    value
  }));

  for (const desired of priorities) {
    const match = entries.find(
      (entry) =>
        entry.key === desired &&
        entry.value !== null &&
        entry.value !== undefined &&
        String(entry.value).trim()
    );
    if (match) return String(match.value).trim();
  }

  return fallback;
}

export async function persistOfficialSnapshot(
  input: PersistSnapshotInput
): Promise<{
  ok: boolean;
  snapshotId?: string;
  status: SnapshotStatus;
  detail: string;
}> {
  if (!hasDatabase()) {
    return {
      ok: false,
      status: "UNAVAILABLE",
      detail: "DATABASE_URL no está configurada."
    };
  }

  const sql = db();

  try {
    const table = await sql<Array<{ snapshots: string | null }>>`
      select to_regclass('public.external_source_snapshots')::text as snapshots
    `;

    if (!table[0]?.snapshots) {
      return {
        ok: false,
        status: "UNAVAILABLE",
        detail: "El esquema de State Snapshot todavía no está aplicado."
      };
    }

    const verification = await searchLatestOfficialResource(
      input.kind,
      input.query
    );

    if (verification.status !== "ok" || !verification.resource) {
      return {
        ok: false,
        status: "UNAVAILABLE",
        detail: verification.detail
      };
    }

    const index = input.matchIndex ?? 0;
    const match = verification.matches[index];

    if (!match) {
      const sourceId =
        input.kind === "producer"
          ? "retc-priority-products"
          : input.kind === "hazardous_destination"
            ? "retc-hazardous-destinations"
            : "retc-storage-sites";

      const source = stateSources.find((item) => item.id === sourceId);

      const [row] = await sql<Array<{ id: string }>>`
        insert into external_source_snapshots (
          source_id,
          source_url,
          subject_type,
          subject_id,
          external_identifier,
          status,
          source_modified_at,
          normalized_payload,
          checksum_sha256
        ) values (
          ${sourceId},
          ${verification.resource.url},
          ${input.subjectType},
          ${input.subjectId ?? null},
          ${input.query},
          'NOT_FOUND',
          ${verification.resource.lastModified ?? null},
          ${sql.json({
            query: input.query,
            resourceId: verification.resource.id,
            resourceName: verification.resource.name,
            sourceYear: verification.resource.year ?? null,
            note: "No match in latest official resource at snapshot time."
          })},
          ${checksum({
            query: input.query,
            resourceId: verification.resource.id,
            sourceYear: verification.resource.year ?? null,
            status: "NOT_FOUND"
          })}
        )
        returning id
      `;

      return {
        ok: true,
        snapshotId: row.id,
        status: "NOT_FOUND",
        detail: "Snapshot guardado sin coincidencias en el recurso oficial más reciente."
      };
    }

    const snapshotStatus: SnapshotStatus =
      input.status === "VERIFIED" ? "VERIFIED" : "REVIEW_REQUIRED";

    const externalIdentifier = officialIdentifier(
      match.record,
      input.query
    );

    const source = stateSources.find((item) => item.id === match.sourceId);

    const normalizedPayload = {
      query: input.query,
      matchBasis: match.matchBasis,
      resourceId: match.resourceId,
      resourceName: match.resourceName,
      sourceYear: match.sourceYear ?? null,
      record: match.record
    };

    const [row] = await sql<Array<{ id: string }>>`
      insert into external_source_snapshots (
        source_id,
        source_url,
        subject_type,
        subject_id,
        external_identifier,
        status,
        source_modified_at,
        normalized_payload,
        checksum_sha256
      ) values (
        ${match.sourceId},
        ${source?.officialUrl ?? verification.resource.url},
        ${input.subjectType},
        ${input.subjectId ?? null},
        ${externalIdentifier},
        ${snapshotStatus},
        ${verification.resource.lastModified ?? null},
        ${sql.json(normalizedPayload)},
        ${checksum(normalizedPayload)}
      )
      returning id
    `;

    return {
      ok: true,
      snapshotId: row.id,
      status: snapshotStatus,
      detail:
        snapshotStatus === "VERIFIED"
          ? "Snapshot oficial guardado como verificado."
          : "Snapshot oficial guardado y marcado para revisión."
    };
  } catch (error) {
    return {
      ok: false,
      status: "UNAVAILABLE",
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

export type StateSnapshotSummary = {
  id: string;
  sourceId: string;
  subjectType: string;
  subjectId: string | null;
  subjectLabel: string | null;
  externalIdentifier: string | null;
  status: SnapshotStatus;
  sourceYear: number | null;
  fetchedAt: string;
  sourceModifiedAt: string | null;
};

export async function listRecentSnapshots(limit = 20): Promise<StateSnapshotSummary[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const table = await sql<Array<{ snapshots: string | null }>>`
      select to_regclass('public.external_source_snapshots')::text as snapshots
    `;
    if (!table[0]?.snapshots) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return await sql<StateSnapshotSummary[]>`
      select
        id,
        source_id as "sourceId",
        subject_type as "subjectType",
        subject_id as "subjectId",
        normalized_payload->>'query' as "subjectLabel",
        external_identifier as "externalIdentifier",
        status,
        nullif(normalized_payload->>'sourceYear', '')::int as "sourceYear",
        fetched_at::text as "fetchedAt",
        source_modified_at::text as "sourceModifiedAt"
      from external_source_snapshots
      order by fetched_at desc
      limit ${safeLimit}
    `;
  } catch {
    return [];
  }
}
