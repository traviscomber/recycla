import type { PriorityStream } from "@/lib/rep";

export type ClientObligation = {
  stream: PriorityStream;
  label: string;
  unit: "kg" | "l";
  obligation: number;
  collected: number;
  valued: number;
  eligible: number;
  evidenceComplete: number;
  accreditable: number;
};

export type RepClient = {
  slug: string;
  name: string;
  rut: string;
  period: string;
  obligations: ClientObligation[];
};

export const repClients: RepClient[] = [
  {
    slug: "cliente-piloto-recycla",
    name: "Cliente piloto Recycla",
    rut: "76.000.000-0",
    period: "2027",
    obligations: [
      {
        stream: "AEE_RAEE",
        label: "AEE / RAEE",
        unit: "kg",
        obligation: 128000,
        collected: 117420,
        valued: 109870,
        eligible: 105130,
        evidenceComplete: 98440,
        accreditable: 98440
      },
      {
        stream: "BATERIAS",
        label: "Baterías",
        unit: "kg",
        obligation: 42000,
        collected: 39800,
        valued: 37150,
        eligible: 36500,
        evidenceComplete: 35200,
        accreditable: 35200
      }
    ]
  },
  {
    slug: "industria-norte",
    name: "Industria Norte",
    rut: "77.100.000-1",
    period: "2027",
    obligations: [
      {
        stream: "NEUMATICOS",
        label: "Neumáticos",
        unit: "kg",
        obligation: 84200,
        collected: 82100,
        valued: 80750,
        eligible: 80120,
        evidenceComplete: 79990,
        accreditable: 79990
      },
      {
        stream: "PILAS",
        label: "Pilas",
        unit: "kg",
        obligation: 4200,
        collected: 4380,
        valued: 4220,
        eligible: 4180,
        evidenceComplete: 4100,
        accreditable: 4100
      }
    ]
  },
  {
    slug: "operador-industrial-sur",
    name: "Operador Industrial Sur",
    rut: "78.200.000-2",
    period: "2027",
    obligations: [
      {
        stream: "ACEITES_LUBRICANTES",
        label: "Aceites lubricantes",
        unit: "l",
        obligation: 61200,
        collected: 64500,
        valued: 62300,
        eligible: 61650,
        evidenceComplete: 61200,
        accreditable: 61200
      }
    ]
  }
];

export function getRepClient(slug: string) {
  return repClients.find((client) => client.slug === slug);
}

export function readiness(obligation: ClientObligation) {
  if (obligation.obligation <= 0) return 0;
  return Math.min(100, (obligation.accreditable / obligation.obligation) * 100);
}

export function gap(obligation: ClientObligation) {
  return obligation.accreditable - obligation.obligation;
}

export function clientStatus(client: RepClient) {
  const states = client.obligations.map((item) => readiness(item));
  if (states.every((value) => value >= 100)) return "Listo";
  if (states.every((value) => value >= 95)) return "Casi listo";
  return "Atención";
}
