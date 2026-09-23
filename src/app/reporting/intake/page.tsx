import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  importReportingFile,
  listRecentReportingImports,
  validateReportingUpload
} from "@/lib/reporting-intake";

export const dynamic = "force-dynamic";

async function importFileAction(formData: FormData) {
  "use server";

  const file = formData.get("file");
  const rawType = String(formData.get("type") ?? "");
  const type =
    rawType === "MARKET_INTRODUCTIONS"
      ? "MARKET_INTRODUCTIONS"
      : rawType === "WASTE_OPERATIONS"
        ? "WASTE_OPERATIONS"
        : null;

  if (!(file instanceof File) || !type) {
    redirect("/reporting/intake?result=invalid");
  }

  const validationError = validateReportingUpload(file.name, file.size);
  if (validationError) {
    const params = new URLSearchParams({
      result: "rejected",
      detail: validationError
    });
    redirect("/reporting/intake?" + params.toString());
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importReportingFile({
    subjectRef: "recycla-os",
    type,
    fileName: file.name,
    buffer
  });

  revalidatePath("/reporting/intake");
  revalidatePath("/reporting");
  revalidatePath("/audit");

  const params = new URLSearchParams({
    result: result.status.toLowerCase(),
    accepted: String(result.acceptedRows),
    rejected: String(result.rejectedRows)
  });

  redirect("/reporting/intake?" + params.toString());
}

export default async function ReportingIntakePage({
  searchParams
}: {
  searchParams: Promise<{
    result?: string;
    accepted?: string;
    rejected?: string;
    detail?: string;
  }>;
}) {
  const params = await searchParams;
  const imports = await listRecentReportingImports(20);

  return (
    <AppShell active="/reporting">
      <header className="topbar">
        <div>
          <p className="eyebrow">Compliance data intake</p>
          <h1>Reporting Intake</h1>
          <p className="muted">
            Ingresar datos operacionales al pipeline de reporte con validación, lineage, hash e idempotencia antes de tocar un cierre mensual.
          </p>
        </div>
        <div className="period">
          <span>Últimos lotes</span>
          <strong>{imports.length}</strong>
        </div>
      </header>

      {params.result ? (
        <section className={"intakeFeedback intakeFeedback-" + params.result}>
          <strong>{params.result.replaceAll("_", " ").toUpperCase()}</strong>
          <span>
            {params.detail
              ? params.detail
              : `${params.accepted ?? "0"} filas aceptadas · ${params.rejected ?? "0"} rechazadas`}
          </span>
        </section>
      ) : null}

      <section className="bottomGrid intakeGrid">
        <article className="panel">
          <p className="eyebrow">01 · Introducción al mercado</p>
          <h3>Cargar productos introducidos y transacciones.</h3>
          <p className="muted">
            XLSX o CSV. Requiere fecha, producto prioritario y al menos unidades o cantidad.
          </p>

          <form action={importFileAction} className="intakeForm">
            <input type="hidden" name="type" value="MARKET_INTRODUCTIONS" />
            <label>
              <span>Archivo</span>
              <input
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
              />
            </label>
            <button type="submit">Validar e importar</button>
          </form>

          <a className="templateLink" href="/templates/rep-market-introductions.csv" download>
            Descargar plantilla CSV →
          </a>

          <div className="intakeFields">
            <span>fecha</span>
            <span>producto prioritario</span>
            <span>categoría / subcategoría</span>
            <span>unidades o cantidad</span>
            <span>consumidor</span>
            <span>documento tributario</span>
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">02 · Operaciones de gestión</p>
          <h3>Cargar recolección, tratamiento y valorización.</h3>
          <p className="muted">
            XLSX o CSV. Requiere fecha, producto prioritario, tipo de operación, cantidad y unidad.
          </p>

          <form action={importFileAction} className="intakeForm">
            <input type="hidden" name="type" value="WASTE_OPERATIONS" />
            <label>
              <span>Archivo</span>
              <input
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
              />
            </label>
            <button type="submit">Validar e importar</button>
          </form>

          <a className="templateLink" href="/templates/rep-waste-operations.csv" download>
            Descargar plantilla CSV →
          </a>

          <div className="intakeFields">
            <span>fecha</span>
            <span>producto prioritario</span>
            <span>tipo operación</span>
            <span>gestor / contraparte</span>
            <span>cantidad + unidad</span>
            <span>costo + documento tributario</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Import lineage</p>
            <h3>Historial de lotes procesados.</h3>
          </div>
          <Link className="buttonLink" href="/reporting">Volver a Report Readiness →</Link>
        </div>

        {imports.length ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Aceptadas</th>
                  <th>Rechazadas</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((batch) => (
                  <tr key={batch.id}>
                    <td><strong>{batch.fileName ?? "Sin nombre"}</strong></td>
                    <td>{batch.type.replaceAll("_", " ")}</td>
                    <td><span className={"auditTag audit-" + (batch.status === "IMPORTED" ? "info" : batch.status === "PARTIAL" ? "warning" : "critical")}>{batch.status}</span></td>
                    <td>{batch.totalRows}</td>
                    <td>{batch.acceptedRows}</td>
                    <td>{batch.rejectedRows}</td>
                    <td>{new Date(batch.createdAt).toLocaleString("es-CL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            <strong>Sin importaciones todavía.</strong>
            <p>El historial aparecerá aquí cuando se procese el primer archivo real de Recycla.</p>
          </div>
        )}
      </section>

      <section className="panel ledgerRule">
        <p className="eyebrow">Integrity rule</p>
        <h3>Importar no significa reportar.</h3>
        <p className="muted">
          Cada archivo se valida primero. Sólo filas válidas llegan al modelo normalizado, y el cierre mensual continúa en DRAFT hasta pasar reconciliación y auditoría.
        </p>
      </section>
    </AppShell>
  );
}
