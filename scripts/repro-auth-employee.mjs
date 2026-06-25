import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "https://mykis-learning.nkhaduy.workers.dev";
const EMP_EMAIL = "employee.test@kisvn.vn";
const EMP_PASSWORD = "Test@123456";

function log(label, data) {
  const safe = typeof data === "string" ? data : JSON.stringify(data);
  console.log(`[${label}] ${safe}`);
}

const results = [];
async function runCase(label, fn) {
  console.log(`\n========== ${label} ==========`);
  const browser = await chromium.launch();
  try {
    await fn(browser);
    console.log(`[${label}] PASS`);
    results.push({ label, pass: true });
  } catch (err) {
    console.log(`[${label}] FAIL: ${err.message}`);
    results.push({ label, pass: false, err: err.message });
  } finally {
    await browser.close();
  }
}

async function capture(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedReqs = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/api/activity/heartbeat")) {
      failedReqs.push(`HTTP ${r.status()} ${r.url().replace(BASE, "")}`);
    }
  });
  page.on("requestfailed", (r) => failedReqs.push(`FAIL ${r.method()} ${r.url().replace(BASE, "")} ${r.failure()?.errorText || ""}`));
  return { consoleErrors, pageErrors, failedReqs };
}

async function dumpDiag(page, label) {
  const diag = await page.evaluate(() => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mykis.")) {
        const v = localStorage.getItem(k);
        ls[k] = k.includes("session") ? "(redacted present=" + !!v + ")" : (v && v.length > 150 ? v.slice(0, 150) + "..." : v);
      }
    }
    return { url: location.href, pathname: location.pathname, search: location.search, ls };
  });
  log(label + " DIAG", diag);
}

await runCase("Case A — employee login -> /dashboard", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");

  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  await page.screenshot({ path: "test-results/auth-employee/case-a-dashboard.png", fullPage: true });

  const errorFallback = await page.locator("text=Không thể tải trang").count();
  log("Case A errorFallback", errorFallback);

  const mainHeight = await page.evaluate(() => {
    const el = document.querySelector(".app-main .content") || document.querySelector(".app-main");
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
  log("Case A mainHeight", mainHeight);

  await dumpDiag(page, "Case A");
  log("Case A CONSOLE_ERRORS", cap.consoleErrors);
  log("Case A PAGE_ERRORS", cap.pageErrors);
  log("Case A FAILED_REQS", cap.failedReqs);

  if (errorFallback > 0) throw new Error("Dashboard shows error fallback");
  if (mainHeight < 50) throw new Error("Dashboard blank (mainHeight=" + mainHeight + ")");
  if (cap.pageErrors.length) throw new Error("page errors: " + cap.pageErrors.join(" | "));
  await ctx.close();
});

await runCase("Case B — refresh /dashboard keeps session", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout, .app-main", { timeout: 10000 });
  await page.waitForTimeout(800);
  const url = page.url();
  log("Case B url after reload", url);
  const sessionPresent = await page.evaluate(() => !!localStorage.getItem("mykis.session.v1"));
  log("Case B sessionPresent after reload", sessionPresent);
  await page.screenshot({ path: "test-results/auth-employee/case-b-refresh.png", fullPage: true });
  await dumpDiag(page, "Case B");
  log("Case B PAGE_ERRORS", cap.pageErrors);
  log("Case B FAILED_REQS", cap.failedReqs);
  if (!url.includes("/dashboard")) throw new Error("Lost session on refresh: " + url);
  await ctx.close();
});

await runCase("Case C — logout clears session", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  await page.click("[data-logout]");
  await page.waitForURL("**/login**", { timeout: 10000 });

  // Try to go back to dashboard — should be blocked
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const url = page.url();
  log("Case C url after /dashboard visit post-logout", url);
  const sessionPresent = await page.evaluate(() => !!localStorage.getItem("mykis.session.v1"));
  log("Case C sessionPresent after logout", sessionPresent);
  await page.screenshot({ path: "test-results/auth-employee/case-c-logout.png", fullPage: true });
  if (sessionPresent) throw new Error("Session not cleared on logout");
  await ctx.close();
});

await runCase("Case D — wrong password", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", "WrongPassword!9");
  const btn = page.locator("#loginSubmitBtn");
  await btn.click();
  await page.waitForTimeout(1500);
  const url = page.url();
  const btnDisabled = await btn.isDisabled();
  log("Case D url", url);
  log("Case D btnDisabled", btnDisabled);
  const sessionPresent = await page.evaluate(() => !!localStorage.getItem("mykis.session.v1"));
  log("Case D sessionPresent", sessionPresent);
  if (sessionPresent) throw new Error("Session created with wrong password");
  if (btnDisabled) throw new Error("Button stuck in loading state");
  if (!url.includes("/login")) throw new Error("Redirected with wrong password: " + url);
  await ctx.close();
});

await runCase("Case E — missing profile does not white-screen", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForLoadState("domcontentloaded");

  // Corrupt localStorage: remove the employee account record so getAccountById fails
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("mykis.accounts.v1") || "[]");
    const filtered = raw.filter((a) => a.id !== "emp-test-001");
    localStorage.setItem("mykis.accounts.v1", JSON.stringify(filtered));
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const url = page.url();
  const bodyText = (await page.evaluate(() => document.body.innerText || "")).slice(0, 200);
  log("Case E url", url);
  log("Case E bodyText", bodyText);
  await page.screenshot({ path: "test-results/auth-employee/case-e-missing-profile.png", fullPage: true });
  log("Case E PAGE_ERRORS", cap.pageErrors);
  // Must not be a blank screen and must not throw an uncaught exception
  if (cap.pageErrors.length) throw new Error("uncaught page errors: " + cap.pageErrors.join(" | "));
  if (bodyText.trim().length < 10) throw new Error("blank screen with missing profile");
  await ctx.close();
});

await runCase("Case F — dashboard survives a failed course API", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);
  // Block /api/courses so the dashboard's course fetch fails
  await page.route("**/api/courses**", (route) => route.fulfill({ status: 500, body: '{"error":"SIMULATED_FAIL"}' }));
  await page.goto(`${BASE}/login`, { waitUntil: "domidle" }).catch(() => {});
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForSelector(".app-layout, .app-main", { timeout: 10000 });
  await page.waitForTimeout(800);
  const errorFallback = await page.locator("text=Không thể tải trang").count();
  const mainHeight = await page.evaluate(() => {
    const el = document.querySelector(".app-main .content") || document.querySelector(".app-main");
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
  log("Case F errorFallback", errorFallback);
  log("Case F mainHeight", mainHeight);
  log("Case F PAGE_ERRORS", cap.pageErrors);
  await page.screenshot({ path: "test-results/auth-employee/case-f-api-failure.png", fullPage: true });
  if (errorFallback > 0) throw new Error("dashboard crashed when course API failed");
  if (mainHeight < 50) throw new Error("dashboard blank when course API failed");
  if (cap.pageErrors.length) throw new Error("uncaught page errors: " + cap.pageErrors.join(" | "));
  await ctx.close();
});

await runCase("Case G — HR admin route renders (no regression)", async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const cap = await capture(page);
  // Seed a synthetic HR session (acc-hr-demo exists in seed accounts; legacy
  // header auth lets admin API calls succeed without a real JWT).
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const sess = {
      sessionId: "g-test-" + Date.now(),
      accountId: "acc-hr-demo",
      role: "hr",
      fullName: "Nguyễn Thị Cẩm Thanh",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      rememberMe: false,
      supabaseAccessToken: "synthetic-hr-session",
    };
    localStorage.setItem("mykis.session.v1", JSON.stringify(sess));
  });
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".app-layout, .app-main", { timeout: 10000 });
  await page.waitForTimeout(1200);
  const url = page.url();
  const errorFallback = await page.locator("text=Không thể tải trang").count();
  const mainHeight = await page.evaluate(() => {
    const el = document.querySelector(".app-main .content") || document.querySelector(".app-main");
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
  log("Case G url", url);
  log("Case G errorFallback", errorFallback);
  log("Case G mainHeight", mainHeight);
  log("Case G PAGE_ERRORS", cap.pageErrors);
  await page.screenshot({ path: "test-results/auth-employee/case-g-hr-admin.png", fullPage: true });
  if (!url.includes("/admin")) throw new Error("HR bounced off /admin: " + url);
  if (errorFallback > 0) throw new Error("HR admin dashboard crashed");
  if (mainHeight < 50) throw new Error("HR admin dashboard blank");
  await ctx.close();
});

console.log("\nALL CASES DONE");
console.log("\n========== SUMMARY ==========");
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label}${r.err ? " — " + r.err : ""}`);
if (results.some(r => !r.pass)) process.exitCode = 1;
