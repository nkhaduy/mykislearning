// @ts-check
import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // These E2E specs target the shared production Worker and reuse the same
  // production test accounts. Running them in parallel can leave a Playwright
  // worker stuck during browser teardown after all assertions pass.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "https://mykis-learning.nkhaduy.workers.dev",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    channel: "chrome",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
});
