import type { PriorityStream } from "@/lib/rep";

export type RepRuleStatus =
  | "ENFORCEABLE"
  | "PUBLISHED_IMPLEMENTATION"
  | "DRAFT"
  | "REGULATORY_REVIEW";

export type RepRuleSource = {
  title: string;
  url: string;
  authority: "MMA" | "DIARIO_OFICIAL" | "TRIBUNAL_AMBIENTAL";
  role: "PRIMARY" | "IMPLEMENTATION_GUIDANCE" | "DRAFT_REFERENCE" | "JUDICIAL";
};

export type RepCategory = {
  id: string;
  label: string;
  definition: string;
  targetBearing: boolean;
};

export type RepTargetPoint = {
  periodLabel: string;
  year?: number;
  collectionPct: number | null;
  valorizationPct: number | null;
};

export type RepTargetSchedule = {
  id: string;
  label: string;
  categoryId: string;
  legalStatus: "ENFORCEABLE" | "REFERENCE_ONLY" | "SUPERSEDED_REFERENCE";
  basis: string;
  points: RepTargetPoint[];
  notes?: string[];
};

export type RepCalculationRule = {
  metric: string;
  formula: string;
  basis: string;
  geography: "NATIONAL" | "REGIONAL" | "MIXED";
  notes: string[];
};

export type RepEvidenceRequirement = {
  id: string;
  label: string;
  blocking: boolean;
  appliesTo: string[];
};

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

  regulatedActors: string[];
  categories: RepCategory[];
  exclusions: string[];
  targets: RepTargetSchedule[];
  calculations: RepCalculationRule[];
  allowedValuationRoutes: string[];
  evidenceRequirements: RepEvidenceRequirement[];
  operationalGates: string[];
  sources: RepRuleSource[];
};

const neumTargetA: RepTargetPoint[] = [
  { periodLabel: "2023", year: 2023, collectionPct: 50, valorizationPct: 25 },
  { periodLabel: "2024", year: 2024, collectionPct: 50, valorizationPct: 30 },
  { periodLabel: "2025", year: 2025, collectionPct: 50, valorizationPct: 35 },
  { periodLabel: "2026", year: 2026, collectionPct: 80, valorizationPct: 60 },
  { periodLabel: "2027", year: 2027, collectionPct: 80, valorizationPct: 60 },
  { periodLabel: "2028", year: 2028, collectionPct: 80, valorizationPct: 80 },
  { periodLabel: "2029", year: 2029, collectionPct: 80, valorizationPct: 80 },
  { periodLabel: "2030+", collectionPct: 90, valorizationPct: 90 }
];

const neumTargetB: RepTargetPoint[] = [
  { periodLabel: "2023–2026", collectionPct: 25, valorizationPct: 25 },
  { periodLabel: "2027–2029", collectionPct: 75, valorizationPct: 75 },
  { periodLabel: "2030+", collectionPct: 100, valorizationPct: 100 }
];

const paeeGeneralProposal: RepTargetPoint[] = [
  { periodLabel: "Año 1", collectionPct: 3, valorizationPct: 3 },
  { periodLabel: "Año 2", collectionPct: 5, valorizationPct: 5 },
  { periodLabel: "Año 3", collectionPct: 8, valorizationPct: 8 },
  { periodLabel: "Año 4", collectionPct: 12, valorizationPct: 12 },
  { periodLabel: "Año 5", collectionPct: 16, valorizationPct: 16 },
  { periodLabel: "Año 6", collectionPct: 20, valorizationPct: 20 },
  { periodLabel: "Año 7", collectionPct: 24, valorizationPct: 24 },
  { periodLabel: "Año 8", collectionPct: 30, valorizationPct: 30 },
  { periodLabel: "Año 9", collectionPct: 37, valorizationPct: 37 },
  { periodLabel: "Año 10+", collectionPct: 45, valorizationPct: 45 }
];

const paeeAitProposal: RepTargetPoint[] = [
  { periodLabel: "Año 1", collectionPct: null, valorizationPct: null },
  { periodLabel: "Año 2", collectionPct: null, valorizationPct: null },
  { periodLabel: "Año 3", collectionPct: 6, valorizationPct: 6 },
  { periodLabel: "Año 4", collectionPct: 9, valorizationPct: 9 },
  { periodLabel: "Año 5", collectionPct: 13, valorizationPct: 13 },
  { periodLabel: "Año 6", collectionPct: 17, valorizationPct: 17 },
  { periodLabel: "Año 7", collectionPct: 21, valorizationPct: 21 },
  { periodLabel: "Año 8", collectionPct: 25, valorizationPct: 25 },
  { periodLabel: "Año 9+", collectionPct: 30, valorizationPct: 30 }
];

const batteryLeadDraft: RepTargetPoint[] = [
  { periodLabel: "Año 1", collectionPct: 50, valorizationPct: 50 },
  { periodLabel: "Año 2", collectionPct: 55, valorizationPct: 55 },
  { periodLabel: "Año 3", collectionPct: 60, valorizationPct: 60 },
  { periodLabel: "Año 4", collectionPct: 65, valorizationPct: 65 },
  { periodLabel: "Año 5", collectionPct: 70, valorizationPct: 70 },
  { periodLabel: "Año 6", collectionPct: 75, valorizationPct: 75 },
  { periodLabel: "Año 7", collectionPct: 80, valorizationPct: 80 },
  { periodLabel: "Año 8", collectionPct: 85, valorizationPct: 85 },
  { periodLabel: "Año 9+", collectionPct: 90, valorizationPct: 90 }
];

const batteryLithiumDraft: RepTargetPoint[] = [
  { periodLabel: "Año 1", collectionPct: null, valorizationPct: null },
  { periodLabel: "Año 2", collectionPct: null, valorizationPct: null },
  { periodLabel: "Año 3", collectionPct: 15, valorizationPct: 15 },
  { periodLabel: "Año 4", collectionPct: 20, valorizationPct: 20 },
  { periodLabel: "Año 5", collectionPct: 25, valorizationPct: 25 },
  { periodLabel: "Año 6", collectionPct: 30, valorizationPct: 30 },
  { periodLabel: "Año 7", collectionPct: 35, valorizationPct: 35 },
  { periodLabel: "Año 8", collectionPct: 40, valorizationPct: 40 },
  { periodLabel: "Año 9", collectionPct: 45, valorizationPct: 45 },
  { periodLabel: "Año 10+", collectionPct: 50, valorizationPct: 50 }
];

const oilsHistorical: RepTargetPoint[] = [
  { periodLabel: "Año 1", collectionPct: 50, valorizationPct: 50 },
  { periodLabel: "Año 2", collectionPct: 52, valorizationPct: 52 },
  { periodLabel: "Año 3", collectionPct: 54, valorizationPct: 54 },
  { periodLabel: "Año 4", collectionPct: 59, valorizationPct: 59 },
  { periodLabel: "Año 5", collectionPct: 64, valorizationPct: 64 },
  { periodLabel: "Año 6", collectionPct: 69, valorizationPct: 69 },
  { periodLabel: "Año 7", collectionPct: 73, valorizationPct: 73 },
  { periodLabel: "Año 8", collectionPct: 77, valorizationPct: 77 },
  { periodLabel: "Año 9", collectionPct: 81, valorizationPct: 81 },
  { periodLabel: "Año 10", collectionPct: 85, valorizationPct: 85 },
  { periodLabel: "Año 11", collectionPct: 88, valorizationPct: 88 },
  { periodLabel: "Año 12+", collectionPct: 90, valorizationPct: 90 }
];

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
    summary: "Metas REP vigentes desde el 20 de enero de 2023, con categorías A/B, metas nacionales y obligaciones regionales.",
    regulatedActors: ["Productores/importadores", "Sistemas de gestión", "Gestores", "Comercializadores y distribuidores", "Consumidores"],
    categories: [
      { id: "A", label: "Categoría A", definition: "Aro inferior a 57 pulgadas, excepto aros 45, 49 y 51 pulgadas.", targetBearing: true },
      { id: "B", label: "Categoría B", definition: "Aros 45, 49, 51 pulgadas y aros iguales o superiores a 57 pulgadas.", targetBearing: true }
    ],
    exclusions: ["Neumáticos de bicicletas", "Neumáticos de sillas de ruedas y similares", "Neumáticos macizos"],
    targets: [
      { id: "NFU-A", label: "Categoría A", categoryId: "A", legalStatus: "ENFORCEABLE", basis: "Neumáticos puestos en el mercado en el período base definido por el decreto.", points: neumTargetA },
      { id: "NFU-B", label: "Categoría B", categoryId: "B", legalStatus: "ENFORCEABLE", basis: "Recolección y valorización equivalentes.", points: neumTargetB }
    ],
    calculations: [
      { metric: "Cumplimiento categoría A", formula: "cantidad gestionada / base regulatoria × 100", basis: "Recolección y valorización se evalúan separadamente.", geography: "MIXED", notes: ["Incluye obligaciones nacionales y regionales.", "No mezclar categoría A con B."] },
      { metric: "Valorización circular mínima", formula: "reciclaje material + recauchaje >= 60% de la meta de valorización", basis: "Sobre la meta de valorización aplicable.", geography: "NATIONAL", notes: ["Coprocesamiento y valorización energética pueden computar, sujetos al decreto."] }
    ],
    allowedValuationRoutes: ["Recauchaje", "Reciclaje material", "Coprocesamiento", "Valorización energética"],
    evidenceRequirements: [
      { id: "nfu-origin", label: "Origen y categoría del neumático", blocking: true, appliesTo: ["collection", "accreditation"] },
      { id: "nfu-weight", label: "Pesaje reconciliado", blocking: true, appliesTo: ["collection", "valuation"] },
      { id: "nfu-destination", label: "Gestor y destino autorizado", blocking: true, appliesTo: ["valuation"] },
      { id: "nfu-route", label: "Ruta de valorización", blocking: true, appliesTo: ["accreditation"] }
    ],
    operationalGates: ["Clasificación A/B resuelta", "Período regulatorio válido", "Peso no duplicado", "Gestor/destino trazable", "Ruta de valorización acreditable", "Cobertura regional validada cuando corresponda"],
    sources: [
      { title: "MMA · Neumáticos", url: "https://economiacircular.mma.gob.cl/neumaticos/", authority: "MMA", role: "PRIMARY" },
      { title: "Manual Ley REP · Neumáticos", url: "https://economiacircular.mma.gob.cl/wp-content/uploads/2025/07/4.-Manual-Ley-REP.pdf", authority: "MMA", role: "IMPLEMENTATION_GUIDANCE" }
    ]
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
    summary: "Decreto publicado. El pack conserva estructura y referencias regulatorias, pero el motor no aplica metas hasta verificar vigencia operativa desde la publicación oficial.",
    regulatedActors: ["Productores/importadores", "Sistemas de gestión", "GRANSIC", "Gestores", "Comercializadores", "Consumidores", "Consumidores industriales"],
    categories: [
      { id: "AIT", label: "Aparatos de intercambio de temperatura", definition: "Categoría específica de AEE con meta propia en la propuesta aprobada.", targetBearing: true },
      { id: "PFV", label: "Paneles fotovoltaicos", definition: "Categoría específica de AEE con fórmula y tratamiento regulatorio propio.", targetBearing: true },
      { id: "OTROS_AEE", label: "Otros AEE", definition: "Resto de aparatos eléctricos y electrónicos sujetos al decreto.", targetBearing: true }
    ],
    exclusions: ["Aplican exclusiones específicas del artículo 3 del DS 22/2025; deben resolverse por clasificación antes de acreditar."],
    targets: [
      { id: "PAEE-GENERAL-REF", label: "Meta general Pilas + AEE", categoryId: "OTROS_AEE", legalStatus: "REFERENCE_ONLY", basis: "Propuesta definitiva aprobada en 2025; no se usa para cálculo hasta verificar texto final publicado.", points: paeeGeneralProposal },
      { id: "AEE-AIT-REF", label: "Meta específica AIT", categoryId: "AIT", legalStatus: "REFERENCE_ONLY", basis: "Propuesta definitiva aprobada en 2025; meta específica desde el tercer año.", points: paeeAitProposal }
    ],
    calculations: [
      { metric: "Meta general P+AEE", formula: "100 × (residuos valorizados + aportes válidos de consumidores industriales) / promedio TIM 3 años", basis: "Propuesta definitiva 2025, artículo 22.", geography: "NATIONAL", notes: ["PFV tiene tratamiento específico.", "AIT puede aportar también a meta general."] }
    ],
    allowedValuationRoutes: ["Preparación para la reutilización", "Reciclaje material"],
    evidenceRequirements: [
      { id: "aee-category", label: "Categoría AEE resuelta", blocking: true, appliesTo: ["classification"] },
      { id: "aee-tim", label: "Introducción al mercado trazable", blocking: true, appliesTo: ["target-basis"] },
      { id: "aee-weight", label: "Peso valorizado verificable", blocking: true, appliesTo: ["valuation"] },
      { id: "aee-evidence", label: "Cadena documental del gestor", blocking: true, appliesTo: ["accreditation"] }
    ],
    operationalGates: ["Clasificar AIT/PFV/Otros AEE", "Resolver exclusiones del artículo 3", "Separar PFV de meta general cuando corresponda", "No aplicar porcentajes hasta vigencia verificada", "Conservar TIM histórico de tres años"],
    sources: [
      { title: "MMA · Pilas y AEE", url: "https://economiacircular.mma.gob.cl/aparatos-electricos-y-electronicos/", authority: "MMA", role: "PRIMARY" },
      { title: "Propuesta definitiva P+AEE · Res. Ex. 3413/2025", url: "https://economiacircular.mma.gob.cl/wp-content/uploads/2025/06/Res.-Ex.-3413_2025_Aprueba-Ppta-Decreto-Metas-Pilas-y-Aparatos-Electricos-y-Electronicos.pdf", authority: "MMA", role: "DRAFT_REFERENCE" }
    ]
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
    summary: "Pilas comparte el régimen P+AEE. El sistema debe separar pilas extraíbles de AEE y mantener trazabilidad por peso sin activar metas hasta vigencia verificada.",
    regulatedActors: ["Productores/importadores", "Sistemas de gestión", "GRANSIC", "Gestores", "Comercializadores", "Consumidores"],
    categories: [
      { id: "PILAS", label: "Pilas", definition: "Fuentes electroquímicas bajo el ámbito del DS 22/2025, incluyendo pilas extraíbles de AEE que deban contabilizarse separadamente.", targetBearing: true }
    ],
    exclusions: ["Fuentes electroquímicas de 5 kg o más se tratan bajo el régimen de baterías cuando corresponda.", "Aplican exclusiones específicas del DS 22/2025."],
    targets: [
      { id: "PILAS-GENERAL-REF", label: "Meta general Pilas + AEE", categoryId: "PILAS", legalStatus: "REFERENCE_ONLY", basis: "Propuesta definitiva 2025; referencia hasta verificar texto final operativo.", points: paeeGeneralProposal }
    ],
    calculations: [
      { metric: "Meta general P+AEE", formula: "100 × (residuos valorizados + aportes válidos de consumidores industriales) / promedio TIM 3 años", basis: "Propuesta definitiva 2025.", geography: "NATIONAL", notes: ["Pilas extraíbles de AEE deben contabilizarse separadamente cuando corresponda."] }
    ],
    allowedValuationRoutes: ["Preparación para la reutilización cuando aplique", "Reciclaje material"],
    evidenceRequirements: [
      { id: "pilas-origin", label: "Origen y lote", blocking: true, appliesTo: ["collection"] },
      { id: "pilas-weight", label: "Peso reconciliado", blocking: true, appliesTo: ["valuation"] },
      { id: "pilas-separation", label: "Separación de pilas extraíbles desde AEE", blocking: true, appliesTo: ["classification"] },
      { id: "pilas-destination", label: "Destino y tratamiento documentados", blocking: true, appliesTo: ["accreditation"] }
    ],
    operationalGates: ["Determinar si corresponde a pila o batería", "Resolver extracción desde AEE", "No aplicar meta hasta vigencia verificada", "Mantener peso y origen por lote"],
    sources: [
      { title: "MMA · Pilas y AEE", url: "https://economiacircular.mma.gob.cl/aparatos-electricos-y-electronicos/", authority: "MMA", role: "PRIMARY" },
      { title: "Propuesta definitiva P+AEE · Res. Ex. 3413/2025", url: "https://economiacircular.mma.gob.cl/wp-content/uploads/2025/06/Res.-Ex.-3413_2025_Aprueba-Ppta-Decreto-Metas-Pilas-y-Aparatos-Electricos-y-Electronicos.pdf", authority: "MMA", role: "DRAFT_REFERENCE" }
    ]
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
    summary: "Anteproyecto en elaboración. Recycla modela categorías, trazabilidad y metas propuestas como referencia, pero nunca las trata como obligación vigente.",
    regulatedActors: ["Productores/importadores", "Sistemas de gestión", "Gestores", "Comercializadores", "Talleres vehiculares", "Consumidores"],
    categories: [
      { id: "PLOMO_ACIDO", label: "Plomo-ácido", definition: "Baterías de composición plomo-ácido, independientemente del peso según el anteproyecto.", targetBearing: true },
      { id: "ION_LITIO", label: "Iones de litio", definition: "Baterías de iones de litio dentro del ámbito propuesto.", targetBearing: true },
      { id: "OTRAS", label: "Otras baterías", definition: "Otras composiciones químicas; anteproyecto sin metas propuestas.", targetBearing: false }
    ],
    exclusions: ["Microempresas y productores bajo el umbral propuesto deben resolverse según texto definitivo.", "La segunda vida/reutilización tiene tratamiento específico en el anteproyecto."],
    targets: [
      { id: "BAT-PB-DRAFT", label: "Plomo-ácido", categoryId: "PLOMO_ACIDO", legalStatus: "REFERENCE_ONLY", basis: "Anteproyecto publicado en Diario Oficial el 25-02-2026.", points: batteryLeadDraft },
      { id: "BAT-LI-DRAFT", label: "Iones de litio", categoryId: "ION_LITIO", legalStatus: "REFERENCE_ONLY", basis: "Anteproyecto publicado en Diario Oficial el 25-02-2026.", points: batteryLithiumDraft, notes: ["Metas propuestas; no son exigibles mientras no exista decreto definitivo vigente."] }
    ],
    calculations: [
      { metric: "Plomo-ácido propuesto", formula: "100 × valorización válida / promedio TIM 3 años", basis: "Anteproyecto 2026.", geography: "NATIONAL", notes: ["Sólo residuos de la misma categoría."] },
      { metric: "Ion litio propuesto", formula: "100 × valorización válida / base regulatoria definida por el decreto definitivo", basis: "Anteproyecto 2026.", geography: "NATIONAL", notes: ["Mantener separado de plomo-ácido.", "El texto definitivo puede modificar fórmula, metas u obligaciones."] }
    ],
    allowedValuationRoutes: ["Preparación para la reutilización", "Reciclaje material", "Otras rutas autorizadas por norma definitiva"],
    evidenceRequirements: [
      { id: "battery-chemistry", label: "Composición química", blocking: true, appliesTo: ["classification"] },
      { id: "battery-weight", label: "Peso y unidades", blocking: true, appliesTo: ["collection", "valuation"] },
      { id: "battery-chain", label: "Cadena de custodia y gestor", blocking: true, appliesTo: ["accreditation"] },
      { id: "battery-second-life", label: "Condición de segunda vida cuando corresponda", blocking: true, appliesTo: ["classification"] }
    ],
    operationalGates: ["Clasificar química", "Determinar peso y ámbito", "Distinguir segunda vida de residuo", "No aplicar metas del anteproyecto", "Conservar evidencia de taller/gestor cuando corresponda"],
    sources: [
      { title: "MMA · Baterías", url: "https://economiacircular.mma.gob.cl/baterias/", authority: "MMA", role: "PRIMARY" },
      { title: "Anteproyecto Baterías · Res. Ex. 821/2026", url: "https://economiacircular.mma.gob.cl/wp-content/uploads/2026/02/1.-RE-821-2026-Aprueba-Anteproyecto-REP-Baterias.pdf", authority: "MMA", role: "DRAFT_REFERENCE" }
    ]
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
    summary: "Tras la sentencia del Segundo Tribunal Ambiental, el MMA inició un nuevo proceso. El antiguo DS 47/2023 queda sólo como referencia histórica y no alimenta cumplimiento automático.",
    regulatedActors: ["Productores/importadores", "Sistemas de gestión", "Gestores", "Comercializadores", "Consumidores industriales"],
    categories: [
      { id: "AL_RECUPERABLE", label: "Aceites lubricantes recuperables", definition: "Categoría histórica del DS 47/2023; su uso futuro depende del nuevo decreto.", targetBearing: false }
    ],
    exclusions: ["Cualquier exclusión/categoría del nuevo decreto debe resolverse cuando exista texto oficial definitivo."],
    targets: [
      { id: "AL-HISTORICAL", label: "DS 47/2023 · referencia histórica", categoryId: "AL_RECUPERABLE", legalStatus: "SUPERSEDED_REFERENCE", basis: "Secuencia histórica del DS 47/2023; no aplicar al motor desde la revisión regulatoria 2026.", points: oilsHistorical }
    ],
    calculations: [
      { metric: "Balance físico", formula: "volumen/masa recibida = valorización + stock + pérdidas técnicas justificadas", basis: "Control operacional, no determinación de meta vigente.", geography: "NATIONAL", notes: ["Toda conversión litros↔kg debe quedar explícita y reproducible."] }
    ],
    allowedValuationRoutes: ["Mantener catálogo operacional; acreditación regulatoria se reactivará sólo con nuevo decreto vigente"],
    evidenceRequirements: [
      { id: "oil-origin", label: "Generador y punto de retiro", blocking: true, appliesTo: ["collection"] },
      { id: "oil-volume", label: "Volumen/peso medido", blocking: true, appliesTo: ["valuation"] },
      { id: "oil-conversion", label: "Conversión l↔kg documentada cuando aplique", blocking: true, appliesTo: ["calculation"] },
      { id: "oil-destination", label: "Tratamiento y destino", blocking: true, appliesTo: ["traceability"] }
    ],
    operationalGates: ["No utilizar DS 47/2023 para declarar cumplimiento", "Conservar trazabilidad operacional", "Versionar cualquier nueva propuesta", "Activar APPLY sólo cuando nuevo decreto sea oficial y vigente"],
    sources: [
      { title: "MMA · Nuevo decreto de aceites lubricantes", url: "https://mma.gob.cl/ministerio-del-medio-ambiente-elaborara-nuevo-decreto-de-aceites-lubricantes/", authority: "MMA", role: "PRIMARY" },
      { title: "MMA · Aceites Lubricantes", url: "https://economiacircular.mma.gob.cl/aceites-lubricantes/", authority: "MMA", role: "IMPLEMENTATION_GUIDANCE" }
    ]
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

export function targetForYear(stream: PriorityStream, categoryId: string, year: number) {
  const pack = repRulePacks[stream];
  if (pack.enginePolicy !== "APPLY") return null;

  const schedule = pack.targets.find(
    (item) => item.categoryId === categoryId && item.legalStatus === "ENFORCEABLE"
  );
  if (!schedule) return null;

  const exact = schedule.points.find((point) => point.year === year);
  if (exact) return exact;

  if (stream === "NEUMATICOS") {
    if (categoryId === "A" && year >= 2030) {
      return schedule.points.find((point) => point.periodLabel === "2030+") ?? null;
    }
    if (categoryId === "B") {
      if (year >= 2030) return schedule.points.find((point) => point.periodLabel === "2030+") ?? null;
      if (year >= 2027) return schedule.points.find((point) => point.periodLabel === "2027–2029") ?? null;
      if (year >= 2023) return schedule.points.find((point) => point.periodLabel === "2023–2026") ?? null;
    }
  }

  return null;
}
