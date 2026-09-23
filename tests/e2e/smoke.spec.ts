import { expect, test } from "@playwright/test";

const routes = [
  ["/", "REP Control Tower"],
  ["/clientes", "Clientes REP"],
  ["/ledger", "REP Ledger"],
  ["/evidence", "Evidence Graph"],
  ["/audit", "Audit Room"],
  ["/reporting", "Report Readiness"],
  ["/reporting/intake", "Reporting Intake"],
  ["/state-intelligence", "State Intelligence"]
] as const;

for (const [path, heading] of routes) {
  test(`${path} renders without framework failure`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  });
}

test("health endpoint fails closed when persistence is unavailable", async ({ request }) => {
  const response = await request.get("/api/health");
  expect([200, 502, 503]).toContain(response.status());

  const body = await response.json();
  expect(typeof body.ok).toBe("boolean");
  expect(["ready", "schema_missing", "not_configured", "unavailable"]).toContain(body.state);
});

test("machine sync rejects unauthenticated mutation", async ({ request }) => {
  const response = await request.post("/api/state-intelligence/sync?source=retc-priority-products");
  expect([401, 503]).toContain(response.status());
});
