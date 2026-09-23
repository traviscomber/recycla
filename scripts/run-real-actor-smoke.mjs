import { mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";

const result = {
  ranAt: new Date().toISOString(),
  sync: null,
  actor: null,
  snapshot: null
};

const token = process.env.STATE_SYNC_TOKEN;
const databaseUrl = process.env.DATABASE_URL;
const baseUrl = "https://recycla-git-feat-state-intelligence-travis-projects-c14a785a.vercel.app";

if (!token || !databaseUrl || process.env.VERCEL_GIT_COMMIT_REF !== "feat/state-intelligence") {
  result.skipped = true;
  result.reason = "preview prerequisites missing";
} else {
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  try {
    const syncResponse = await fetch(
      `${baseUrl}/api/state-intelligence/sync?source=retc-priority-products`,
      { method: "POST", headers }
    );
    result.sync = {
      status: syncResponse.status,
      body: await syncResponse.text()
    };

    const sql = postgres(databaseUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 10
    });

    try {
      const [run] = await sql`
        select resource_id, resource_name, source_year, row_count
        from external_source_sync_runs
        where source_id = 'retc-priority-products'
          and status = 'SUCCESS'
        order by finished_at desc nulls last, started_at desc
        limit 1
      `;

      if (run?.resource_id) {
        const [actor] = await sql`
          select canonical_name, external_identifier, resource_id
          from external_source_records
          where source_id = 'retc-priority-products'
            and resource_id = ${run.resource_id}
            and canonical_name is not null
            and length(trim(canonical_name)) >= 3
          order by canonical_name asc
          limit 1
        `;

        result.actor = actor
          ? {
              canonicalName: actor.canonical_name,
              externalIdentifier: actor.external_identifier,
              resourceId: actor.resource_id,
              sourceYear: run.source_year,
              rowCount: run.row_count
            }
          : {
              canonicalName: null,
              resourceId: run.resource_id,
              sourceYear: run.source_year,
              rowCount: run.row_count
            };

        if (actor?.canonical_name) {
          const snapshotResponse = await fetch(
            `${baseUrl}/api/state-intelligence/snapshot`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                kind: "producer",
                query: actor.canonical_name,
                matchIndex: 0,
                subjectType: "rep_actor_producer",
                status: "REVIEW_REQUIRED"
              })
            }
          );

          result.snapshot = {
            status: snapshotResponse.status,
            body: await snapshotResponse.text()
          };
        }
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : "unknown error";
  }
}

await mkdir("public", { recursive: true });
await writeFile("public/state-actor-smoke.json", JSON.stringify(result, null, 2));
console.log("[state-actor-smoke]", JSON.stringify(result));
