import Link from "next/link";
import { priorityStreams } from "@/lib/rep";

const nav = [
  ["/", "Control Tower", "01"],
  ["/clientes", "Clientes REP", "02"],
  ["/ledger", "REP Ledger", "03"],
  ["/evidence", "Evidence Graph", "04"],
  ["/audit", "Audit Room", "05"],
  ["/reporting", "Report Readiness", "06"]
] as const;

export function AppShell({
  active,
  children,
  dataMode
}: {
  active: string;
  children: React.ReactNode;
  dataMode?: "demo" | "live";
}) {
  const environment = process.env.VERCEL_ENV === "production" ? "Producción" : process.env.VERCEL_ENV === "preview" ? "Preview" : "Local";

  return (
    <main className="shell shellV2">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <strong>RECYCLA</strong>
            <span>REP OS</span>
          </div>
        </div>

        <div className="railLabel">Operational REP Intelligence</div>

        {dataMode ? (
          <div className={`dataMode dataMode-${dataMode}`}>
            <span>{dataMode === "demo" ? "Datos de demostración" : "Datos operacionales"}</span>
          </div>
        ) : null}

        <nav className="sideNav" aria-label="Navegación principal">
          {nav.map(([href, label, index]) => (
            <Link className={active === href ? "active" : ""} href={href} key={href}>
              <span>{index}</span>
              <strong>{label}</strong>
            </Link>
          ))}
        </nav>

        <div className="scope">
          <span>Streams activos</span>
          {priorityStreams.map((s) => <b key={s.id}>{s.label}</b>)}
        </div>

        <div className="systemState">
          <i />
          <div>
            <span>Entorno</span>
            <strong>{environment}</strong>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <div className="mobileBar">
          <div className="brand compact">
            <div className="mark">R</div>
            <div><strong>RECYCLA</strong><span>REP OS</span></div>
          </div>
          <span className="mobileStatus"><i />{environment}</span>
        </div>

        <nav className="mobileNav" aria-label="Navegación móvil">
          {nav.map(([href, label, index]) => (
            <Link className={active === href ? "active" : ""} href={href} key={href}>
              <span>{index}</span>{label}
            </Link>
          ))}
        </nav>

        {children}
      </section>
    </main>
  );
}
