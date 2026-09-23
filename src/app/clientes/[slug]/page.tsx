import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasDatabase } from "@/lib/db";
import { getRepClient } from "@/lib/rep-repository";
import { fmt } from "@/lib/rep";

export const dynamic = "force-dynamic";

function readiness(item: { obligation: number; accreditable: number }) {
  if (item.obligation <= 0) return 0;
  return Math.min(100, (item.accreditable / item.obligation) * 100);
}

function gap(item: { obligation: number; accreditable: number }) {
  return item.accreditable - item.obligation;
}

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!hasDatabase()) notFound();
  const client = await getRepClient(slug);
  if (!client) notFound();
  const values = client.obligations.map(readiness);
  const status = values.length > 0 && values.every((value) => value >= 100) ? "Listo" : values.length > 0 && values.every((value) => value >= 95) ? "Casi listo" : "Atención";
  const gaps = client.obligations.filter((item) => gap(item) < 0);

  return (
    <AppShell active="/clientes">
      <header className="topbar">
        <div><p className="eyebrow">Cliente REP · {client.period}</p><h1>{client.name}</h1><p className="muted">{client.rut} · {client.obligations.length} productos prioritarios activos</p></div>
        <div className="period"><span>Estado consolidado</span><strong>{status}</strong></div>
      </header>
      <section className="clientSummary">
        <article className="card"><span className="label">Productos REP</span><div className="big">{client.obligations.length}</div><p className="muted">Cada producto conserva su propia unidad y meta.</p></article>
        <article className="card"><span className="label">Productos sin gap</span><div className="big">{client.obligations.length - gaps.length}</div><p className="muted">Readiness ≥ 100%.</p></article>
        <article className={gaps.length ? "card risk" : "card"}><span className="label">Productos con gap</span><div className={gaps.length ? "gap" : "big"}>{gaps.length}</div><p className="muted">Requieren acción antes del cierre.</p></article>
      </section>
      <section className="panel">
        <div className="panelHead"><div><p className="eyebrow">Readiness por producto</p><h3>No se mezclan kg y litros en una sola cifra.</h3></div><Link className="buttonLink" href="/clientes">Volver a clientes</Link></div>
        <div className="obligationGrid">
          {client.obligations.map((item) => {
            const pct = readiness(item);
            const currentGap = gap(item);
            return (
              <article className="obligationCard" key={item.stream}>
                <div className="obligationHead"><div><span>{item.label}</span><strong>{pct.toFixed(1)}%</strong></div><b className={currentGap < 0 ? "negative" : "positive"}>{currentGap < 0 ? "" : "+"}{fmt(currentGap)} {item.unit}</b></div>
                <div className="miniProgress large"><div style={{ width: `${pct}%` }} /></div>
                <dl className="metricList">
                  <div><dt>Obligación</dt><dd>{fmt(item.obligation)} {item.unit}</dd></div>
                  <div><dt>Recolectado</dt><dd>{fmt(item.collected)} {item.unit}</dd></div>
                  <div><dt>Valorizado</dt><dd>{fmt(item.valued)} {item.unit}</dd></div>
                  <div><dt>Elegible</dt><dd>{fmt(item.eligible)} {item.unit}</dd></div>
                  <div><dt>Evidencia completa</dt><dd>{fmt(item.evidenceComplete)} {item.unit}</dd></div>
                  <div><dt>Acreditable</dt><dd>{fmt(item.accreditable)} {item.unit}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel ledgerRule"><p className="eyebrow">Consolidación correcta</p><h3>El estado del cliente se consolida por cumplimiento, no sumando unidades incompatibles.</h3><p className="muted">Cada obligación viene de Postgres y mantiene producto, período, unidad y ledger independientes.</p></section>
    </AppShell>
  );
}
