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
}> = [
  { id: "AEE_RAEE", label: "AEE / RAEE", unit: "kg", traceability: "Unidad, lote, peso y destino" },
  { id: "NEUMATICOS", label: "Neumáticos", unit: "kg", traceability: "Unidad/peso, retiro y valorización" },
  { id: "BATERIAS", label: "Baterías", unit: "kg", traceability: "Unidad, química, peso y destino" },
  { id: "PILAS", label: "Pilas", unit: "kg", traceability: "Lote, peso y tratamiento" },
  { id: "ACEITES_LUBRICANTES", label: "Aceites lubricantes", unit: "l", traceability: "Volumen, retiro y balance" }
];

export type RepReadiness = {
  client: string;
  stream: PriorityStream;
  period: string;
  obligation: number;
  collected: number;
  processed: number;
  valued: number;
  eligible: number;
  evidenceComplete: number;
  accreditable: number;
  projectedAccreditable: number;
};

export const demo: RepReadiness = {
  client: "Cliente piloto Recycla",
  stream: "AEE_RAEE",
  period: "2027",
  obligation: 128000,
  collected: 117420,
  processed: 113900,
  valued: 109870,
  eligible: 105130,
  evidenceComplete: 98440,
  accreditable: 98440,
  projectedAccreditable: 116700
};

export const auditFindings = [
  { label: "Valorización sin certificado final", kg: 18240, severity: "critical" },
  { label: "Material aún en procesamiento", kg: 7310, severity: "warning" },
  { label: "Diferencia de pesaje", kg: 3120, severity: "warning" },
  { label: "Clasificación REP pendiente", kg: 890, severity: "info" }
] as const;

export const fmt = (n: number) => new Intl.NumberFormat("es-CL").format(Math.round(n));
