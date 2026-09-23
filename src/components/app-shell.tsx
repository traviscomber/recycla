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
  children
}: {
  active: string;
  children: React.ReactNode;
}) {
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
            <span>System state</span>
            <strong>Operational</strong>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <div className="mobileBar">
          <div className="brand compact">
            <div className="mark">R</div>
            <div><strong>RECYCLA</strong><span>REP OS</span></div>
          </div>
          <span className="mobileStatus"><i />Operational</span>
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
