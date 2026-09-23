import "server-only";

import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { db, hasDatabase } from "@/lib/db";

type IntakeType = "MARKET_INTRODUCTIONS" | "WASTE_OPERATIONS";

type Row = Record<string, string | number | null>;

type IntakeError = {
  row: number;
  field?: string;
  message: string;
};

export type IntakeResult = {
  ok: boolean;
  batchId?: string;
  status: "IMPORTED" | "REJECTED" | "PARTIAL";
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  errors: IntakeError[];
  detail: string;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function firstValue(row: Row, aliases: string[]) {
  const desired = aliases.map(normalizeKey);
  for (const alias of desired) {
    const found = Object.entries(row).find(
      ([key, value]) =>
        normalizeKey(key) === alias &&
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
    );
    if (found) return String(found[1]).trim();
  }
  return null;
}

function numberValue(value: string | null) {
  if (value === null) return null;
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: string | null) {
  if (!value) return null;

  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  if (iso) return iso;

  const match = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const candidates = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const preview = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
      header: 1,
      defval: null,
      raw: false,
      blankrows: false
    });

    const headerIndex = preview.slice(0, 30).findIndex((row) => {
      const populated = row.filter(
        (value) => value !== null && String(value).trim() !== ""
      );
      return populated.length >= 3;
    });

    const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
      defval: null,
      raw: false,
      range: headerIndex >= 0 ? headerIndex : 0
    });

    return {
      sheetName,
      rows: rows.filter((row) =>
        Object.values(row).some(
          (value) => value !== null && String(value).trim() !== ""
        )
      )
    };
  }).sort((a, b) => b.rows.length - a.rows.length);

  return candidates[0]?.rows ?? [];
}

function marketRecord(row: Row, rowNumber: number, subjectRef: string) {
  const occurredAt = dateValue(
    firstValue(row, ["fecha", "fecha operacion", "fecha transaccion", "occurred_at"])
  );
  const priorityProduct = firstValue(row, [
    "producto prioritario",
    "producto",
    "priority_product"
  ]);
  const category = firstValue(row, ["categoria", "category"]);
  const subcategory = firstValue(row, ["subcategoria", "subcategory"]);
  const units = numberValue(firstValue(row, ["unidades", "units"]));
  const quantity = numberValue(
    firstValue(row, ["cantidad", "peso", "quantity"])
  );
  const unit = firstValue(row, ["unidad", "unit"]);
  const consumerRef = firstValue(row, [
    "rut consumidor",
    "consumidor",
    "consumer_ref"
  ]);
  const consumerType = firstValue(row, [
    "tipo consumidor",
    "consumer_type"
  ]);
  const transactionRef = firstValue(row, [
    "documento tributario",
    "folio",
    "factura",
    "transaction_ref"
  ]);
  const sourceDocumentRef = firstValue(row, [
    "documento respaldo",
    "source_document_ref"
  ]);

  const errors: IntakeError[] = [];
  if (!occurredAt) errors.push({ row: rowNumber, field: "fecha", message: "Fecha inválida o ausente." });
  if (!priorityProduct) errors.push({ row: rowNumber, field: "producto prioritario", message: "Producto prioritario requerido." });
  if (units === null && quantity === null) {
    errors.push({ row: rowNumber, field: "cantidad", message: "Debe existir unidades o cantidad." });
  }

  const normalized = {
    subject_ref: subjectRef,
    occurred_at: occurredAt,
    priority_product: priorityProduct,
    category,
    subcategory,
    units,
    quantity,
    unit,
    consumer_ref: consumerRef,
    consumer_type: consumerType,
    transaction_ref: transactionRef,
    source_document_ref: sourceDocumentRef,
    metadata: row
  };

  return { normalized, errors };
}

function wasteRecord(row: Row, rowNumber: number, subjectRef: string) {
  const occurredAt = dateValue(
    firstValue(row, ["fecha", "fecha operacion", "occurred_at"])
  );
  const priorityProduct = firstValue(row, [
    "producto prioritario",
    "producto",
    "priority_product"
  ]);
  const category = firstValue(row, ["categoria", "category"]);
  const subcategory = firstValue(row, ["subcategoria", "subcategory"]);
  const operationType = firstValue(row, [
    "tipo operacion",
    "operacion",
    "operation_type"
  ]);
  const counterpartyRef = firstValue(row, [
    "rut contraparte",
    "rut gestor",
    "counterparty_ref"
  ]);
  const counterpartyName = firstValue(row, [
    "contraparte",
    "gestor",
    "counterparty_name"
  ]);
  const quantity = numberValue(
    firstValue(row, ["cantidad", "peso", "quantity"])
  );
  const unit = firstValue(row, ["unidad", "unit"]);
  const costClp = numberValue(
    firstValue(row, ["costo", "costo clp", "cost_clp"])
  );
  const taxDocumentRef = firstValue(row, [
    "documento tributario",
    "folio",
    "factura",
    "tax_document_ref"
  ]);
  const sourceDocumentRef = firstValue(row, [
    "documento respaldo",
    "source_document_ref"
  ]);

  const errors: IntakeError[] = [];
  if (!occurredAt) errors.push({ row: rowNumber, field: "fecha", message: "Fecha inválida o ausente." });
  if (!priorityProduct) errors.push({ row: rowNumber, field: "producto prioritario", message: "Producto prioritario requerido." });
  if (!operationType) errors.push({ row: rowNumber, field: "tipo operación", message: "Tipo de operación requerido." });
  if (quantity === null || quantity < 0) errors.push({ row: rowNumber, field: "cantidad", message: "Cantidad válida requerida." });
  if (!unit) errors.push({ row: rowNumber, field: "unidad", message: "Unidad requerida." });

  const normalized = {
    subject_ref: subjectRef,
    occurred_at: occurredAt,
    priority_product: priorityProduct,
    category,
    subcategory,
    operation_type: operationType,
    counterparty_ref: counterpartyRef,
    counterparty_name: counterpartyName,
    quantity,
    unit,
    cost_clp: costClp,
    tax_document_ref: taxDocumentRef,
    source_document_ref: sourceDocumentRef,
    metadata: row
  };

  return { normalized, errors };
}

export async function importReportingFile(args: {
  subjectRef: string;
  type: IntakeType;
  fileName: string;
  buffer: Buffer;
}): Promise<IntakeResult> {
  if (!hasDatabase()) {
    return {
      ok: false,
      status: "REJECTED",
      totalRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      errors: [],
      detail: "DATABASE_URL no está configurada."
    };
  }

  if (!args.buffer.length) {
    return {
      ok: false,
      status: "REJECTED",
      totalRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      errors: [],
      detail: "Archivo vacío."
    };
  }

  if (args.buffer.byteLength > 20 * 1024 * 1024) {
    return {
      ok: false,
      status: "REJECTED",
      totalRows: 0,
      acceptedRows: 0,
      rejectedRows: 0,
      errors: [],
      detail: "El archivo supera 20 MB."
    };
  }

  const rows = parseWorkbook(args.buffer);
  const fileSha = createHash("sha256").update(args.buffer).digest("hex");
  const sql = db();

  try {
    const [existing] = await sql<Array<{
      id: string;
      status: "IMPORTED" | "REJECTED" | "PARTIAL";
      totalRows: number;
      acceptedRows: number;
      rejectedRows: number;
      errors: IntakeError[];
    }>>`
      select
        id,
        status,
        total_rows as "totalRows",
        accepted_rows as "acceptedRows",
        rejected_rows as "rejectedRows",
        errors
      from reporting_import_batches
      where subject_ref = ${args.subjectRef}
        and import_type = ${args.type}
        and file_sha256 = ${fileSha}
      limit 1
    `;

    if (existing) {
      return {
        ok: existing.status !== "REJECTED",
        batchId: existing.id,
        status: existing.status,
        totalRows: existing.totalRows,
        acceptedRows: existing.acceptedRows,
        rejectedRows: existing.rejectedRows,
        errors: existing.errors ?? [],
        detail: "Este archivo ya fue procesado; se reutiliza el resultado persistido."
      };
    }

    const [batch] = await sql<Array<{ id: string }>>`
      insert into reporting_import_batches (
        subject_ref,
        import_type,
        file_name,
        file_sha256,
        status,
        total_rows
      ) values (
        ${args.subjectRef},
        ${args.type},
        ${args.fileName},
        ${fileSha},
        'VALIDATING',
        ${rows.length}
      )
      returning id
    `;

    const errors: IntakeError[] = [];
    const accepted: Array<Record<string, unknown>> = [];

    rows.forEach((row, index) => {
      const parsed =
        args.type === "MARKET_INTRODUCTIONS"
          ? marketRecord(row, index + 2, args.subjectRef)
          : wasteRecord(row, index + 2, args.subjectRef);

      if (parsed.errors.length) {
        errors.push(...parsed.errors);
      } else {
        const sourceRowHash = stableHash(parsed.normalized);
        accepted.push({
          ...parsed.normalized,
          import_batch_id: batch.id,
          source_row_hash: sourceRowHash
        });
      }
    });

    if (accepted.length) {
      if (args.type === "MARKET_INTRODUCTIONS") {
        for (let index = 0; index < accepted.length; index += 500) {
          const chunk = accepted.slice(index, index + 500);
          await sql`
            insert into market_introductions ${sql(
              chunk,
              "subject_ref",
              "occurred_at",
              "priority_product",
              "category",
              "subcategory",
              "units",
              "quantity",
              "unit",
              "consumer_ref",
              "consumer_type",
              "transaction_ref",
              "source_document_ref",
              "metadata",
              "import_batch_id",
              "source_row_hash"
            )}
            on conflict (subject_ref, source_row_hash)
            where source_row_hash is not null
            do nothing
          `;
        }
      } else {
        for (let index = 0; index < accepted.length; index += 500) {
          const chunk = accepted.slice(index, index + 500);
          await sql`
            insert into waste_management_operations ${sql(
              chunk,
              "subject_ref",
              "occurred_at",
              "priority_product",
              "category",
              "subcategory",
              "operation_type",
              "counterparty_ref",
              "counterparty_name",
              "quantity",
              "unit",
              "cost_clp",
              "tax_document_ref",
              "source_document_ref",
              "metadata",
              "import_batch_id",
              "source_row_hash"
            )}
            on conflict (subject_ref, source_row_hash)
            where source_row_hash is not null
            do nothing
          `;
        }
      }
    }

    const rejectedRows = new Set(errors.map((error) => error.row)).size;
    const status: IntakeResult["status"] =
      accepted.length === 0
        ? "REJECTED"
        : rejectedRows > 0
          ? "PARTIAL"
          : "IMPORTED";

    await sql`
      update reporting_import_batches
      set
        status = ${status},
        accepted_rows = ${accepted.length},
        rejected_rows = ${rejectedRows},
        errors = ${sql.json(errors.slice(0, 200))},
        completed_at = now()
      where id = ${batch.id}
    `;

    return {
      ok: status !== "REJECTED",
      batchId: batch.id,
      status,
      totalRows: rows.length,
      acceptedRows: accepted.length,
      rejectedRows,
      errors: errors.slice(0, 50),
      detail:
        status === "IMPORTED"
          ? "Archivo validado e importado."
          : status === "PARTIAL"
            ? "Archivo importado parcialmente; existen filas rechazadas."
            : "Archivo rechazado; ninguna fila válida."
    };
  } catch (error) {
    return {
      ok: false,
      status: "REJECTED",
      totalRows: rows.length,
      acceptedRows: 0,
      rejectedRows: rows.length,
      errors: [],
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}

export async function listRecentReportingImports(limit = 20) {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const table = await sql<Array<{ batches: string | null }>>`
      select to_regclass('public.reporting_import_batches')::text as batches
    `;
    if (!table[0]?.batches) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return await sql<Array<{
      id: string;
      type: IntakeType;
      fileName: string | null;
      status: "IMPORTED" | "REJECTED" | "PARTIAL" | "VALIDATING";
      totalRows: number;
      acceptedRows: number;
      rejectedRows: number;
      createdAt: string;
      completedAt: string | null;
    }>>`
      select
        id,
        import_type as type,
        file_name as "fileName",
        status,
        total_rows as "totalRows",
        accepted_rows as "acceptedRows",
        rejected_rows as "rejectedRows",
        created_at::text as "createdAt",
        completed_at::text as "completedAt"
      from reporting_import_batches
      order by created_at desc
      limit ${safeLimit}
    `;
  } catch {
    return [];
  }
}
