export type PriorityStream =
  | "AEE_RAEE"
  | "NEUMATICOS"
  | "BATERIAS"
  | "PILAS"
  | "ACEITES_LUBRICANTES";

export const priorityStreams: Array<{
  id: PriorityStream;
  label: string;
  unit: "kg" | "l";
  traceability: string;
  regulatoryStage: string;
  regulatoryMilestone: string;
}> = [
  { id: "AEE_RAEE", label: "AEE / RAEE", unit: "kg", traceability: "Unidad, lote, peso y destino", regulatoryStage: "Implementación", regulatoryMilestone: "Metas 2028" },
  { id: "NEUMATICOS", label: "Neumáticos", unit: "kg", traceability: "Unidad/peso, retiro y valorización", regulatoryStage: "Metas vigentes", regulatoryMilestone: "Desde 2023" },
  { id: "BATERIAS", label: "Baterías", unit: "kg", traceability: "Unidad, química, peso y destino", regulatoryStage: "Decreto en elaboración", regulatoryMilestone: "Plazo ampliado" },
  { id: "PILAS", label: "Pilas", unit: "kg", traceability: "Lote, peso y tratamiento", regulatoryStage: "Implementación", regulatoryMilestone: "Metas 2028" },
  { id: "ACEITES_LUBRICANTES", label: "Aceites lubricantes", unit: "l", traceability: "Volumen, retiro y balance", regulatoryStage: "Revisión regulatoria", regulatoryMilestone: "MMA 25.08.2026" }
];

export const fmt = (n: number) => new Intl.NumberFormat("es-CL").format(Math.round(n));


export type RepRegulatoryProduct = {
  id: string;
  label: string;
  operational: boolean;
  stage: string;
  milestone: string;
  note: string;
};

export const repRegulatoryUniverse: RepRegulatoryProduct[] = [
  {
    id: "NEUMATICOS",
    label: "Neumáticos",
    operational: true,
    stage: "Metas vigentes",
    milestone: "Desde 2023",
    note: "Stream operativo en Recycla OS."
  },
  {
    id: "ENVASES_EMBALAJES",
    label: "Envases y embalajes",
    operational: false,
    stage: "Metas vigentes",
    milestone: "Desde 2023",
    note: "Radar regulatorio; fuera del alcance operacional actual."
  },
  {
    id: "ACEITES_LUBRICANTES",
    label: "Aceites lubricantes",
    operational: true,
    stage: "Revisión regulatoria",
    milestone: "MMA · 25.08.2026",
    note: "El MMA informó que elaborará un nuevo decreto."
  },
  {
    id: "BATERIAS",
    label: "Baterías",
    operational: true,
    stage: "Decreto en elaboración",
    milestone: "Plazo ampliado",
    note: "Mantener reglas versionadas mientras avanza el proceso."
  },
  {
    id: "PILAS",
    label: "Pilas",
    operational: true,
    stage: "Implementación",
    milestone: "Metas 2028",
    note: "Preparar datos, sistemas de gestión y evidencia antes de metas."
  },
  {
    id: "AEE_RAEE",
    label: "AEE / RAEE",
    operational: true,
    stage: "Implementación",
    milestone: "Metas 2028",
    note: "Preparar datos, sistemas de gestión y evidencia antes de metas."
  },
  {
    id: "TEXTILES",
    label: "Textiles",
    operational: false,
    stage: "Anteproyecto en elaboración",
    milestone: "7° producto prioritario",
    note: "Radar regulatorio; útil como stress test de trazabilidad masiva."
  }
];
