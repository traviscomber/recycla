const token = process.env.STATE_SYNC_TOKEN;

if (!token || process.env.VERCEL_GIT_COMMIT_REF !== "feat/state-intelligence") {
  console.log("[state-smoke] prerequisites missing; skipping.");
  process.exit(0);
}

const headers = {
  authorization: `Bearer ${token}`,
  "content-type": "application/json"
};

const syncResponse = await fetch(
  "https://recycla-cmaekw1fm-travis-projects-c14a785a.vercel.app/api/state-intelligence/sync?source=retc-priority-products",
  { method: "POST", headers }
);

const syncBody = await syncResponse.text();
if (!syncResponse.ok) {
  throw new Error(`State sync failed: HTTP ${syncResponse.status} ${syncBody}`);
}
console.log("[state-smoke] sync:", syncBody);

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

const snapshotBody = await snapshotResponse.text();
if (!snapshotResponse.ok) {
  throw new Error(
    `State snapshot failed: HTTP ${snapshotResponse.status} ${snapshotBody}`
  );
}
console.log("[state-smoke] snapshot:", snapshotBody);
