import "server-only";

import { db, hasDatabase } from "@/lib/db";
import type { PriorityStream } from "@/lib/rep";
import { getRepRulePack } from "@/lib/rep-rule-packs";

export type EvidenceChainStatus =
  | "ACCREDITABLE"
  | "REGULATORY_BLOCKED"
  | "EVIDENCE_READY"
  | "VALUED"
  | "IN_PROCESS"
  | "COLLECTED";

export type EvidenceRequirementState = {
  id: string;
  label: string;
  blocking: boolean;
  satisfied: boolean;
  detail: string;
};

export type EvidenceChain = {
  collectionId: string;
  externalRef: string | null;
  collectedAt: string;
  client: string;
  stream: PriorityStream;
  declaredQuantity: number | null;
  declaredUnit: "kg" | "l" | null;
  netKg: number | null;
  lotCount: number;
  lotCodes: string[];
  allocatedKg: number;
  valuationRoutes: string[];
  destinations: string[];
  evidenceCount: number;
  checksummedEvidence: number;
  latestLedgerState: string | null;
  latestLedgerQuantity: number | null;
  ledgerRuleCode: string | null;
  ledgerRuleVersion: number | null;
  ledgerRuleJson: Record<string, unknown> | null;
  regulatoryPackVersion: string;
  regulatoryMode: "APPLY" | "MONITOR_ONLY";
  regulatoryCategoryId: string | null;
  regulatoryCategoryLabel: string | null;
  evidenceRequirements: EvidenceRequirementState[];
  regulatoryReady: boolean;
  status: EvidenceChainStatus;
  completedStages: number;
  totalStages: 8;
  coveragePercent: number;
  blockers: string[];
};

type EvidenceChainRow = {
  collectionId: string;
  externalRef: string | null;
  collectedAt: string;
  client: string;
  stream: PriorityStream;
  declaredQuantity: number | null;
  declaredUnit: "kg" | "l" | null;
  netKg: number | null;
  lotCount: number;
  lotCodes: string[] | null;
  allocatedKg: number;
  valuationRoutes: string[] | null;
  destinations: string[] | null;
  evidenceCount: number;
  checksummedEvidence: number;
  latestLedgerState: string | null;
  latestLedgerQuantity: number | null;
  ledgerRuleCode: string | null;
  ledgerRuleVersion: number | null;
  ledgerRuleJson: Record<string, unknown> | null;
};

function resolveRegulatoryContext(row: EvidenceChainRow) {
  const pack = getRepRulePack(row.stream);
  const hintedCategory =
    typeof row.ledgerRuleJson?.categoryId === "string"
      ? row.ledgerRuleJson.categoryId
      : typeof row.ledgerRuleJson?.category === "string"
        ? row.ledgerRuleJson.category
        : null;
  const autoCategory = pack.categories.length === 1 ? pack.categories[0]?.id ?? null : null;
  const categoryId = hintedCategory ?? autoCategory;
  const category = categoryId
    ? pack.categories.find((item) => item.id === categoryId) ?? null
    : null;

  const evidenceRequirements: EvidenceRequirementState[] = pack.evidenceRequirements.map((requirement) => {
    let satisfied = false;
    let detail = "Sin prueba suficiente en la cadena actual.";

    if (requirement.id.includes("category") || requirement.id.includes("origin")) {
      satisfied = Boolean(category);
      detail = satisfied ? `Categoría ${category?.label ?? categoryId} resuelta.` : "Categoría regulatoria no resuelta.";
    } else if (requirement.id.includes("weight") || requirement.id.includes("volume")) {
      satisfied = row.netKg !== null || row.declaredQuantity !== null;
      detail = satisfied ? "Cantidad/pesaje disponible." : "Falta cantidad o pesaje verificable.";
    } else if (
      requirement.id.includes("destination") ||
      requirement.id.includes("chain")
    ) {
      satisfied = (row.destinations?.length ?? 0) > 0 && row.evidenceCount > 0;
      detail = satisfied ? "Destino y evidencia asociados." : "Falta destino y/o evidencia asociada.";
    } else if (
      requirement.id.includes("route") ||
      requirement.id.includes("treatment")
    ) {
      satisfied = (row.valuationRoutes?.length ?? 0) > 0;
      detail = satisfied ? "Ruta de valorización informada." : "Falta ruta de valorización.";
    } else if (
      requirement.id.includes("tim") ||
      requirement.id.includes("second-life") ||
      requirement.id.includes("separation") ||
      requirement.id.includes("chemistry") ||
      requirement.id.includes("conversion")
    ) {
      satisfied = false;
      detail = "Requiere dato regulatorio específico aún no demostrado por esta cadena.";
    } else {
      satisfied = row.evidenceCount > 0 && row.checksummedEvidence === row.evidenceCount;
      detail = satisfied ? "Evidencia documental íntegra." : "Evidencia documental incompleta.";
    }

    return { ...requirement, satisfied, detail };
  });

  const regulatoryBlockers: string[] = [];
  if (pack.enginePolicy !== "APPLY") {
    regulatoryBlockers.push(`Pack ${pack.version} en MONITOR_ONLY`);
  }
  if (pack.enginePolicy === "APPLY" && !category) {
    regulatoryBlockers.push("Categoría regulatoria no resuelta");
  }
  for (const requirement of evidenceRequirements) {
    if (requirement.blocking && !requirement.satisfied) {
      regulatoryBlockers.push(requirement.label);
    }
  }

  return {
    pack,
    categoryId,
    category,
    evidenceRequirements,
    regulatoryReady: regulatoryBlockers.length === 0,
    regulatoryBlockers
  };
}

function deriveStatus(row: EvidenceChainRow, regulatoryReady: boolean): EvidenceChainStatus {
  if (row.latestLedgerState === "ACCREDITABLE" && regulatoryReady) return "ACCREDITABLE";
  if (row.latestLedgerState === "ACCREDITABLE" && !regulatoryReady) return "REGULATORY_BLOCKED";
  if (
    row.evidenceCount > 0 &&
    row.checksummedEvidence === row.evidenceCount &&
    row.allocatedKg > 0
  ) {
    return "EVIDENCE_READY";
  }
  if (row.allocatedKg > 0) return "VALUED";
  if (row.lotCount > 0 || row.netKg !== null) return "IN_PROCESS";
  return "COLLECTED";
}

function deriveCoverage(row: EvidenceChainRow, regulatoryReady: boolean, categoryResolved: boolean) {
  const checks = [
    true,
    row.netKg !== null,
    row.lotCount > 0,
    row.allocatedKg > 0,
    row.evidenceCount > 0 && row.checksummedEvidence === row.evidenceCount,
    row.latestLedgerState === "ACCREDITABLE",
    categoryResolved,
    regulatoryReady
  ];
  const completedStages = checks.filter(Boolean).length;

  const blockers: string[] = [];
  if (row.netKg === null) blockers.push("Falta pesaje");
  if (row.lotCount === 0) blockers.push("Sin lote trazable");
  if (row.allocatedKg <= 0) blockers.push("Sin valorización asignada");
  if (row.evidenceCount === 0) {
    blockers.push("Sin evidencia documental");
  } else if (row.checksummedEvidence < row.evidenceCount) {
    blockers.push("Evidencia sin checksum completo");
  }
  if (row.latestLedgerState !== "ACCREDITABLE") {
    blockers.push("Ledger aún no acreditable");
  }

  return {
    completedStages,
    coveragePercent: Math.round((completedStages / 8) * 100),
    blockers
  };
}

export async function listEvidenceChains(limit = 100): Promise<EvidenceChain[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const safeLimit = Math.min(Math.max(limit, 1), 200);

    const rows = await sql<EvidenceChainRow[]>`
      select
        c.id::text as "collectionId",
        c.external_ref as "externalRef",
        c.collected_at::text as "collectedAt",
        o.display_name as client,
        c.stream,
        c.declared_quantity::float8 as "declaredQuantity",
        c.declared_unit as "declaredUnit",
        (select sum(w.net_kg)::float8 from weighings w where w.collection_id = c.id) as "netKg",
        (select count(distinct li.lot_id)::int from lot_inputs li where li.collection_id = c.id) as "lotCount",
        coalesce((
          select array_agg(distinct l.lot_code order by l.lot_code)
          from lot_inputs li
          join lots l on l.id = li.lot_id
          where li.collection_id = c.id
        ), array[]::text[]) as "lotCodes",
        coalesce((
          select sum(va.quantity_kg)::float8
          from valuation_allocations va
          where va.collection_id = c.id and va.organization_id = c.organization_id
        ), 0)::float8 as "allocatedKg",
        coalesce((
          select array_agg(distinct vo.circularity_route::text order by vo.circularity_route::text)
          from valuation_allocations va
          join valuation_outputs vo on vo.id = va.valuation_output_id
          where va.collection_id = c.id and va.organization_id = c.organization_id
        ), array[]::text[]) as "valuationRoutes",
        coalesce((
          select array_agg(distinct vo.destination_name order by vo.destination_name)
          from valuation_allocations va
          join valuation_outputs vo on vo.id = va.valuation_output_id
          where va.collection_id = c.id
            and va.organization_id = c.organization_id
            and vo.destination_name is not null
            and length(trim(vo.destination_name)) > 0
        ), array[]::text[]) as destinations,
        (
          select count(distinct evidence.document_id)::int
          from (
            select el.document_id
            from evidence_links el
            where el.entity_type = 'collection' and el.entity_id = c.id
            union
            select w.evidence_document_id as document_id
            from weighings w
            where w.collection_id = c.id and w.evidence_document_id is not null
            union
            select va.evidence_document_id as document_id
            from valuation_allocations va
            where va.collection_id = c.id
              and va.organization_id = c.organization_id
              and va.evidence_document_id is not null
          ) evidence
        ) as "evidenceCount",
        (
          select count(distinct d.id)::int
          from (
            select el.document_id
            from evidence_links el
            where el.entity_type = 'collection' and el.entity_id = c.id
            union
            select w.evidence_document_id as document_id
            from weighings w
            where w.collection_id = c.id and w.evidence_document_id is not null
            union
            select va.evidence_document_id as document_id
            from valuation_allocations va
            where va.collection_id = c.id
              and va.organization_id = c.organization_id
              and va.evidence_document_id is not null
          ) evidence
          join documents d on d.id = evidence.document_id
          where d.checksum_sha256 is not null and length(trim(d.checksum_sha256)) > 0
        ) as "checksummedEvidence",
        (
          select le.state::text
          from rep_ledger_entries le
          where le.organization_id = c.organization_id
            and le.source_entity_type = 'collection'
            and le.source_entity_id = c.id
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
          order by le.created_at desc
          limit 1
        ) as "latestLedgerState",
        (
          select le.quantity::float8
          from rep_ledger_entries le
          where le.organization_id = c.organization_id
            and le.source_entity_type = 'collection'
            and le.source_entity_id = c.id
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
          order by le.created_at desc
          limit 1
        ) as "latestLedgerQuantity",
        (
          select rr.code
          from rep_ledger_entries le
          left join rep_rules rr on rr.id = le.rule_id
          where le.organization_id = c.organization_id
            and le.source_entity_type = 'collection'
            and le.source_entity_id = c.id
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
          order by le.created_at desc
          limit 1
        ) as "ledgerRuleCode",
        (
          select rr.rule_version
          from rep_ledger_entries le
          left join rep_rules rr on rr.id = le.rule_id
          where le.organization_id = c.organization_id
            and le.source_entity_type = 'collection'
            and le.source_entity_id = c.id
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
          order by le.created_at desc
          limit 1
        ) as "ledgerRuleVersion",
        (
          select rr.rule_json
          from rep_ledger_entries le
          left join rep_rules rr on rr.id = le.rule_id
          where le.organization_id = c.organization_id
            and le.source_entity_type = 'collection'
            and le.source_entity_id = c.id
            and not exists (
              select 1 from rep_ledger_entries newer
              where newer.supersedes_entry_id = le.id
            )
          order by le.created_at desc
          limit 1
        ) as "ledgerRuleJson"
      from collections c
      join organizations o on o.id = c.organization_id
      order by c.collected_at desc
      limit ${safeLimit}
    `;

    return rows.map((row) => {
      const normalized = {
        ...row,
        lotCodes: row.lotCodes ?? [],
        valuationRoutes: row.valuationRoutes ?? [],
        destinations: row.destinations ?? []
      };
      const regulatory = resolveRegulatoryContext(normalized);
      const coverage = deriveCoverage(
        normalized,
        regulatory.regulatoryReady,
        Boolean(regulatory.category)
      );
      return {
        ...normalized,
        regulatoryPackVersion: regulatory.pack.version,
        regulatoryMode: regulatory.pack.enginePolicy,
        regulatoryCategoryId: regulatory.categoryId,
        regulatoryCategoryLabel: regulatory.category?.label ?? null,
        evidenceRequirements: regulatory.evidenceRequirements,
        regulatoryReady: regulatory.regulatoryReady,
        status: deriveStatus(normalized, regulatory.regulatoryReady),
        completedStages: coverage.completedStages,
        totalStages: 8,
        coveragePercent: coverage.coveragePercent,
        blockers: [...regulatory.regulatoryBlockers, ...coverage.blockers]
      };
    });
  } catch {
    return [];
  }
}
