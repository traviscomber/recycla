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


export type VerificationKind =
  | "producer"
  | "hazardous_destination"
  | "storage_site";

export type StateMatch = {
  sourceId: string;
  sourceLabel: string;
  resourceId: string;
  resourceName: string;
  sourceYear?: number;
  isHistorical: boolean;
  status: "VERIFIED" | "REVIEW_REQUIRED";
  matchBasis: "OFFICIAL_DATASET_TEXT_MATCH";
  record: Record<string, string | number | null>;
};

type CkanResource = {
  id?: string;
  name?: string;
  format?: string;
  datastore_active?: boolean;
};

type CkanPackageFull = {
  success?: boolean;
  result?: {
    resources?: CkanResource[];
  };
};

type DatastorePayload = {
  success?: boolean;
  result?: {
    records?: Array<Record<string, string | number | null>>;
  };
};

const verificationSourceMap: Record<VerificationKind, string> = {
  producer: "retc-priority-products",
  hazardous_destination: "retc-hazardous-destinations",
  storage_site: "retc-storage-sites"
};

function extractYear(value?: string) {
  const years = value?.match(/20\d{2}/g)?.map(Number) ?? [];
  return years.length ? Math.max(...years) : undefined;
}

async function getLatestQueryableResource(source: StateSource) {
  if (!source.datasetSlug) return null;

  const response = await fetch(
    `${CKAN_BASE}?id=${encodeURIComponent(source.datasetSlug)}`,
    {
      next: { revalidate: 21600 },
      headers: { Accept: "application/json" }
    }
  );

  if (!response.ok) return null;
  const payload = (await response.json()) as CkanPackageFull;
  const resources = payload.result?.resources ?? [];

  const queryable = resources
    .filter((resource) => resource.datastore_active && resource.id)
    .map((resource) => ({
      ...resource,
      year: extractYear(resource.name)
    }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  return queryable[0] ?? null;
}

export async function verifyOfficialEntity(
  kind: VerificationKind,
  query: string
): Promise<{
  status: "ok" | "invalid" | "unavailable";
  detail: string;
  queryableYear?: number;
  matches: StateMatch[];
}> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 3) {
    return {
      status: "invalid",
      detail: "Ingresa al menos 3 caracteres.",
      matches: []
    };
  }

  const sourceId = verificationSourceMap[kind];
  const source = stateSources.find((item) => item.id === sourceId);
  if (!source) {
    return {
      status: "unavailable",
      detail: "La fuente oficial no está configurada.",
      matches: []
    };
  }

  try {
    const resource = await getLatestQueryableResource(source);
    if (!resource?.id) {
      return {
        status: "unavailable",
        detail: "La fuente existe, pero no expone actualmente un recurso consultable por CKAN DataStore.",
        matches: []
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(
        `https://datosretc.mma.gob.cl/api/3/action/datastore_search?resource_id=${encodeURIComponent(resource.id)}&q=${encodeURIComponent(cleanQuery)}&limit=20`,
        {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" }
        }
      );

      if (!response.ok) {
        return {
          status: "unavailable",
          detail: `RETC respondió HTTP ${response.status} al buscar.`,
          queryableYear: resource.year,
          matches: []
        };
      }

      const payload = (await response.json()) as DatastorePayload;
      const records = payload.result?.records ?? [];

      return {
        status: "ok",
        detail: records.length
          ? "Coincidencias encontradas en un recurso oficial RETC consultable."
          : "No se encontraron coincidencias en el recurso oficial RETC consultable.",
        queryableYear: resource.year,
        matches: records.map((record) => ({
          sourceId: source.id,
          sourceLabel: source.label,
          resourceId: resource.id as string,
          resourceName: resource.name ?? "Recurso RETC",
          sourceYear: resource.year,
          isHistorical: resource.year ? resource.year < new Date().getFullYear() - 2 : true,
          status: "REVIEW_REQUIRED",
          matchBasis: "OFFICIAL_DATASET_TEXT_MATCH",
          record
        }))
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return {
      status: "unavailable",
      detail: "No fue posible consultar el recurso oficial en esta ejecución.",
      matches: []
    };
  }
}

export function summarizeOfficialRecord(
  record: Record<string, string | number | null>
) {
  const preferred = [
    "Razón Social",
    "Nombre Establecimiento",
    "ID Establecimiento VU",
    "Producto Prioritario",
    "Producto Prioritario (PP)",
    "Categoría PP",
    "Subcategoría PP",
    "Región",
    "Provincia",
    "Comuna",
    "Tipo"
  ];

  const selected: Array<[string, string | number]> = [];
  for (const key of preferred) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      selected.push([key, value]);
    }
  }

  return selected.slice(0, 8);
}
