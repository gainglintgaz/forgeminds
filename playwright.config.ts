/**
 * Playwright config for ForgeMinds e2e tests.
 *
 * Tests run against a locally-running dev server (http://localhost:3000).
 * Start the dev server in a separate terminal (`npm run dev`) before running.
 * For CI, the `webServer` option below auto-starts and tears down `next dev`.
 *
 * Single worker (Supabase auth state isn't safely concurrent across tests in
 * Phase 0). Failed traces are retained for debugging. No retries — tests
 * either pass deterministically or the test/code is wrong.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
