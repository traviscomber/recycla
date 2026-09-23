import "server-only";

import { createHash } from "crypto";
import { db, hasDatabase } from "@/lib/db";
import {
  fetchLatestRows,
  getLatestOfficialResource,
  stateSources
} from "@/lib/state-intelligence";

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstValue(
  record: Record<string, string | number | null>,
  keys: string[]
) {
  const entries = Object.entries(record).map(([key, value]) => ({
    key: normalizeKey(key),
    value
  }));

  for (const desiredKey of keys) {
    const normalizedDesired = normalizeKey(desiredKey);
    const match = entries.find(
      (entry) =>
        entry.key === normalizedDesired &&
        entry.value !== undefined &&
        entry.value !== null &&
        String(entry.value).trim()
    );

    if (match) return String(match.value).trim();
  }

  return null;
}

function firstMatchingValue(
  record: Record<string, string | number | null>,
  patterns: RegExp[]
) {
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() &&
      patterns.some((pattern) => pattern.test(normalized))
    ) {
      return String(value).trim();
    }
  }
  return null;
}

function canonicalName(record: Record<string, string | number | null>) {
  return (
    firstValue(record, [
      "Razón Social",
      "Razon Social",
      "Nombre Establecimiento",
      "Nombre Destinatario",
      "Destinatario"
    ]) ??
    firstMatchingValue(record, [
      /razon.*social/,
      /nombre.*establecimiento/,
      /nombre.*destinatario/,
      /^destinatario$/
    ])
  );
}

function externalIdentifier(record: Record<string, string | number | null>) {
  return (
    firstValue(record, [
      "id_vu",
      "ID Establecimiento VU",
      "ID Establecimiento",
      "RUT",
      "Rut",
      "RUT Destinatario",
      "Identificador"
    ]) ??
    firstMatchingValue(record, [
      /id.*establecimiento/,
      /^rut$/,
      /rut.*destinatario/,
      /identificador/
    ])
  );
}

function stableHash(record: Record<string, string | number | null>) {
  const sorted = Object.keys(record)
    .sort()
    .reduce<Record<string, string | number | null>>((acc, key) => {
      acc[key] = record[key];
      return acc;
    }, {});

  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export type StateSyncResult = {
  sourceId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  rows: number;
  resource?: string;
  year?: number;
  detail: string;
};

export async function syncOfficialSource(sourceId: string): Promise<StateSyncResult> {
  if (!hasDatabase()) {
    return {
      sourceId,
      status: "SKIPPED",
      rows: 0,
      detail: "DATABASE_URL no está configurada."
    };
  }

  const source = stateSources.find((item) => item.id === sourceId);
  if (!source?.datasetSlug) {
    return {
      sourceId,
      status: "SKIPPED",
      rows: 0,
      detail: "La fuente no expone un dataset RETC ingerible."
    };
  }

  const sql = db();

  try {
    const tables = await sql<Array<{ records: string | null; runs: string | null }>>`
      select
        to_regclass('public.external_source_records')::text as records,
        to_regclass('public.external_source_sync_runs')::text as runs
    `;

    if (!tables[0]?.records || !tables[0]?.runs) {
      return {
        sourceId,
        status: "SKIPPED",
        rows: 0,
        detail: "El esquema State Intelligence todavía no está aplicado."
      };
    }

    const resource = await getLatestOfficialResource(sourceId);
    if (!resource) {
      return {
        sourceId,
        status: "FAILED",
        rows: 0,
        detail: "No fue posible resolver el recurso oficial más reciente."
      };
    }

    const [run] = await sql<Array<{ id: string }>>`
      insert into external_source_sync_runs (
        source_id, resource_id, resource_name, source_year, status
      ) values (
        ${sourceId}, ${resource.id}, ${resource.name}, ${resource.year ?? null}, 'RUNNING'
      )
      returning id
    `;

    try {
      const rows = await fetchLatestRows(resource);

      const normalizedByHash = new Map<string, {
        source_id: string;
        resource_id: string;
        resource_name: string;
        source_year: number | null;
        external_identifier: string | null;
        canonical_name: string | null;
        normalized_payload: Record<string, string | number | null>;
        record_sha256: string;
        source_url: string;
      }>();

      for (const record of rows) {
        const recordSha = stableHash(record);
        if (normalizedByHash.has(recordSha)) continue;

        normalizedByHash.set(recordSha, {
          source_id: sourceId,
          resource_id: resource.id,
          resource_name: resource.name,
          source_year: resource.year ?? null,
          external_identifier: externalIdentifier(record),
          canonical_name: canonicalName(record),
          normalized_payload: record,
          record_sha256: recordSha,
          source_url: resource.url
        });
      }

      const normalized = Array.from(normalizedByHash.values());

      await sql`
        delete from external_source_records
        where source_id = ${sourceId}
          and resource_id = ${resource.id}
      `;

      if (normalized.length) {
        for (let index = 0; index < normalized.length; index += 500) {
          const chunk = normalized.slice(index, index + 500);
          await sql`
            insert into external_source_records ${sql(
              chunk,
              "source_id",
              "resource_id",
              "resource_name",
              "source_year",
              "external_identifier",
              "canonical_name",
              "normalized_payload",
              "record_sha256",
              "source_url"
            )}
            on conflict (source_id, resource_id, record_sha256)
            do update set
              external_identifier = excluded.external_identifier,
              canonical_name = excluded.canonical_name,
              normalized_payload = excluded.normalized_payload,
              source_url = excluded.source_url,
              ingested_at = now()
          `;
        }
      }

      await sql`
        update external_source_sync_runs
        set status = 'SUCCESS',
            row_count = ${normalized.length},
            finished_at = now(),
            detail = 'Recurso oficial normalizado e ingerido.'
        where id = ${run.id}
      `;

      return {
        sourceId,
        status: "SUCCESS",
        rows: normalized.length,
        resource: resource.name,
        year: resource.year,
        detail: "Recurso oficial más reciente ingerido correctamente."
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Error desconocido";

      await sql`
        update external_source_sync_runs
        set status = 'FAILED',
            finished_at = now(),
            detail = ${detail.slice(0, 1000)}
        where id = ${run.id}
      `;

      return {
        sourceId,
        status: "FAILED",
        rows: 0,
        resource: resource.name,
        year: resource.year,
        detail
      };
    }
  } catch (error) {
    return {
      sourceId,
      status: "FAILED",
      rows: 0,
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}


export type StateSyncOverview = {
  sourceId: string;
  status: "SUCCESS" | "FAILED" | "RUNNING" | "SKIPPED";
  rowCount: number;
  sourceYear: number | null;
  resourceName: string | null;
  finishedAt: string | null;
};

export async function getStateSyncOverview(): Promise<StateSyncOverview[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const table = await sql<Array<{ runs: string | null }>>`
      select to_regclass('public.external_source_sync_runs')::text as runs
    `;

    if (!table[0]?.runs) return [];

    return await sql<StateSyncOverview[]>`
      select distinct on (source_id)
        source_id as "sourceId",
        status,
        row_count as "rowCount",
        source_year as "sourceYear",
        resource_name as "resourceName",
        finished_at::text as "finishedAt"
      from external_source_sync_runs
      order by source_id, started_at desc
    `;
  } catch {
    return [];
  }
}
