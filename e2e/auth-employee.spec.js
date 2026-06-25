// @ts-check
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const EMP_EMAIL = "employee.test@kisvn.vn";
const EMP_PASSWORD = "Test@123456";

/**
 * Reproduction harness for the two reported employee-login bugs:
 *  1. Login succeeds but /dashboard is blank or shows an error.
 *  2. Correct credentials but stays on /login (no redirect).
 *
 * Captures console messages, page errors and failed requests without
 * ever printing access tokens.
 */

function makeConsoleCollector() {
  const errors = [];
  const failedRequests = [];
  return { errors, failedRequests };
}

test("Case A — employee login -> /dashboard renders", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedReqs = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) => failedReqs.push(`${r.method()} ${r.url()} ${r.failure()?.errorText || ""}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/api/activity/heartbeat")) failedReqs.push(`HTTP ${r.status()} ${r.url()}`); });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });

  // Fill + submit
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");

  // Should land on /dashboard
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  // Dashboard shell should render actual content, not the error fallback
  await page.waitForSelector(".app-layout, .app-main", { timeout: 10000 });
  // Ensure NOT the error fallback card
  const errorFallback = await page.locator("text=Không thể tải trang").count();
  expect(errorFallback, "dashboard should not show the error fallback").toBe(0);

  // App-main should have meaningful height (not blank)
  const mainHeight = await page.evaluate(() => {
    const el = document.querySelector(".app-main .content") || document.querySelector(".app-main");
    return el ? el.getBoundingClientRect().height : 0;
  });
  expect(mainHeight, "dashboard content must have visible height").toBeGreaterThan(50);

  await page.screenshot({ path: "test-results/auth-employee/case-a-dashboard.png", fullPage: true });

  // Dump diagnostics (no tokens)
  const diag = await page.evaluate(() => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mykis.")) {
        const v = localStorage.getItem(k);
        ls[k] = k.includes("session") ? "(redacted, present=" + !!v + ")" : (v && v.length > 200 ? v.slice(0, 200) + "..." : v);
      }
    }
    return { url: location.href, route: location.pathname, localStorageKeys: ls };
  });
  console.log("DIAG", JSON.stringify(diag));
  console.log("CONSOLE_ERRORS", JSON.stringify(consoleErrors));
  console.log("PAGE_ERRORS", JSON.stringify(pageErrors));
  console.log("FAILED_REQS", JSON.stringify(failedReqs));

  expect(pageErrors, JSON.stringify(pageErrors)).toHaveLength(0);
  await ctx.close();
});
