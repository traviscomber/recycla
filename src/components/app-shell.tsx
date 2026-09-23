import Link from "next/link";
import { priorityStreams } from "@/lib/rep";

const nav = [
  ["/", "Control Tower"],
  ["/clientes", "Clientes REP"],
  ["/ledger", "REP Ledger"]
] as const;

export function AppShell({
  active,
  children
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <strong>RECYCLA</strong>
            <span>REP OS</span>
          </div>
        </div>

        <nav>
          {nav.map(([href, label]) => (
            <Link className={active === href ? "active" : ""} href={href} key={href}>
              {label}
            </Link>
          ))}
          <a>Evidence Graph</a>
          <a>Audit Room</a>
          <a>Report Readiness</a>
        </nav>

        <div className="scope">
          <span>Alcance MVP</span>
          {priorityStreams.map((s) => <b key={s.id}>{s.label}</b>)}
        </div>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  );
}
