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
  { id: "AEE_RAEE", label: "AEE / RAEE", unit: "kg", traceability: "Unidad, lote, peso y destino", regulatoryStage: "Decreto publicado", regulatoryMilestone: "DS 22/2025" },
  { id: "NEUMATICOS", label: "Neumáticos", unit: "kg", traceability: "Unidad/peso, retiro y valorización", regulatoryStage: "Metas vigentes", regulatoryMilestone: "Desde 2023" },
  { id: "BATERIAS", label: "Baterías", unit: "kg", traceability: "Unidad, química, peso y destino", regulatoryStage: "Anteproyecto", regulatoryMilestone: "Proceso 2026 en elaboración" },
  { id: "PILAS", label: "Pilas", unit: "kg", traceability: "Lote, peso y tratamiento", regulatoryStage: "Decreto publicado", regulatoryMilestone: "DS 22/2025" },
  { id: "ACEITES_LUBRICANTES", label: "Aceites lubricantes", unit: "l", traceability: "Volumen, retiro y balance", regulatoryStage: "Nuevo decreto en elaboración", regulatoryMilestone: "MMA 25.08.2026" }
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
    note: "Flujo operativo activo en Recycla."
  },
  {
    id: "ENVASES_EMBALAJES",
    label: "Envases y embalajes",
    operational: false,
    stage: "Metas vigentes",
    milestone: "Desde 2023",
    note: "Monitoreo normativo; fuera del alcance operacional actual."
  },
  {
    id: "ACEITES_LUBRICANTES",
    label: "Aceites lubricantes",
    operational: true,
    stage: "Nuevo decreto en elaboración",
    milestone: "MMA · 25.08.2026",
    note: "El MMA informó un nuevo proceso regulatorio tras sentencia del Segundo Tribunal Ambiental."
  },
  {
    id: "BATERIAS",
    label: "Baterías",
    operational: true,
    stage: "Anteproyecto",
    milestone: "Proceso 2026 en elaboración",
    note: "Las metas del anteproyecto se monitorean, pero no se aplican como obligación vigente."
  },
  {
    id: "PILAS",
    label: "Pilas",
    operational: true,
    stage: "Decreto publicado",
    milestone: "DS 22/2025",
    note: "Mantener la regla en monitoreo hasta resolver vigencia y categoría desde la fuente oficial."
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
    note: "Monitoreo normativo; útil para probar trazabilidad a mayor escala."
  }
];
