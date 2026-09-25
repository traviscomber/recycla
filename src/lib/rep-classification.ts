import type { PriorityStream } from "@/lib/rep";
import { repRulePacks } from "@/lib/rep-rule-packs";

export type RepClassificationStatus = "VERIFIED" | "REVIEW_REQUIRED";

export type RepClassification = {
  stream: PriorityStream | null;
  packVersion: string | null;
  categoryId: string | null;
  status: RepClassificationStatus;
  basis: string;
  sourceValue: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const streamAliases: Record<PriorityStream, string[]> = {
  NEUMATICOS: ["neumaticos", "neumatico", "nfu"],
  AEE_RAEE: ["aee", "raee", "aee raee", "aparatos electricos y electronicos", "aparato electrico y electronico"],
  PILAS: ["pilas", "pila"],
  BATERIAS: ["baterias", "bateria"],
  ACEITES_LUBRICANTES: ["aceites lubricantes", "aceite lubricante", "aceites", "aceite"]
};

const categoryAliases: Partial<Record<PriorityStream, Record<string, string[]>>> = {
  NEUMATICOS: {
    A: ["a", "categoria a", "cat a"],
    B: ["b", "categoria b", "cat b"]
  },
  AEE_RAEE: {
    AIT: ["ait", "aparatos de intercambio de temperatura", "intercambio de temperatura"],
    PFV: ["pfv", "paneles fotovoltaicos", "panel fotovoltaico", "fotovoltaicos"],
    OTROS_AEE: ["otros aee", "otro aee", "otros", "aee otros"]
  },
  PILAS: {
    PILAS: ["pilas", "pila"]
  },
  BATERIAS: {
    PLOMO_ACIDO: ["plomo acido", "plomo-acido", "lead acid", "pb"],
    ION_LITIO: ["ion litio", "iones de litio", "litio", "lithium ion", "li ion"],
    OTRAS: ["otras baterias", "otra bateria", "otras"]
  },
  ACEITES_LUBRICANTES: {
    AL_RECUPERABLE: ["aceites lubricantes recuperables", "aceite lubricante recuperable", "recuperable"]
  }
};

export function resolvePriorityStream(value: string | null | undefined): PriorityStream | null {
  const normalized = normalize(value);
  if (!normalized) return null;

  for (const [stream, aliases] of Object.entries(streamAliases) as Array<[PriorityStream, string[]]>) {
    if (aliases.includes(normalized) || normalize(stream) === normalized) return stream;
  }

  return null;
}

function resolveCategory(stream: PriorityStream, category: string | null | undefined) {
  const pack = repRulePacks[stream];
  const raw = normalize(category);
  const aliases = categoryAliases[stream] ?? {};

  if (raw) {
    for (const item of pack.categories) {
      const candidates = [
        normalize(item.id),
        normalize(item.label),
        ...(aliases[item.id] ?? []).map(normalize)
      ];
      if (candidates.includes(raw)) return item;
    }
    return null;
  }

  if (pack.categories.length === 1) return pack.categories[0] ?? null;
  return null;
}

export function classifyRepInput(input: {
  priorityProduct: string | null | undefined;
  category?: string | null;
  subcategory?: string | null;
}): RepClassification {
  const stream = resolvePriorityStream(input.priorityProduct);
  const sourceValue = [input.priorityProduct, input.category, input.subcategory]
    .filter(Boolean)
    .join(" · ") || null;

  if (!stream) {
    return {
      stream: null,
      packVersion: null,
      categoryId: null,
      status: "REVIEW_REQUIRED",
      basis: "Producto prioritario no reconocido por taxonomía REP controlada.",
      sourceValue
    };
  }

  const pack = repRulePacks[stream];
  const category = resolveCategory(stream, input.category);

  if (!category) {
    return {
      stream,
      packVersion: pack.version,
      categoryId: null,
      status: "REVIEW_REQUIRED",
      basis: input.category
        ? "Categoría informada no coincide exactamente con la taxonomía versionada del pack."
        : "El pack requiere clasificación de categoría y el dato de origen no la resuelve.",
      sourceValue
    };
  }

  return {
    stream,
    packVersion: pack.version,
    categoryId: category.id,
    status: "VERIFIED",
    basis: input.category
      ? "Coincidencia determinística con alias/categoría controlada del pack."
      : "Pack de categoría única; clasificación resuelta sin inferencia probabilística.",
    sourceValue
  };
}

export function regulatoryClassificationCanAccredit(classification: RepClassification) {
  if (
    classification.status !== "VERIFIED" ||
    !classification.stream ||
    !classification.categoryId
  ) {
    return false;
  }
  return repRulePacks[classification.stream].enginePolicy === "APPLY";
}
