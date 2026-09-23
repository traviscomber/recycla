export type CircularityRoute =
  | "PREVENTION"
  | "PREPARATION_FOR_REUSE"
  | "RECYCLING"
  | "ENERGY_RECOVERY"
  | "DISPOSAL";

export type CircularityLevel = {
  id: CircularityRoute;
  label: string;
  priority: number;
  appliesAfterWasteGeneration: boolean;
  description: string;
};

export const circularityHierarchy: CircularityLevel[] = [
  {
    id: "PREVENTION",
    label: "Prevención",
    priority: 1,
    appliesAfterWasteGeneration: false,
    description: "Evitar que el residuo llegue a generarse."
  },
  {
    id: "PREPARATION_FOR_REUSE",
    label: "Preparación para reutilización",
    priority: 2,
    appliesAfterWasteGeneration: true,
    description: "Extender la vida útil del producto o componente antes de reciclar material."
  },
  {
    id: "RECYCLING",
    label: "Reciclaje",
    priority: 3,
    appliesAfterWasteGeneration: true,
    description: "Recuperar material para reincorporarlo a nuevos ciclos productivos."
  },
  {
    id: "ENERGY_RECOVERY",
    label: "Valorización energética",
    priority: 4,
    appliesAfterWasteGeneration: true,
    description: "Recuperar energía cuando rutas materiales de mayor prioridad no son aplicables."
  },
  {
    id: "DISPOSAL",
    label: "Disposición",
    priority: 5,
    appliesAfterWasteGeneration: true,
    description: "Destino final sin valorización."
  }
];

export type CircularityOutcome = {
  route: Exclude<CircularityRoute, "PREVENTION">;
  quantityKg: number;
};

export const demoCircularityOutcomes: CircularityOutcome[] = [
  { route: "PREPARATION_FOR_REUSE", quantityKg: 14800 },
  { route: "RECYCLING", quantityKg: 84250 },
  { route: "ENERGY_RECOVERY", quantityKg: 4620 },
  { route: "DISPOSAL", quantityKg: 6200 }
];

export function routeLabel(route: CircularityRoute) {
  return circularityHierarchy.find((item) => item.id === route)?.label ?? route;
}
