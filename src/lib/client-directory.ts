import "server-only";

import { db, hasDatabase } from "@/lib/db";

export type ClientDirectoryEntry = {
  slug: string;
  displayName: string;
  rut: string | null;
  relationshipStatus: "PUBLISHED_CLIENT" | "CANONICAL_CLIENT";
  sourceKind: "OFFICIAL_WEBSITE" | "CANONICAL_DATABASE";
  sourceUrl: string;
  sourceObservedAt: string;
  website: string | null;
  hasCanonicalOrganization: boolean;
};

export async function listClientDirectory(limit = 200): Promise<ClientDirectoryEntry[]> {
  if (!hasDatabase()) return [];

  try {
    const sql = db();
    const [table] = await sql<Array<{ exists: string | null }>>`
      select to_regclass('public.client_directory')::text as exists
    `;
    if (!table?.exists) return [];

    const safeLimit = Math.min(Math.max(limit, 1), 500);

    return await sql<ClientDirectoryEntry[]>`
      select
        slug,
        display_name as "displayName",
        rut,
        relationship_status as "relationshipStatus",
        source_kind as "sourceKind",
        source_url as "sourceUrl",
        source_observed_at::text as "sourceObservedAt",
        nullif(metadata->>'website', '') as website,
        (canonical_organization_id is not null) as "hasCanonicalOrganization"
      from client_directory
      order by display_name
      limit ${safeLimit}
    `;
  } catch {
    return [];
  }
}
