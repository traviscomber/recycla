import Link from "next/link";
import { priorityStreams } from "@/lib/rep";

const streamHref = {
  AEE_RAEE: "/productos/aee-raee",
  NEUMATICOS: "/productos/neumaticos",
  BATERIAS: "/productos/baterias",
  PILAS: "/productos/pilas",
  ACEITES_LUBRICANTES: "/productos/aceites-lubricantes"
} as const;

const primaryNav = [
  ["/", "Inicio", "01"],
  ["/planning", "Calendario", "02"],
  ["/clientes", "Empresas", "03"],
  ["/evidence", "Evidencia", "04"],
  ["/reporting", "Cierre REP", "05"]
] as const;

const secondaryNav = [
  ["/audit", "Auditoría"],
  ["/ledger", "Trazabilidad"],
  ["/state-intelligence", "Fuentes oficiales"],
  ["/regulatory", "Normativa"],
  ["/circularity", "Circularidad"],
  ["/network", "Red REP"]
] as const;

export function AppShell({
  active,
  children
}: {
  active: string;
  children: React.ReactNode;
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

        <div className="railLabel">Operación B2B · Cumplimiento REP</div>


        <nav className="sideNav" aria-label="Navegación principal">
          {primaryNav.map(([href, label, index]) => (
            <Link className={active === href ? "active" : ""} href={href} key={href}>
              <span>{index}</span>
              <strong>{label}</strong>
            </Link>
          ))}
        </nav>

        <details className="secondaryNavGroup" open={secondaryNav.some(([href]) => href === active)}>
          <summary>Más herramientas</summary>
          <nav aria-label="Herramientas avanzadas">
            {secondaryNav.map(([href, label]) => (
              <Link className={active === href ? "active" : ""} href={href} key={href}>
                <strong>{label}</strong>
              </Link>
            ))}
          </nav>
        </details>

        <details className="secondaryNavGroup scope" open={active.startsWith("/productos/")}>
          <summary>Productos REP</summary>
          <div>
            {priorityStreams.map((s) => (
              <Link className="scopeLink" href={streamHref[s.id]} key={s.id}>
                {s.label}
              </Link>
            ))}
          </div>
        </details>

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
          {primaryNav.map(([href, label, index]) => (
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
