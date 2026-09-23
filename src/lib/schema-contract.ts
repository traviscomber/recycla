import "server-only";

import { db, hasDatabase } from "@/lib/db";

const requiredColumns: Record<string, readonly string[]> = {
  organizations: ["id", "slug", "display_name", "rut"],
  reporting_periods: ["id", "year"],
  rep_obligations: ["organization_id", "reporting_period_id", "stream", "quantity", "unit"],
  rep_ledger_entries: [
    "id",
    "organization_id",
    "reporting_period_id",
    "stream",
    "state",
    "quantity",
    "unit",
    "source_entity_type",
    "source_entity_id",
    "lineage_root_id",
    "supersedes_entry_id",
    "created_at"
  ],
  documents: ["id", "organization_id", "document_type", "file_name", "checksum_sha256", "created_at"],
  evidence_links: ["id", "document_id", "entity_type", "entity_id", "evidence_role"],
  valuation_outputs: ["id", "lot_id", "quantity_kg", "circularity_route", "valued_at"],
  valuation_allocations: ["id", "valuation_output_id", "organization_id", "quantity_kg"],
  market_introductions: ["id", "subject_ref", "occurred_at", "priority_product", "source_row_hash"],
  waste_management_operations: [
    "id",
    "subject_ref",
    "occurred_at",
    "priority_product",
    "operation_type",
    "quantity",
    "unit",
    "source_row_hash"
  ],
  monthly_rep_reports: ["id", "subject_ref", "reporting_month", "status", "version", "checksum_sha256"],
  compliance_check_runs: ["id", "subject_ref", "status", "started_at", "finished_at"],
  compliance_check_results: ["id", "run_id", "gate_id", "status", "blocking"],
  compliance_findings: ["id", "subject_ref", "reporting_month", "code", "severity", "status"],
  reporting_import_batches: ["id", "subject_ref", "import_type", "file_sha256", "status"],
  external_source_snapshots: ["id", "source_id", "subject_type", "status", "fetched_at"],
  external_source_records: ["id", "source_id", "resource_id", "record_sha256", "ingested_at"],
  external_source_sync_runs: ["id", "source_id", "status", "started_at", "finished_at"],
  historical_reference_totals: ["id", "subject_ref", "reference_year", "category", "quantity", "unit"]
};

export const requiredSchemaTables = Object.keys(requiredColumns);

export type SchemaHealth = {
  state: "not_configured" | "ready" | "schema_missing" | "unavailable";
  checkedAt: string;
  requiredTableCount: number;
  presentTableCount: number;
  missingTables: string[];
  missingColumns: Array<{ table: string; columns: string[] }>;
  detail: string;
};

export async function inspectSchemaContract(): Promise<SchemaHealth> {
  const checkedAt = new Date().toISOString();

  if (!hasDatabase()) {
    return {
      state: "not_configured",
      checkedAt,
      requiredTableCount: requiredSchemaTables.length,
      presentTableCount: 0,
      missingTables: requiredSchemaTables,
      missingColumns: [],
      detail: "DATABASE_URL no está configurada en este entorno."
    };
  }

  try {
    const sql = db();
    const rows = await sql<Array<{ table_name: string; column_name: string }>>`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position
    `;

    const actual = new Map<string, Set<string>>();
    for (const row of rows) {
      const columns = actual.get(row.table_name) ?? new Set<string>();
      columns.add(row.column_name);
      actual.set(row.table_name, columns);
    }

    const missingTables = requiredSchemaTables.filter((table) => !actual.has(table));
    const missingColumns = requiredSchemaTables.flatMap((table) => {
      const columns = actual.get(table);
      if (!columns) return [];
      const missing = requiredColumns[table].filter((column) => !columns.has(column));
      return missing.length ? [{ table, columns: missing }] : [];
    });

    const ready = missingTables.length === 0 && missingColumns.length === 0;

    return {
      state: ready ? "ready" : "schema_missing",
      checkedAt,
      requiredTableCount: requiredSchemaTables.length,
      presentTableCount: requiredSchemaTables.length - missingTables.length,
      missingTables,
      missingColumns,
      detail: ready
        ? "Contrato de esquema REP completo."
        : "La base está conectada, pero no cumple el contrato de esquema requerido."
    };
  } catch {
    return {
      state: "unavailable",
      checkedAt,
      requiredTableCount: requiredSchemaTables.length,
      presentTableCount: 0,
      missingTables: [],
      missingColumns: [],
      detail: "La base está configurada, pero no respondió al diagnóstico de esquema."
    };
  }
}
