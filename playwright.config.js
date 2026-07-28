// @ts-check
import { defineConfig, devices } from "playwright/test";

const suite = process.env.PLAYWRIGHT_SUITE || "public-readonly";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const localTarget = new URL(baseURL).hostname === "127.0.0.1" || new URL(baseURL).hostname === "localhost";
const suiteMatch = {
  "public-readonly": /public-readonly\.spec\.js/,
  "authenticated-readonly": /(?:authenticated-route-split|secondary-route-parity)\.spec\.js/,
}[suite] || /.*\.spec\.js/;

export default defineConfig({
  testDir: "./e2e",
  testMatch: suiteMatch,
  globalSetup: "./e2e/global-setup.mjs",
  webServer: localTarget ? {
    command: "npm run start:spa",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
  } : undefined,
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    channel: "chrome",
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
});
