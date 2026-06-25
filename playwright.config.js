// @ts-check
import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
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
