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

  test("/api/v1/items rejects requests without an API key", async ({ request }) => {
    // /api/v1/* is whitelisted in middleware so each route's validateApiKey
    // gate can run. Expected statuses:
    //   401 — missing/invalid API key (normal case)
    //   503 — PRESSFARM_API_KEY env var not set in this environment
    const res = await request.get("/api/v1/items", { maxRedirects: 0 });
    expect([401, 503]).toContain(res.status());
  });
});
