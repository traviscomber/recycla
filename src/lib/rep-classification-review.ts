import "server-only";

import { db, hasDatabase } from "@/lib/db";
import type { PriorityStream } from "@/lib/rep";
import { repRulePacks } from "@/lib/rep-rule-packs";
import { classifyRepInput } from "@/lib/rep-classification";

export type ClassificationEntityType = "MARKET_INTRODUCTION" | "WASTE_OPERATION" | "COLLECTION";

export type PendingRepClassification = {
  entityType: ClassificationEntityType;
  entityId: string;
  occurredAt: string;
  priorityProduct: string;
  stream: PriorityStream | null;
  rawCategory: string | null;
  rawSubcategory: string | null;
  packVersion: string | null;
  basis: string | null;
  quantity: number | null;
  unit: string | null;
};

export async function listPendingRepClassifications(limit = 60) {
  if (!hasDatabase()) return [] as PendingRepClassification[];
  const sql = db();
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  try {
    const rows = await sql<PendingRepClassification[]>`
      with pending as (
        select 'MARKET_INTRODUCTION'::text as "entityType", mi.id::text as "entityId",
          mi.occurred_at::text as "occurredAt", mi.priority_product as "priorityProduct",
          mi.regulatory_stream as stream, mi.category as "rawCategory",
          mi.subcategory as "rawSubcategory", mi.regulatory_pack_version as "packVersion",
          mi.classification_basis as basis, mi.quantity::float8 as quantity, mi.unit
        from market_introductions mi
        where mi.classification_status = 'REVIEW_REQUIRED'
           or mi.classification_status is null
        union all
        select 'WASTE_OPERATION'::text, wo.id::text, wo.occurred_at::text,
          wo.priority_product, wo.regulatory_stream, wo.category, wo.subcategory,
          wo.regulatory_pack_version, wo.classification_basis, wo.quantity::float8, wo.unit
        from waste_management_operations wo
        where wo.classification_status = 'REVIEW_REQUIRED'
           or wo.classification_status is null
        union all
        select 'COLLECTION'::text, c.id::text, c.collected_at::text, c.stream::text,
          c.stream, c.regulatory_category_id, null::text, c.regulatory_pack_version,
          c.classification_basis, c.declared_quantity::float8, c.declared_unit
        from collections c
        where c.classification_status = 'REVIEW_REQUIRED' or c.classification_status is null
      )
      select * from pending
      order by "occurredAt" desc
      limit ${safeLimit}
    `;

    return rows.map((row) => {
      if (row.stream) return row;
      const classification = classifyRepInput({
        priorityProduct: row.priorityProduct,
        category: row.rawCategory,
        subcategory: row.rawSubcategory
      });
      return {
        ...row,
        stream: classification.stream,
        packVersion: classification.packVersion,
        basis: row.basis ?? classification.basis
      };
    });
  } catch {
    return [];
  }
}

export async function reviewRepClassification(input: {
  entityType: ClassificationEntityType;
  entityId: string;
  stream: PriorityStream;
  categoryId: string;
  actorRef: string | null;
  note?: string | null;
}) {
  const pack = repRulePacks[input.stream];
  if (!pack.categories.some((item) => item.id === input.categoryId)) {
    throw new Error("INVALID_CATEGORY");
  }

  const sql = db();
  const note = input.note?.trim() || null;

  if (input.entityType === "MARKET_INTRODUCTION") {
    const rows = await sql<Array<{ id: string }>>`
      with updated as (
        update market_introductions
        set regulatory_stream = ${input.stream}::priority_stream,
          regulatory_category_id = ${input.categoryId},
          regulatory_pack_version = ${pack.version},
          classification_status = 'VERIFIED',
          classification_basis = 'Revisión manual contra taxonomía versionada del rule pack.'
        where id = ${input.entityId}::uuid
        returning id
      ),
      logged as (
        insert into rep_classification_events (
          entity_type, entity_id, stream, pack_version, category_id,
          status, source_method, actor_ref, note
        )
        select 'MARKET_INTRODUCTION', id, ${input.stream}::priority_stream,
          ${pack.version}, ${input.categoryId}, 'VERIFIED',
          'MANUAL_REVIEW', ${input.actorRef}, ${note}
        from updated returning entity_id
      )
      select entity_id::text as id from logged
    `;
    return Boolean(rows[0]);
  }

  if (input.entityType === "WASTE_OPERATION") {
    const rows = await sql<Array<{ id: string }>>`
      with updated as (
        update waste_management_operations
        set regulatory_stream = ${input.stream}::priority_stream,
          regulatory_category_id = ${input.categoryId},
          regulatory_pack_version = ${pack.version},
          classification_status = 'VERIFIED',
          classification_basis = 'Revisión manual contra taxonomía versionada del rule pack.'
        where id = ${input.entityId}::uuid
        returning id
      ),
      logged as (
        insert into rep_classification_events (
          entity_type, entity_id, stream, pack_version, category_id,
          status, source_method, actor_ref, note
        )
        select 'WASTE_OPERATION', id, ${input.stream}::priority_stream,
          ${pack.version}, ${input.categoryId}, 'VERIFIED',
          'MANUAL_REVIEW', ${input.actorRef}, ${note}
        from updated returning entity_id
      )
      select entity_id::text as id from logged
    `;
    return Boolean(rows[0]);
  }

  const rows = await sql<Array<{ id: string }>>`
    with updated as (
      update collections
      set regulatory_category_id = ${input.categoryId},
        regulatory_pack_version = ${pack.version},
        classification_status = 'VERIFIED',
        classification_basis = 'Revisión manual contra taxonomía versionada del rule pack.'
      where id = ${input.entityId}::uuid
        and stream = ${input.stream}::priority_stream
      returning id
    ),
    logged as (
      insert into rep_classification_events (
        entity_type, entity_id, stream, pack_version, category_id,
        status, source_method, actor_ref, note
      )
      select 'COLLECTION', id, ${input.stream}::priority_stream,
        ${pack.version}, ${input.categoryId}, 'VERIFIED',
        'MANUAL_REVIEW', ${input.actorRef}, ${note}
      from updated returning entity_id
    )
    select entity_id::text as id from logged
  `;
  return Boolean(rows[0]);
}
