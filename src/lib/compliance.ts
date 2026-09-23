export type ComplianceGateStatus =
  | "LIVE"
  | "READY"
  | "REVIEW_REQUIRED"
  | "BLOCKED"
  | "NOT_CONNECTED";

export type ComplianceGate = {
  id: string;
  label: string;
  legalBasis: string;
  requirement: string;
  evidence: string;
  status: ComplianceGateStatus;
  blocking: boolean;
};

export const complianceSources = {
  law20920: {
    label: "Ley 20.920 · art. 22(c), 37, 38",
    url: "https://nuevo.leychile.cl/navegar?idNorma=1090894"
  },
  res2084: {
    label: "SMA · Res. Ex. 2084/2023",
    url: "https://www.leychile.cl/navegar?idNorma=1199515"
  },
  res2279: {
    label: "SMA · Res. Ex. 2279/2024",
    url: "https://www.leychile.cl/navegar?idNorma=1209251&idParte=10527327&idVersion=2024-12-12"
  },
  sisrep: {
    label: "SMA · Instructivo y reporte SISREP",
    url: "https://portal.sma.gob.cl/index.php/ley-rep/instructivo-y-reporte/"
  },
  declaration2026: {
    label: "MMA · Declaración REP 2026",
    url: "https://portalvu.mma.gob.cl/ley-rep-el-periodo-de-declaracion-2026-para-productores-de-productos-prioritarios-sera-a-partir-del-ultimo-trimestre/"
  },
  annualNfu2025: {
    label: "SMA · Reporte anual 2025 NFU",
    url: "https://portal.sma.gob.cl/wp-content/uploads/2026/03/ReporteAnualNFU.xlsx"
  },
  annualPackaging2025: {
    label: "SMA · Reporte anual 2025 envases",
    url: "https://portal.sma.gob.cl/wp-content/uploads/2026/04/ReporteAnualEnvases.xlsx"
  }
} as const;

export const auditScope = [
  {
    id: "classification",
    label: "Clasificación",
    legalBasis: "Res. 2084 · art. 3 / art. 11(a)",
    requirement:
      "Producto prioritario clasificado por categoría y subcategoría conforme al decreto aplicable."
  },
  {
    id: "equivalence",
    label: "Equivalencia producto → residuo",
    legalBasis: "Res. 2084 · art. 4 / art. 11(b)",
    requirement:
      "Relación identificable y cuantificable entre producto introducido y residuo a gestionar."
  },
  {
    id: "market-transactions",
    label: "Introducción al mercado",
    legalBasis: "Res. 2084 · art. 5 / art. 11(c)",
    requirement:
      "Operaciones comerciales trazables a producto, unidades, fecha y consumidor cuando corresponda."
  },
  {
    id: "waste-operations",
    label: "Operaciones de gestión",
    legalBasis: "Res. 2084 · art. 7",
    requirement:
      "Fecha, operación, contraparte, cantidad, costo y documento tributario de respaldo."
  },
  {
    id: "monthly-reports",
    label: "Reportes mensuales",
    legalBasis: "Res. 2084 · arts. 6 y 8; Res. 2279/2024",
    requirement:
      "Consolidados dentro de los primeros diez días de cada mes respecto del penúltimo mes."
  },
  {
    id: "archive",
    label: "Archivo de respaldo",
    legalBasis: "Res. 2084 · art. 14",
    requirement:
      "Datos respaldados documentalmente y documentación conservada por seis años."
  },
  {
    id: "final-report",
    label: "Informe de cumplimiento",
    legalBasis: "Ley 20.920 · art. 22(c); Res. 2084 · arts. 9-10",
    requirement:
      "Datos consolidados del período, categorías/subcategorías y operaciones asociadas, listos para remisión."
  },
  {
    id: "external-audit",
    label: "Auditor externo",
    legalBasis: "Ley 20.920 · art. 22(c); Res. 2084 · art. 11",
    requirement:
      "Pack preparado para verificar consistencia, clasificación, equivalencias y transacciones si SMA lo requiere."
  }
] as const;

export const monthlyReportingRule = {
  cadence: "Primeros 10 días hábiles de cada mes",
  referencePeriod: "Penúltimo mes contado desde la fecha del reporte",
  rectification:
    "Rectificable o complementable hasta la remisión del informe final de cumplimiento."
};

export const currentDeclarationNotice = {
  year: 2026,
  period: "Cuarto trimestre de 2026",
  reportedYear: 2025,
  exactDates: "Pendientes de Resolución Exenta del MMA",
  note:
    "El MMA informó que las fechas específicas de inicio y término serán publicadas oportunamente."
};
