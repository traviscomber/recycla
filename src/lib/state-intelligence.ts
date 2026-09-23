export type StateSource = {
  id: string;
  label: string;
  agency: "MMA / RETC" | "SMA / SNIFA";
  type: "dataset" | "registry" | "enforcement";
  officialUrl: string;
  datasetSlug?: string;
  purpose: string;
  productUse: string[];
};

export const stateSources: StateSource[] = [
  {
    id: "retc-priority-products",
    label: "REP · Productos Prioritarios",
    agency: "MMA / RETC",
    type: "dataset",
    officialUrl: "https://datosretc.mma.gob.cl/dataset/productos-prioritarios-rep",
    datasetSlug: "productos-prioritarios-rep",
    purpose: "Productores y cantidades declaradas de productos prioritarios.",
    productUse: ["Regulatory Radar", "REP Network", "Contexto oficial"]
  },
  {
    id: "retc-management-systems",
    label: "REP · Sistemas de Gestión Aprobados",
    agency: "MMA / RETC",
    type: "registry",
    officialUrl: "https://datosretc.mma.gob.cl/dataset/sistemas-de-gestion-aprobados",
    datasetSlug: "sistemas-de-gestion-aprobados",
    purpose: "Registro público de sistemas de gestión aprobados.",
    productUse: ["REP Network", "Audit Room"]
  },
  {
    id: "retc-hazardous-destinations",
    label: "Destinatarios de residuos peligrosos",
    agency: "MMA / RETC",
    type: "dataset",
    officialUrl: "https://datosretc.mma.gob.cl/dataset/transferencias-fuera-de-sitio",
    datasetSlug: "transferencias-fuera-de-sitio",
    purpose: "Destinatarios y transferencias de residuos peligrosos reportados.",
    productUse: ["Evidence Graph", "Audit Room", "Gestores / destinos"]
  },
  {
    id: "retc-storage-sites",
    label: "Instalaciones de recepción y almacenamiento",
    agency: "MMA / RETC",
    type: "dataset",
    officialUrl: "https://datosretc.mma.gob.cl/dataset/instalacion-de-recepcion-y-almacenamiento-de-residuos-no-peligrosos",
    datasetSlug: "instalacion-de-recepcion-y-almacenamiento-de-residuos-no-peligrosos",
    purpose: "Instalaciones autorizadas para recepción y almacenamiento de residuos no peligrosos.",
    productUse: ["REP Network", "Audit Room", "Evidence Graph"]
  },
  {
    id: "snifa-enforcement",
    label: "SNIFA · Fiscalización y sancionatorios",
    agency: "SMA / SNIFA",
    type: "enforcement",
    officialUrl: "https://snifa.sma.gob.cl/",
    purpose: "Contexto público de fiscalización, procedimientos y sanciones.",
    productUse: ["Audit Room", "State Snapshot"]
  }
];

export type SourceMetadata = {
  id: string;
  status: "ready" | "unavailable" | "not_applicable";
  lastModified?: string;
  resources?: number;
  detail: string;
};

type CkanPackage = {
  success?: boolean;
  result?: {
    metadata_modified?: string;
    resources?: unknown[];
  };
};

const CKAN_BASE = "https://datosretc.mma.gob.cl/api/3/action/package_show";

export async function getStateSourceMetadata(source: StateSource): Promise<SourceMetadata> {
  if (!source.datasetSlug) {
    return {
      id: source.id,
      status: "not_applicable",
      detail: "Esta fuente no usa el catálogo CKAN de RETC."
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(
      `${CKAN_BASE}?id=${encodeURIComponent(source.datasetSlug)}`,
      {
        next: { revalidate: 21600 },
        signal: controller.signal,
        headers: { Accept: "application/json" }
      }
    );

    if (!response.ok) {
      return {
        id: source.id,
        status: "unavailable",
        detail: `RETC respondió HTTP ${response.status}.`
      };
    }

    const payload = (await response.json()) as CkanPackage;
    if (!payload.success || !payload.result) {
      return {
        id: source.id,
        status: "unavailable",
        detail: "RETC respondió sin metadatos utilizables."
      };
    }

    return {
      id: source.id,
      status: "ready",
      lastModified: payload.result.metadata_modified,
      resources: payload.result.resources?.length ?? 0,
      detail: "Metadatos obtenidos desde el catálogo oficial RETC."
    };
  } catch {
    return {
      id: source.id,
      status: "unavailable",
      detail: "No fue posible consultar RETC en esta ejecución."
    };
  } finally {
    clearTimeout(timeout);
  }
}
