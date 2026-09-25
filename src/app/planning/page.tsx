import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listREPCalendarEvents, type REPCalendarEvent } from "@/lib/outcome-planning";
import { fmt } from "@/lib/rep";

export const revalidate = 60;

const streamLabels: Record<Exclude<REPCalendarEvent["stream"], null>, string> = {
  AEE_RAEE: "AEE / RAEE",
  NEUMATICOS: "Neumáticos",
  BATERIAS: "Baterías",
  PILAS: "Pilas",
  ACEITES_LUBRICANTES: "Aceites"
};

function chileTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function parseAnchor(value?: string) {
  const key = value?.match(/^\d{4}-\d{2}-\d{2}$/) ? value : chileTodayKey();
  const date = new Date(`${key}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? new Date(`${chileTodayKey()}T12:00:00Z`) : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function startOfDayUtc(date: Date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function dayDiff(a: Date, b: Date) {
  return Math.floor((startOfDayUtc(a).getTime() - startOfDayUtc(b).getTime()) / 86400000);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "short",
    day: "2-digit",
    timeZone: "UTC"
  }).format(date).replace(".", "");
}

function formatMonthRange(start: Date, end: Date) {
  const left = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC"
  }).format(start);
  const right = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(addDays(end, -1));
  return `${left} — ${right}`;
}

function eventLabel(event: REPCalendarEvent) {
  if (event.kind === "document") {
    return event.title ?? "Hito";
  }

  const quantity =
    event.quantity === null || !event.unit
      ? ""
      : `${fmt(event.quantity)} ${event.unit}`;

  const stream = event.stream ? streamLabels[event.stream] : "";
  return [stream, quantity].filter(Boolean).join(" · ");
}

function outcomeLabel(event: REPCalendarEvent) {
  if (event.kind === "document") {
    return event.detail ?? "Requiere revisión";
  }

  if (event.kind === "actual") {
    return event.actualRecoveryPct === null
      ? "Resultado pendiente"
      : `${event.actualRecoveryPct.toFixed(0)}% recuperación`;
  }

  if (event.forecastRecoveryPct === null) {
    return event.comparableCases > 0
      ? `${event.comparableCases} casos · base insuficiente`
      : "Sin casos comparables";
  }

  return `≈${event.forecastRecoveryPct.toFixed(0)}% · ${event.comparableCases} casos`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Borrador",
    PLANNED: "Planificado",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "En curso",
    COMPLETED: "Ejecutado"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export default async function PlanningPage({
  searchParams
}: {
  searchParams: Promise<{
    date?: string;
    range?: string;
    q?: string;
    layer?: string;
    created?: string;
    summary?: string;
    company?: string;
  }>;
}) {
  const params = await searchParams;
  const anchor = parseAnchor(params.date);
  const allowedRanges = new Set([7, 14, 21, 30, 45, 60]);
  const requestedRange = Number(params.range ?? "14");
  const range = allowedRanges.has(requestedRange) ? requestedRange : 14;
  const start = startOfDayUtc(anchor);
  const end = addDays(start, range);
  const query = params.q?.trim().toLocaleLowerCase("es-CL") ?? "";
  const layer =
    params.layer === "planned" ||
    params.layer === "actual" ||
    params.layer === "risk"
      ? params.layer
      : "all";
  const showSummary = params.summary === "1";
  const companyFilter = params.company?.trim() ?? "";

  const allEvents = await listREPCalendarEvents({ start, end });
  const companies = [...new Map(allEvents.map((event) => [event.clientSlug, event.client])).entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const events = allEvents.filter((event) => {
    if (layer === "planned" && event.kind !== "planned") return false;
    if (layer === "actual" && event.kind !== "actual") return false;
    if (layer === "risk" && event.kind !== "document") return false;
    if (companyFilter && event.clientSlug !== companyFilter) return false;
    if (!query) return true;
    const haystack = [
      event.client,
      event.site ?? "",
      event.counterparty ?? "",
      event.stream ? streamLabels[event.stream] : "",
      event.title ?? "",
      event.detail ?? ""
    ].join(" ").toLocaleLowerCase("es-CL");
    return haystack.includes(query);
  });

  const days = Array.from({ length: range }, (_, index) => addDays(start, index));
  const dayWidth = range <= 7 ? 72 : range <= 14 ? 56 : range <= 21 ? 44 : range <= 30 ? 38 : range <= 45 ? 32 : 28;
  const todayKey = chileTodayKey();
  const plannedCount = events.filter((event) => event.kind === "planned").length;
  const actualCount = events.filter((event) => event.kind === "actual").length;
  const riskCount = events.filter((event) => event.kind === "document").length;
  const forecastedCount = events.filter(
    (event) => event.kind === "planned" && event.forecastRecoveryPct !== null
  ).length;
  const twinCandidates = events
    .filter(
      (event) =>
        event.kind === "planned" &&
        event.bestComparablePct !== null &&
        event.worstComparablePct !== null
    )
    .sort(
      (a, b) =>
        ((b.bestComparablePct ?? 0) - (b.worstComparablePct ?? 0)) -
        ((a.bestComparablePct ?? 0) - (a.worstComparablePct ?? 0))
    );
  const strongestTwin = twinCandidates[0] ?? null;

  const rowMap = new Map<string, { client: string; clientSlug: string; site: string | null; events: REPCalendarEvent[] }>();
  for (const event of events) {
    const key = `${event.client}::${event.site ?? "Sin sitio"}`;
    const row = rowMap.get(key) ?? { client: event.client, clientSlug: event.clientSlug, site: event.site, events: [] };
    row.events.push(event);
    rowMap.set(key, row);
  }
  const rows = [...rowMap.values()].sort((a, b) =>
    `${a.client} ${a.site ?? ""}`.localeCompare(`${b.client} ${b.site ?? ""}`, "es")
  );

  const querySuffix = (date: Date) => {
    const next = new URLSearchParams();
    next.set("date", toDateKey(date));
    next.set("range", String(range));
    if (params.q) next.set("q", params.q);
    if (layer !== "all") next.set("layer", layer);
    if (showSummary) next.set("summary", "1");
    if (companyFilter) next.set("company", companyFilter);
    return `?${next.toString()}`;
  };

  return (
    <AppShell active="/planning">
      <header className="planningTopbar">
        <div>
          <p className="eyebrow">Planificación operacional</p>
          <h1>Calendario REP</h1>
          <p className="muted">
            Empresas, instalaciones, retiros, ejecución y evidencia relevante para el cumplimiento REP en una sola línea de tiempo.
          </p>
        </div>
        <div className="planningRangeLabel">
          <span>Ventana visible</span>
          <strong>{formatMonthRange(start, end)}</strong>
        </div>
      </header>

      {params.created === "1" ? (
        <section className="intakeFeedback intakeFeedback-imported">
          <strong>PLANIFICACIÓN GUARDADA</strong>
          <span>La operación ya está disponible en el calendario.</span>
        </section>
      ) : null}

      <section className="planningToolbar" aria-label="Controles del calendario">
        <div className="planningToolbarGroup">
          <Link className="calendarButton" href={querySuffix(addDays(start, -range))} aria-label="Período anterior">
            ←
          </Link>
          <Link className="calendarButton calendarButtonPrimary" href={querySuffix(new Date())}>
            Hoy
          </Link>
          <Link className="calendarButton" href={querySuffix(addDays(start, range))} aria-label="Período siguiente">
            →
          </Link>
        </div>

        <form className="planningSearch planningSearchWide" method="get">
          <input type="hidden" name="date" value={toDateKey(start)} />
          <input type="hidden" name="range" value={range} />
          {layer !== "all" ? <input type="hidden" name="layer" value={layer} /> : null}
          {showSummary ? <input type="hidden" name="summary" value="1" /> : null}
          {companyFilter ? <input type="hidden" name="company" value={companyFilter} /> : null}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar cliente, sitio, gestor o producto"
            aria-label="Buscar planificación"
          />
          <button type="submit">Buscar</button>
        </form>

        <div className="planningToolbarGroup planningRangePresets" aria-label="Rango visible">
          {[7, 14, 21, 30, 45, 60].map((value) => {
            const next = new URLSearchParams();
            next.set("date", toDateKey(start));
            next.set("range", String(value));
            if (params.q) next.set("q", params.q);
            if (layer !== "all") next.set("layer", layer);
            if (showSummary) next.set("summary", "1");
            if (companyFilter) next.set("company", companyFilter);
            return (
              <Link className={range === value ? "active" : ""} href={`?${next.toString()}`} key={value}>
                {value}d
              </Link>
            );
          })}
        </div>

        <form className="planningCompanyFilter" method="get">
          <input type="hidden" name="date" value={toDateKey(start)} />
          <input type="hidden" name="range" value={range} />
          {layer !== "all" ? <input type="hidden" name="layer" value={layer} /> : null}
          {showSummary ? <input type="hidden" name="summary" value="1" /> : null}
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          <select name="company" defaultValue={companyFilter} aria-label="Filtrar por empresa">
            <option value="">Todas las empresas</option>
            {companies.map((company) => (
              <option value={company.slug} key={company.slug}>{company.name}</option>
            ))}
          </select>
          <button type="submit">Aplicar</button>
        </form>

        <Link
          className={showSummary ? "calendarButton calendarButtonPrimary" : "calendarButton"}
          href={(() => {
            const next = new URLSearchParams();
            next.set("date", toDateKey(start));
            next.set("range", String(range));
            if (params.q) next.set("q", params.q);
            if (layer !== "all") next.set("layer", layer);
            if (companyFilter) next.set("company", companyFilter);
            if (!showSummary) next.set("summary", "1");
            return `?${next.toString()}`;
          })()}
        >
          Summary
        </Link>

        <Link className="buttonLink planningNewAction" href="/planning/new">
          Nueva planificación →
        </Link>
      </section>

      <section className="planningStatusBar">
        <div>
          <span>Planificadas</span>
          <strong>{plannedCount}</strong>
        </div>
        <div>
          <span>Ejecutadas</span>
          <strong>{actualCount}</strong>
        </div>
        <div>
          <span>Evidencia por revisar</span>
          <strong>{riskCount}</strong>
        </div>
        <div>
          <span>Con referencia histórica</span>
          <strong>{forecastedCount}</strong>
        </div>
        <nav aria-label="Capas del calendario">
          {[
            ["all", "Todo"],
            ["planned", "Plan"],
            ["actual", "Ejecutado"],
            ["risk", "Evidencia"]
          ].map(([value, label]) => {
            const next = new URLSearchParams();
            next.set("date", toDateKey(start));
            next.set("range", String(range));
            if (params.q) next.set("q", params.q);
            if (companyFilter) next.set("company", companyFilter);
            if (showSummary) next.set("summary", "1");
            if (value !== "all") next.set("layer", value);
            return (
              <Link className={layer === value ? "active" : ""} href={`?${next.toString()}`} key={value}>
                {label}
              </Link>
            );
          })}
        </nav>
      </section>

      {showSummary ? (
        <section className="planningSummaryPanel">
          <div>
            <span>Empresas visibles</span>
            <strong>{new Set(events.map((event) => event.clientSlug)).size}</strong>
          </div>
          <div>
            <span>Instalaciones activas</span>
            <strong>{new Set(events.filter((event) => event.site).map((event) => `${event.clientSlug}:${event.site}`)).size}</strong>
          </div>
          <div>
            <span>Planificado</span>
            <strong>{plannedCount}</strong>
          </div>
          <div>
            <span>Ejecutado</span>
            <strong>{actualCount}</strong>
          </div>
          <div className={riskCount ? "attention" : ""}>
            <span>Requieren revisión</span>
            <strong>{riskCount}</strong>
          </div>
        </section>
      ) : null}

      <section className="outcomeCalendarShell b2bCalendarShell">
        <div className="outcomeCalendarScroll">
          <div
            className="outcomeCalendarHeader"
            style={{ gridTemplateColumns: `260px repeat(${days.length}, ${dayWidth}px)` }}
          >
            <div className="calendarResourceHead">
              <strong>Cliente / sitio</strong>
              <span>{rows.length} filas</span>
            </div>
            {days.map((day) => (
              <div className={toDateKey(day) === todayKey ? "today" : ""} key={toDateKey(day)}>
                <span>{formatDay(day).split(" ")[0]}</span>
                <strong>{String(day.getUTCDate()).padStart(2, "0")}</strong>
              </div>
            ))}
          </div>

          {rows.length ? (
            <div className="outcomeCalendarBody">
              {rows.map((row, rowIndex) => (
                <div
                  className={rowIndex === 0 || rows[rowIndex - 1]?.client !== row.client ? "outcomeCalendarRow companyStart" : "outcomeCalendarRow"}
                  style={{ gridTemplateColumns: `260px repeat(${days.length}, ${dayWidth}px)` }}
                  key={`${row.client}:${row.site ?? "none"}`}
                >
                  <div className="calendarResource">
                    <strong>{rowIndex === 0 || rows[rowIndex - 1]?.client !== row.client ? row.client : "↳ " + (row.site ?? "Cuenta")}</strong>
                    <span>{rowIndex === 0 || rows[rowIndex - 1]?.client !== row.client ? row.site ?? "Cuenta corporativa" : row.site ?? "Sin sitio asignado"}</span>
                  </div>

                  {days.map((day) => (
                    <div
                      className={toDateKey(day) === todayKey ? "calendarCell today" : "calendarCell"}
                      key={toDateKey(day)}
                    />
                  ))}

                  {row.events.map((event) => {
                    const eventStart = new Date(event.startAt);
                    const eventEnd = event.endAt ? new Date(event.endAt) : eventStart;
                    const startIndex = Math.max(0, dayDiff(eventStart, start));
                    const endIndex = Math.min(days.length - 1, Math.max(startIndex, dayDiff(eventEnd, start)));
                    const span = Math.max(1, endIndex - startIndex + 1);

                    return (
                      <Link
                        className={`calendarEvent calendarEvent-${event.kind} ${event.severity === "attention" ? "calendarEvent-attention" : ""}`}
                        href={`/clientes/${event.clientSlug}`}
                        style={{
                          gridColumn: `${startIndex + 2} / span ${span}`,
                          gridRow: 1
                        }}
                        title={`${event.client} · ${eventLabel(event)} · ${outcomeLabel(event)}`}
                        key={`${event.kind}:${event.id}`}
                      >
                        <span className="calendarEventState">{statusLabel(event.status)}</span>
                        <strong>{eventLabel(event)}</strong>
                        <small>{outcomeLabel(event)}</small>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="planningEmpty">
              <div>
                <p className="eyebrow">Sin operaciones en esta ventana</p>
                <h2>El calendario está listo para planificar.</h2>
                <p>
                  No agregamos operaciones ficticias. Cuando existan retiros reales o planificación persistida,
                  aparecerán aquí por cliente y sitio.
                </p>
              </div>
              <Link className="buttonLink" href="/planning/new">Planificar retiro →</Link>
            </div>
          )}
        </div>
      </section>

      <section className="planningInsightBand">
        <div>
          <p className="eyebrow">Outcome Twin</p>
          {strongestTwin ? (
            <>
              <h3>
                {strongestTwin.client}: casos comparables van de {strongestTwin.worstComparablePct?.toFixed(0)}% a {strongestTwin.bestComparablePct?.toFixed(0)}% de recuperación.
              </h3>
              <p>
                Referencia actual ≈{strongestTwin.forecastRecoveryPct?.toFixed(0)}% sobre {strongestTwin.comparableCases} casos del mismo cliente y producto. La brecha histórica ayuda a decidir qué revisar antes del retiro.
              </p>
            </>
          ) : (
            <>
              <h3>La proyección se activa con al menos 3 casos históricos comparables.</h3>
              <p>
                La primera referencia usa resultados reales del mismo cliente y producto. No inventa probabilidades ni convierte una correlación histórica en certeza.
              </p>
            </>
          )}
        </div>
        <div className="planningLegend">
          <span><i className="legendPlanned" /> Planificado</span>
          <span><i className="legendActual" /> Ejecutado</span>
          <span><i className="legendRisk" /> Vencimiento</span>
          <span><i className="legendToday" /> Hoy</span>
        </div>
      </section>
    </AppShell>
  );
}
