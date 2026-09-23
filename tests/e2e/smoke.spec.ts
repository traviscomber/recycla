import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/",
  "/clientes",
  "/ledger",
  "/evidence",
  "/audit",
  "/reporting",
  "/reporting/intake",
  "/state-intelligence"
] as const;

for (const path of protectedRoutes) {
  test(`${path} redirects anonymous users to sign-in`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  });
}

test("auth entry remains public", async ({ page }) => {
  const response = await page.goto("/auth/sign-in");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.getByRole("heading", { name: "Ingresar" })).toBeVisible();
});

test("machine sync rejects unauthenticated mutation", async ({ request }) => {
  const response = await request.post("/api/state-intelligence/sync?source=retc-priority-products");
  expect([401, 503]).toContain(response.status());
});
