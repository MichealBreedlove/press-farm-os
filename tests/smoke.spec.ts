import { test, expect } from "@playwright/test";

test.describe("Press Farm OS — smoke", () => {
  test("root redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/login renders the username + password form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in|continue/i })).toBeVisible();
  });

  test("/about renders the public partner-restaurants page", async ({ page }) => {
    const response = await page.goto("/about");
    expect(response?.status()).toBe(200);
    await expect(page.getByText(/press farm/i).first()).toBeVisible();
  });

  test("/api/v1/items is gated when unauthenticated", async ({ request }) => {
    // Currently the auth middleware redirects /api/v1/* → /login (the public
    // paths list in src/lib/supabase/middleware.ts only includes /login,
    // /about, /auth/callback, /auth/confirm). If /api/v1/* is later added to
    // that whitelist so the API-key check can run, this status will become
    // 401/403 instead — update the assertion then.
    const res = await request.get("/api/v1/items", { maxRedirects: 0 });
    expect([307, 401, 403]).toContain(res.status());
  });
});
