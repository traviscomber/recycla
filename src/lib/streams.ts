import type { PriorityStream } from "@/lib/rep";

export type StreamAdapter = {
  id: PriorityStream;
  slug: string;
  label: string;
  subtitle: string;
  primaryUnit: "kg" | "l";
  intakeIdentity: string[];
  mandatoryEvidence: string[];
  massBalance: string;
  auditChecks: string[];
  readinessRule: string;
};

export const streamAdapters: StreamAdapter[] = [
  {
    id: "AEE_RAEE",
    slug: "aee-raee",
    label: "AEE / RAEE",
    subtitle: "Equipos eléctricos y electrónicos",
    primaryUnit: "kg",
    intakeIdentity: [
      "Cliente y punto de generación",
      "Tipo de equipo / categoría",
      "Cantidad de unidades cuando esté disponible",
      "Peso declarado y peso recibido",
      "Lote de recepción"
    ],
    mandatoryEvidence: [
      "Solicitud o guía de retiro",
      "Registro de transporte",
      "Ticket de pesaje",
      "Acta de recepción",
      "Registro de proceso",
      "Certificado de valorización o destino"
    ],
    massBalance: "kg recibidos = materiales valorizados + stock + rechazo + merma",
    auditChecks: [
      "Doble imputación de lote",
      "Diferencia de pesaje",
      "Clasificación REP pendiente",
      "Valorización sin certificado",
      "Cadena de custodia incompleta"
    ],
    readinessRule: "Solo kg elegibles con evidencia completa pueden pasar a acreditable."
  },
  {
    id: "NEUMATICOS",
    slug: "neumaticos",
    label: "Neumáticos",
    subtitle: "Neumáticos fuera de uso",
    primaryUnit: "kg",
    intakeIdentity: [
      "Cliente y origen",
      "Cantidad de unidades",
      "Peso total",
      "Tipo / categoría cuando aplique",
      "Retiro y transportista"
    ],
    mandatoryEvidence: [
      "Registro de retiro",
      "Pesaje",
      "Recepción por gestor",
      "Registro de tratamiento",
      "Destino de valorización",
      "Certificado final"
    ],
    massBalance: "kg recibidos = kg valorizados + stock + rechazo + pérdidas justificadas",
    auditChecks: [
      "Unidades sin peso reconciliado",
      "Destino no documentado",
      "Peso duplicado entre retiros",
      "Tratamiento sin evidencia",
      "Imputación fuera del período"
    ],
    readinessRule: "La valorización debe quedar vinculada al retiro, peso y destino final."
  },
  {
    id: "BATERIAS",
    slug: "baterias",
    label: "Baterías",
    subtitle: "Baterías automotrices e industriales",
    primaryUnit: "kg",
    intakeIdentity: [
      "Cliente y origen",
      "Tipo / química cuando esté disponible",
      "Unidades o lote",
      "Peso",
      "Condición de manejo"
    ],
    mandatoryEvidence: [
      "Retiro",
      "Transporte",
      "Pesaje",
      "Recepción",
      "Tratamiento",
      "Destino y certificado"
    ],
    massBalance: "kg de batería recibida = salidas materiales + stock + residuos de proceso",
    auditChecks: [
      "Tipo de batería no clasificado",
      "Peso faltante",
      "Cadena de custodia incompleta",
      "Destino sin respaldo",
      "Documento vencido o faltante"
    ],
    readinessRule: "Cada lote debe conservar identificación, peso, proceso y destino verificable."
  },
  {
    id: "PILAS",
    slug: "pilas",
    label: "Pilas",
    subtitle: "Pilas portátiles y lotes recolectados",
    primaryUnit: "kg",
    intakeIdentity: [
      "Cliente / punto de recolección",
      "Lote",
      "Peso",
      "Tipo o química cuando esté disponible",
      "Fecha de consolidación"
    ],
    mandatoryEvidence: [
      "Registro de recolección",
      "Pesaje",
      "Recepción",
      "Registro de tratamiento",
      "Destino",
      "Certificado"
    ],
    massBalance: "kg consolidados = kg tratados + stock + rechazo + pérdidas justificadas",
    auditChecks: [
      "Lote sin origen",
      "Peso no reconciliado",
      "Clasificación insuficiente",
      "Destino no acreditado",
      "Certificado pendiente"
    ],
    readinessRule: "La unidad mínima de trazabilidad puede ser el lote, pero nunca debe perder origen y peso."
  },
  {
    id: "ACEITES_LUBRICANTES",
    slug: "aceites-lubricantes",
    label: "Aceites lubricantes",
    subtitle: "Aceite usado y valorización",
    primaryUnit: "l",
    intakeIdentity: [
      "Generador / cliente",
      "Punto de retiro",
      "Volumen declarado",
      "Volumen o peso recibido",
      "Transportista"
    ],
    mandatoryEvidence: [
      "Orden o guía de retiro",
      "Registro de transporte",
      "Medición de volumen / peso",
      "Recepción",
      "Tratamiento o regeneración",
      "Certificado de valorización"
    ],
    massBalance: "volumen/masa recibida = valorización + stock + pérdidas técnicas justificadas",
    auditChecks: [
      "Conversión volumen/peso inconsistente",
      "Retiro sin recepción",
      "Volumen duplicado",
      "Tratamiento sin destino",
      "Certificado faltante"
    ],
    readinessRule: "La conversión entre litros y kg debe quedar explícita, reproducible y asociada a la evidencia."
  }
];

export function getStreamAdapter(slug: string) {
  return streamAdapters.find((stream) => stream.slug === slug);
}
