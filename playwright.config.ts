import { defineConfig, devices } from "@playwright/test";

/**
 * Press Farm OS smoke-test config.
 *
 * Target URL precedence:
 *   1. SMOKE_BASE_URL env var  (e.g. SMOKE_BASE_URL=https://pressfarm.app)
 *   2. http://localhost:3000   (auto-starts `npm run dev`)
 *
 * One-time setup on a fresh checkout:
 *   npx playwright install chromium
 *
 * Run:
 *   npm run test:smoke                            # against localhost
 *   SMOKE_BASE_URL=https://pressfarm.app \
 *     npm run test:smoke                          # against prod
 */
const baseURL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const isRemote = baseURL !== "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: isRemote
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
