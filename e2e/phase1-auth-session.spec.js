// @ts-check
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const EMP_EMAIL = "employee.test@kisvn.vn";
const EMP_PASSWORD = "Test@123456";

// ─────────────────────────────────────────────────────────────
// Test 1: Employee login -> /dashboard renders without error
// ─────────────────────────────────────────────────────────────
test("T1 - Employee login -> redirect /dashboard, no crash", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");

  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForSelector(".app-layout", { timeout: 8000 });

  const errorCard = await page.locator("text=Không thể tải trang").count();
  expect(errorCard, "should not show error fallback").toBe(0);

  const mainH = await page.evaluate(() => {
    const el = document.querySelector(".app-main");
    return el ? el.getBoundingClientRect().height : 0;
  });
  expect(mainH).toBeGreaterThan(50);

  // Save screenshot
  await page.screenshot({ path: "test-results/auth-session-dashboard/t1-dashboard.png", fullPage: true });

  expect(pageErrors).toHaveLength(0);
  await ctx.close();
});

// ─────────────────────────────────────────────────────────────
// Test 2: Refresh /dashboard does NOT lose session
// ─────────────────────────────────────────────────────────────
test("T2 - Refresh /dashboard keeps session", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  // Hard refresh
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1000));

  const finalUrl = page.url();
  expect(finalUrl, "should still be on /dashboard after reload").toContain("/dashboard");

  await page.waitForSelector(".app-layout", { timeout: 8000 });

  await page.screenshot({ path: "test-results/auth-session-dashboard/t2-refresh.png", fullPage: true });
  await ctx.close();
});

// ─────────────────────────────────────────────────────────────
// Test 3: Logout clears session
// ─────────────────────────────────────────────────────────────
test("T3 - Logout clears session, blocks /dashboard", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForSelector(".app-layout", { timeout: 8000 });

  // Click logout
  const logoutBtn = page.locator("[data-logout]").first();
  await logoutBtn.click();
  await new Promise((r) => setTimeout(r, 1000));

  // Should go back to /login or /
  const url = page.url();
  expect(url).not.toContain("/dashboard");

  // Navigating to /dashboard while logged out: SPA either redirects to /login
  // or renders the login form at that URL (both are correct SPA behaviour).
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1000));
  // Either the URL changed to /login OR the login form is visible at /dashboard
  const afterUrl = page.url();
  const loginFormVisible = await page.locator("#loginEmail, #loginPassword, [data-login-form]").count();
  const isOnLogin = afterUrl.includes("/login") || loginFormVisible > 0;
  expect(isOnLogin, "unauthenticated access to /dashboard should show login form or redirect to /login").toBe(true);

  await page.screenshot({ path: "test-results/auth-session-dashboard/t3-logout.png", fullPage: true });
  await ctx.close();
});

// ─────────────────────────────────────────────────────────────
// Test 4: Wrong password shows error, no session created
// ─────────────────────────────────────────────────────────────
test("T4 - Wrong password shows error, no redirect", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", "WrongPass999!");
  await page.click("#loginSubmitBtn");

  // Should NOT navigate away from /login
  await new Promise((r) => setTimeout(r, 2000));
  expect(page.url()).toContain("/login");

  // Some error message should appear (dialog or inline)
  const errorVisible = await page.evaluate(() => {
    const sel = [
      "[data-dialog-description]",
      ".dialog__body",
      ".toast-error",
      ".form-error",
      "[role=dialog]",
    ];
    return sel.some((s) => document.querySelector(s));
  });
  expect(errorVisible, "error UI should appear for wrong password").toBe(true);

  await page.screenshot({ path: "test-results/auth-session-dashboard/t4-wrong-pass.png" });
  await ctx.close();
});

// ─────────────────────────────────────────────────────────────
// Test 5: Employee cannot access /admin
// ─────────────────────────────────────────────────────────────
test("T5 - Employee cannot access /admin", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL("**/dashboard**", { timeout: 15000 });

  // Try to navigate to /admin
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1000));

  // Should see restricted page, not admin dashboard content
  const adminContent = await page.locator("text=Tổng quan quản trị").count();
  const restricted = await page.locator("text=Không có quyền").count()
    + await page.locator("text=restricted").count()
    + await page.locator("text=quyền truy cập").count();

  expect(adminContent, "employee should NOT see admin dashboard").toBe(0);

  await page.screenshot({ path: "test-results/auth-session-dashboard/t5-admin-blocked.png" });
  await ctx.close();
});

// ─────────────────────────────────────────────────────────────
// Test 6: Mobile viewport - login and dashboard
// ─────────────────────────────────────────────────────────────
test("T6 - Mobile 390x844 - login and dashboard work", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", EMP_EMAIL);
  await page.fill("#loginPassword", EMP_PASSWORD);
  await page.click("#loginSubmitBtn");

  await page.waitForURL("**/dashboard**", { timeout: 15000 });
  await page.waitForSelector(".app-layout", { timeout: 8000 });

  const mainH = await page.evaluate(() => {
    const el = document.querySelector(".app-main");
    return el ? el.getBoundingClientRect().height : 0;
  });
  expect(mainH).toBeGreaterThan(50);

  await page.screenshot({ path: "test-results/auth-session-dashboard/t6-mobile.png", fullPage: true });
  await ctx.close();
});
