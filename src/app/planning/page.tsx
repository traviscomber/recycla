import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listOutcomeCalendarEvents, type OutcomeCalendarEvent } from "@/lib/outcome-planning";
import { fmt } from "@/lib/rep";

export const dynamic = "force-dynamic";

const streamLabels: Record<OutcomeCalendarEvent["stream"], string> = {
  AEE_RAEE: "AEE / RAEE",
  NEUMATICOS: "Neumáticos",
  BATERIAS: "Baterías",
  PILAS: "Pilas",
  ACEITES_LUBRICANTES: "Aceites"
};

function parseAnchor(value?: string) {
  const match = value?.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return new Date();
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
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

function eventLabel(event: OutcomeCalendarEvent) {
  const quantity =
    event.quantity === null || !event.unit
      ? ""
      : `${fmt(event.quantity)} ${event.unit}`;

  return [streamLabels[event.stream], quantity].filter(Boolean).join(" · ");
}

function outcomeLabel(event: OutcomeCalendarEvent) {
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
  }>;
}) {
  const params = await searchParams;
  const anchor = parseAnchor(params.date);
  const range = params.range === "30" ? 30 : params.range === "7" ? 7 : 14;
  const start = startOfDayUtc(anchor);
  const end = addDays(start, range);
  const query = params.q?.trim().toLocaleLowerCase("es-CL") ?? "";
  const layer = params.layer === "planned" || params.layer === "actual" ? params.layer : "all";

  const allEvents = await listOutcomeCalendarEvents({ start, end });
  const events = allEvents.filter((event) => {
    if (layer !== "all" && event.kind !== layer) return false;
    if (!query) return true;
    const haystack = [
      event.client,
      event.site ?? "",
      event.counterparty ?? "",
      streamLabels[event.stream]
    ].join(" ").toLocaleLowerCase("es-CL");
    return haystack.includes(query);
  });

  const days = Array.from({ length: range }, (_, index) => addDays(start, index));
  const todayKey = toDateKey(new Date());
  const plannedCount = events.filter((event) => event.kind === "planned").length;
  const actualCount = events.filter((event) => event.kind === "actual").length;
  const forecastedCount = events.filter(
    (event) => event.kind === "planned" && event.forecastRecoveryPct !== null
  ).length;

  const rowMap = new Map<string, { client: string; site: string | null; events: OutcomeCalendarEvent[] }>();
  for (const event of events) {
    const key = `${event.client}::${event.site ?? "Sin sitio"}`;
    const row = rowMap.get(key) ?? { client: event.client, site: event.site, events: [] };
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
    return `?${next.toString()}`;
  };

  return (
    <AppShell active="/planning">
      <header className="planningTopbar">
        <div>
          <p className="eyebrow">Planificación operacional</p>
          <h1>Calendario de outcomes</h1>
          <p className="muted">
            Planifica retiros y compáralos con resultados históricos antes de ejecutar.
          </p>
        </div>
        <div className="planningRangeLabel">
          <span>Ventana visible</span>
          <strong>{formatMonthRange(start, end)}</strong>
        </div>
      </header>

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

        <form className="planningSearch" method="get">
          <input type="hidden" name="date" value={toDateKey(start)} />
          <input type="hidden" name="range" value={range} />
          {layer !== "all" ? <input type="hidden" name="layer" value={layer} /> : null}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar cliente, sitio, gestor o producto"
            aria-label="Buscar planificación"
          />
          <button type="submit">Buscar</button>
        </form>

        <div className="planningToolbarGroup planningRangePresets" aria-label="Rango visible">
          {[7, 14, 30].map((value) => {
            const next = new URLSearchParams();
            next.set("date", toDateKey(start));
            next.set("range", String(value));
            if (params.q) next.set("q", params.q);
            if (layer !== "all") next.set("layer", layer);
            return (
              <Link className={range === value ? "active" : ""} href={`?${next.toString()}`} key={value}>
                {value}d
              </Link>
            );
          })}
        </div>

        <Link className="buttonLink planningNewAction" href="/reporting/intake">
          Cargar operación →
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
          <span>Con referencia histórica</span>
          <strong>{forecastedCount}</strong>
        </div>
        <nav aria-label="Capas del calendario">
          {[
            ["all", "Todo"],
            ["planned", "Plan"],
            ["actual", "Ejecutado"]
          ].map(([value, label]) => {
            const next = new URLSearchParams();
            next.set("date", toDateKey(start));
            next.set("range", String(range));
            if (params.q) next.set("q", params.q);
            if (value !== "all") next.set("layer", value);
            return (
              <Link className={layer === value ? "active" : ""} href={`?${next.toString()}`} key={value}>
                {label}
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="outcomeCalendarShell">
        <div className="outcomeCalendarScroll">
          <div
            className="outcomeCalendarHeader"
            style={{ gridTemplateColumns: `260px repeat(${days.length}, 56px)` }}
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
              {rows.map((row) => (
                <div
                  className="outcomeCalendarRow"
                  style={{ gridTemplateColumns: `260px repeat(${days.length}, 56px)` }}
                  key={`${row.client}:${row.site ?? "none"}`}
                >
                  <div className="calendarResource">
                    <strong>{row.client}</strong>
                    <span>{row.site ?? "Sin sitio asignado"}</span>
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
                        className={`calendarEvent calendarEvent-${event.kind}`}
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
              <Link className="buttonLink" href="/reporting/intake">Cargar operación →</Link>
            </div>
          )}
        </div>
      </section>

      <section className="planningInsightBand">
        <div>
          <p className="eyebrow">Outcome Twin</p>
          <h3>La proyección sólo aparece cuando existen al menos 3 casos históricos comparables.</h3>
          <p>
            La primera referencia usa resultados reales del mismo cliente y producto. No inventa probabilidades ni
            convierte una correlación histórica en certeza.
          </p>
        </div>
        <div className="planningLegend">
          <span><i className="legendPlanned" /> Planificado</span>
          <span><i className="legendActual" /> Ejecutado</span>
          <span><i className="legendToday" /> Hoy</span>
        </div>
      </section>
    </AppShell>
  );
}
