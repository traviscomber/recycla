import "server-only";
import * as XLSX from "xlsx";

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
  url?: string;
  last_modified?: string;
  created?: string;
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

  const seen = new Set(selected.map(([key]) => key));
  const fallback = Object.entries(record)
    .filter(([key, value]) => {
      const cleanKey = key.trim();
      return (
        cleanKey &&
        !cleanKey.startsWith("__EMPTY") &&
        !seen.has(key) &&
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      );
    })
    .map(([key, value]) => [key, value as string | number] as [string, string | number]);

  return [...selected, ...fallback].slice(0, 8);
}


export type LatestResourceInfo = {
  id: string;
  name: string;
  format: string;
  url: string;
  year?: number;
  lastModified?: string;
  datastoreActive: boolean;
};

export async function getLatestOfficialResource(sourceId: string): Promise<LatestResourceInfo | null> {
  const source = stateSources.find((item) => item.id === sourceId);
  if (!source?.datasetSlug) return null;

  try {
    const response = await fetch(
      `${CKAN_BASE}?id=${encodeURIComponent(source.datasetSlug)}`,
      { next: { revalidate: 21600 }, headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as CkanPackageFull;
    const resources = (payload.result?.resources ?? [])
      .filter((resource) => resource.id && resource.url)
      .map((resource) => ({
        ...resource,
        year: extractYear(resource.name)
      }))
      .sort((a, b) => {
        const yearDiff = (b.year ?? 0) - (a.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return String(b.last_modified ?? b.created ?? "").localeCompare(
          String(a.last_modified ?? a.created ?? "")
        );
      });

    const resource = resources[0];
    if (!resource?.id || !resource.url) return null;

    return {
      id: resource.id,
      name: resource.name ?? "Recurso RETC",
      format: String(resource.format ?? "").toUpperCase(),
      url: resource.url,
      year: resource.year,
      lastModified: resource.last_modified ?? resource.created,
      datastoreActive: Boolean(resource.datastore_active)
    };
  } catch {
    return null;
  }
}

function rowText(record: Record<string, unknown>) {
  return Object.values(record)
    .map((value) => String(value ?? "").toLocaleLowerCase("es-CL"))
    .join(" ");
}

export async function fetchLatestRows(resource: LatestResourceInfo) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(resource.url, {
      next: { revalidate: 21600 },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 25 * 1024 * 1024) {
      throw new Error("RESOURCE_TOO_LARGE");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 25 * 1024 * 1024) {
      throw new Error("RESOURCE_TOO_LARGE");
    }

    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

    const candidates = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const preview = XLSX.utils.sheet_to_json<Array<string | number | null>>(sheet, {
        header: 1,
        defval: null,
        raw: false,
        blankrows: false
      });

      const headerIndex = preview
        .slice(0, 30)
        .findIndex((row) => {
          const populated = row.filter(
            (value) => value !== null && String(value).trim() !== ""
          );
          return populated.length >= 3;
        });

      const rows = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(
        sheet,
        {
          defval: null,
          raw: false,
          range: headerIndex >= 0 ? headerIndex : 0
        }
      );

      return {
        sheetName,
        rows: rows.filter((row) =>
          Object.values(row).some(
            (value) => value !== null && String(value).trim() !== ""
          )
        )
      };
    }).sort((a, b) => b.rows.length - a.rows.length);

    return candidates[0]?.rows ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchLatestOfficialResource(
  kind: VerificationKind,
  query: string
): Promise<{
  status: "ok" | "invalid" | "unavailable";
  detail: string;
  resource?: LatestResourceInfo;
  matches: StateMatch[];
}> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 3) {
    return { status: "invalid", detail: "Ingresa al menos 3 caracteres.", matches: [] };
  }

  const sourceId = verificationSourceMap[kind];
  const source = stateSources.find((item) => item.id === sourceId);
  if (!source) {
    return { status: "unavailable", detail: "La fuente oficial no está configurada.", matches: [] };
  }

  const resource = await getLatestOfficialResource(sourceId);
  if (!resource) {
    return { status: "unavailable", detail: "No fue posible resolver el recurso oficial más reciente.", matches: [] };
  }

  try {
    const needle = cleanQuery.toLocaleLowerCase("es-CL");
    const rows = await fetchLatestRows(resource);
    const records = rows.filter((record) => rowText(record).includes(needle)).slice(0, 20);

    return {
      status: "ok",
      detail: records.length
        ? "Coincidencias encontradas en el recurso oficial más reciente publicado por RETC."
        : "No se encontraron coincidencias en el recurso oficial más reciente publicado por RETC.",
      resource,
      matches: records.map((record) => ({
        sourceId: source.id,
        sourceLabel: source.label,
        resourceId: resource.id,
        resourceName: resource.name,
        sourceYear: resource.year,
        isHistorical: resource.year ? resource.year < new Date().getFullYear() - 2 : false,
        status: "REVIEW_REQUIRED",
        matchBasis: "OFFICIAL_DATASET_TEXT_MATCH",
        record
      }))
    };
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "RESOURCE_TOO_LARGE";
    return {
      status: "unavailable",
      detail: tooLarge
        ? "El recurso oficial más reciente supera el límite de lectura en línea; debe procesarse por el worker de ingestión."
        : "No fue posible procesar el recurso oficial más reciente en esta ejecución.",
      resource,
      matches: []
    };
  }
}
