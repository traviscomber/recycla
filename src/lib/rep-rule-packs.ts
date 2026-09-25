import type { PriorityStream } from "@/lib/rep";

export type RepRuleStatus =
  | "ENFORCEABLE"
  | "PUBLISHED_IMPLEMENTATION"
  | "DRAFT"
  | "REGULATORY_REVIEW";

export type RepRulePack = {
  stream: PriorityStream;
  version: string;
  status: RepRuleStatus;
  sourceTitle: string;
  sourceUrl: string;
  effectiveFrom: string | null;
  enforceable: boolean;
  enginePolicy: "APPLY" | "MONITOR_ONLY";
  summary: string;
};

export const repRulePacks: Record<PriorityStream, RepRulePack> = {
  NEUMATICOS: {
    stream: "NEUMATICOS",
    version: "DS-8-2019",
    status: "ENFORCEABLE",
    sourceTitle: "Decreto de Metas REP de Neumáticos",
    sourceUrl: "https://economiacircular.mma.gob.cl/neumaticos/",
    effectiveFrom: "2023-01-20",
    enforceable: true,
    enginePolicy: "APPLY",
    summary: "Metas REP vigentes. El motor puede aplicar reglas versionadas del decreto y sus categorías."
  },
  AEE_RAEE: {
    stream: "AEE_RAEE",
    version: "DS-22-2025",
    status: "PUBLISHED_IMPLEMENTATION",
    sourceTitle: "DS 22/2025 · Pilas y Aparatos Eléctricos y Electrónicos",
    sourceUrl: "https://economiacircular.mma.gob.cl/aparatos-electricos-y-electronicos/",
    effectiveFrom: null,
    enforceable: false,
    enginePolicy: "MONITOR_ONLY",
    summary: "Decreto publicado. Las fechas y obligaciones aplicables deben provenir de la versión oficial antes de activar cálculos automáticos."
  },
  PILAS: {
    stream: "PILAS",
    version: "DS-22-2025",
    status: "PUBLISHED_IMPLEMENTATION",
    sourceTitle: "DS 22/2025 · Pilas y Aparatos Eléctricos y Electrónicos",
    sourceUrl: "https://economiacircular.mma.gob.cl/aparatos-electricos-y-electronicos/",
    effectiveFrom: null,
    enforceable: false,
    enginePolicy: "MONITOR_ONLY",
    summary: "Decreto publicado. No se activa una meta automática hasta resolver vigencia y categoría desde fuente oficial."
  },
  BATERIAS: {
    stream: "BATERIAS",
    version: "ANTEPROYECTO-RE-821-2026",
    status: "DRAFT",
    sourceTitle: "Anteproyecto de Decreto Supremo de Baterías",
    sourceUrl: "https://economiacircular.mma.gob.cl/baterias/",
    effectiveFrom: null,
    enforceable: false,
    enginePolicy: "MONITOR_ONLY",
    summary: "Proceso regulatorio en elaboración. Las metas del anteproyecto son referencia y no obligaciones vigentes."
  },
  ACEITES_LUBRICANTES: {
    stream: "ACEITES_LUBRICANTES",
    version: "REVISION-2026",
    status: "REGULATORY_REVIEW",
    sourceTitle: "Nuevo decreto de Aceites Lubricantes en elaboración",
    sourceUrl: "https://mma.gob.cl/ministerio-del-medio-ambiente-elaborara-nuevo-decreto-de-aceites-lubricantes/",
    effectiveFrom: null,
    enforceable: false,
    enginePolicy: "MONITOR_ONLY",
    summary: "El MMA informó un nuevo proceso regulatorio tras la sentencia del Segundo Tribunal Ambiental. No aplicar automáticamente las metas del decreto anterior."
  }
};

export type RepRegulatoryMilestone = {
  id: string;
  scope: "ALL_PRODUCTS" | PriorityStream;
  title: string;
  status: "PENDING_EXACT_DATE" | "SCHEDULED";
  startsAt: string | null;
  endsAt: string | null;
  windowLabel: string;
  sourceTitle: string;
  sourceUrl: string;
};

export const repRegulatoryMilestones: RepRegulatoryMilestone[] = [
  {
    id: "declaracion-productores-2026",
    scope: "ALL_PRODUCTS",
    title: "Declaración REP 2026",
    status: "PENDING_EXACT_DATE",
    startsAt: null,
    endsAt: null,
    windowLabel: "4° trimestre 2026 · fechas exactas pendientes de Resolución Exenta",
    sourceTitle: "MMA · período de declaración 2026",
    sourceUrl: "https://portalvu.mma.gob.cl/ley-rep-el-periodo-de-declaracion-2026-para-productores-de-productos-prioritarios-sera-a-partir-del-ultimo-trimestre/"
  }
];

export function getRepRulePack(stream: PriorityStream) {
  return repRulePacks[stream];
}

export function canApplyRegulatoryRule(stream: PriorityStream) {
  const pack = repRulePacks[stream];
  return pack.enforceable && pack.enginePolicy === "APPLY" && Boolean(pack.effectiveFrom);
}
