import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.STATE_SYNC_TOKEN;
const result = {
  ranAt: new Date().toISOString(),
  branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  sync: null,
  snapshot: null
};

if (!token || process.env.VERCEL_GIT_COMMIT_REF !== "feat/state-intelligence") {
  result.skipped = true;
  result.reason = "prerequisites missing";
} else {
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  try {
    const syncResponse = await fetch(
      "https://recycla-cmaekw1fm-travis-projects-c14a785a.vercel.app/api/state-intelligence/sync?source=retc-priority-products",
      { method: "POST", headers }
    );
    result.sync = {
      status: syncResponse.status,
      body: await syncResponse.text()
    };
  } catch (error) {
    result.sync = {
      status: 0,
      body: error instanceof Error ? error.message : "unknown error"
    };
  }

  try {
    const snapshotResponse = await fetch(
      "https://recycla-e50pnf5q2-travis-projects-c14a785a.vercel.app/api/state-intelligence/snapshot",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          kind: "producer",
          query: "Aparatos",
          matchIndex: 0,
          subjectType: "state_intelligence_smoke",
          status: "REVIEW_REQUIRED"
        })
      }
    );
    result.snapshot = {
      status: snapshotResponse.status,
      body: await snapshotResponse.text()
    };
  } catch (error) {
    result.snapshot = {
      status: 0,
      body: error instanceof Error ? error.message : "unknown error"
    };
  }
}

await mkdir("public", { recursive: true });
await writeFile("public/state-smoke.json", JSON.stringify(result, null, 2));
console.log("[state-smoke]", JSON.stringify(result));
