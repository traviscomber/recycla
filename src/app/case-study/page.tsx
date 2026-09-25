import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getRecyclaSession } from "@/lib/auth/server";
import { listRepClients } from "@/lib/rep-repository";
import { listEvidenceChains } from "@/lib/evidence-chain";
import { getClient360 } from "@/lib/client-360";

export const dynamic = "force-dynamic";

const CASE_STUDY_EMAIL = "juan@n3uralia.com";

function scoreClient(
  client: Awaited<ReturnType<typeof listRepClients>>[number],
  chains: Awaited<ReturnType<typeof listEvidenceChains>>
) {
  const clientChains = chains.filter((chain) => chain.client === client.name);
  const applicable = client.obligations.filter((item) => item.regulatoryMode === "APPLY");
  const obligationScore = client.obligations.length * 6;
  const applicableScore = applicable.length * 10;
  const chainScore = clientChains.length * 4;
  const coverageScore = clientChains.length
    ? clientChains.reduce((sum, chain) => sum + chain.coveragePercent, 0) / clientChains.length / 4
    : 0;
  const evidenceScore = clientChains.reduce((sum, chain) => sum + Math.min(chain.evidenceCount, 3), 0) * 2;
  const accreditableScore = client.obligations.filter((item) => item.accreditable > 0).length * 8;
  return obligationScore + applicableScore + chainScore + coverageScore + evidenceScore + accreditableScore;
}

export default async function CaseStudyPage() {
  const auth = await getRecyclaSession();
  const email = auth.session?.user?.email?.toLocaleLowerCase("es-CL") ?? "";

  if (email !== CASE_STUDY_EMAIL) {
    redirect("/");
  }

  const [clients, chains] = await Promise.all([
    listRepClients(),
    listEvidenceChains(200)
  ]);

  if (!clients.length) {
    return (
      <AppShell active="/">
        <header className="topbar">
          <div>
            <p className="eyebrow">Caso de estudio REP</p>
            <h1>Sin empresa canónica disponible</h1>
            <p className="muted">
              No se crearon datos ficticios. Esta vista se activa sólo cuando existe una empresa REP real persistida.
            </p>
          </div>
        </header>
      </AppShell>
    );
  }

  const ranked = clients
    .map((client) => ({
      client,
      score: scoreClient(client, chains)
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked[0]!.client;
  const selectedChains = chains.filter((chain) => chain.client === selected.name);
  const ficha = await getClient360(selected.slug);
  const applicable = selected.obligations.filter((item) => item.regulatoryMode === "APPLY");
  const monitorOnly = selected.obligations.filter((item) => item.regulatoryMode === "MONITOR_ONLY");
  const accredited = selected.obligations.reduce((sum, item) => sum + item.accreditable, 0);
  const evidenceCount = selectedChains.reduce((sum, item) => sum + item.evidenceCount, 0);
  const averageCoverage = selectedChains.length
    ? Math.round(selectedChains.reduce((sum, item) => sum + item.coveragePercent, 0) / selectedChains.length)
    : 0;
  const blocked = selectedChains.filter((item) => item.status === "REGULATORY_BLOCKED").length;
  const ready = selectedChains.filter((item) => item.status === "ACCREDITABLE").length;

  return (
    <AppShell active="/">
      <header className="topbar">
        <div>
          <p className="eyebrow">Caso de estudio interno · Juan</p>
          <h1>{selected.name}</h1>
          <p className="muted">
            Seleccionada automáticamente por completitud canónica. No contiene datos ficticios ni cifras simuladas.
          </p>
        </div>
        <div className="period">
          <span>Período</span>
          <strong>{selected.period}</strong>
        </div>
      </header>

      <section className="caseStudyHero panel">
        <div>
          <p className="eyebrow">Por qué esta empresa</p>
          <h2>Es la cadena REP más completa disponible hoy.</h2>
          <p>
            El selector pondera obligaciones persistidas, rule packs aplicables, trazabilidad física,
            evidencia y cantidades acreditables. Si otra empresa supera esta cobertura, el caso cambia automáticamente.
          </p>
        </div>
        <Link className="buttonLink" href={"/clientes/" + selected.slug + "?year=" + selected.period}>
          Abrir Ficha REP 360 →
        </Link>
      </section>

      <section className="caseStudyMetrics">
        <article>
          <span>Obligaciones</span>
          <strong>{selected.obligations.length}</strong>
          <p>{applicable.length} APPLY · {monitorOnly.length} MONITOR_ONLY</p>
        </article>
        <article>
          <span>Cadenas operacionales</span>
          <strong>{selectedChains.length}</strong>
          <p>{averageCoverage}% cobertura promedio</p>
        </article>
        <article>
          <span>Evidencias enlazadas</span>
          <strong>{evidenceCount}</strong>
          <p>{ficha?.documentCount ?? 0} documentos en ficha</p>
        </article>
        <article>
          <span>Estado regulatorio</span>
          <strong>{ready} / {blocked}</strong>
          <p>Acreditables / bloqueadas</p>
        </article>
      </section>

      <section className="panel caseStudyFlow">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Recorrido recomendado</p>
            <h3>Ver el producto como una historia REP completa.</h3>
          </div>
          <span>Datos reales · lectura guiada</span>
        </div>

        <div className="caseStudySteps">
          <Link href={"/clientes/" + selected.slug + "?year=" + selected.period}>
            <span>01</span>
            <div>
              <strong>Empresa y obligación</strong>
              <p>RUT, período, productos prioritarios, regla aplicable y brechas.</p>
            </div>
          </Link>
          <Link href={"/planning?company=" + selected.slug + "&summary=1"}>
            <span>02</span>
            <div>
              <strong>Calendario REP</strong>
              <p>Retiros, ejecución y evidencia relevante en línea de tiempo.</p>
            </div>
          </Link>
          <Link href="/evidence">
            <span>03</span>
            <div>
              <strong>Evidence Chain</strong>
              <p>Operación → pesaje → lote → valorización → evidencia → categoría → rule pack.</p>
            </div>
          </Link>
          <Link href="/ledger">
            <span>04</span>
            <div>
              <strong>Ledger regulatorio</strong>
              <p>Estado, regla, versión, categoría y trazabilidad de cada transición.</p>
            </div>
          </Link>
          <Link href="/regulatory">
            <span>05</span>
            <div>
              <strong>Rule packs</strong>
              <p>Norma, categorías, metas, evidencia mínima y gates de acreditación.</p>
            </div>
          </Link>
          <Link href="/reporting">
            <span>06</span>
            <div>
              <strong>Cierre REP</strong>
              <p>Brechas, validaciones, readiness y salida regulatoria.</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="panel caseStudyEvidence">
        <div className="panelHead">
          <div>
            <p className="eyebrow">Lectura del caso</p>
            <h3>Qué demuestra hoy esta empresa.</h3>
          </div>
        </div>

        <div className="caseStudyFacts">
          <div>
            <span>Cantidad acreditable registrada</span>
            <strong>{Math.round(accredited).toLocaleString("es-CL")}</strong>
            <p>Se mantiene separada por unidad/producto en las vistas operacionales.</p>
          </div>
          <div>
            <span>Operaciones físicas</span>
            <strong>{ficha?.collectionCount ?? selectedChains.length}</strong>
            <p>Última: {ficha?.lastCollectionAt ? new Date(ficha.lastCollectionAt).toLocaleDateString("es-CL") : "sin fecha disponible"}</p>
          </div>
          <div>
            <span>Ledger</span>
            <strong>{ficha?.ledgerEventCount ?? 0}</strong>
            <p>Último evento: {ficha?.lastLedgerAt ? new Date(ficha.lastLedgerAt).toLocaleDateString("es-CL") : "sin evento disponible"}</p>
          </div>
          <div>
            <span>Hallazgos abiertos</span>
            <strong>{ficha?.reporting.openFindings ?? 0}</strong>
            <p>{ficha?.reporting.criticalFindings ?? 0} críticos</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
