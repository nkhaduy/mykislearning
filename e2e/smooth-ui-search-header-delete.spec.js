// @ts-check
import { test, expect } from "playwright/test";

const BASE = process.env.BASE_URL || "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "thanh.ntc@kisvn.vn";
const HR_PASSWORD = "Demo@123456";
const EMP_EMAIL = "nguyen.van.an@kisvn.vn";
const EMP_PASSWORD = "Test@123456";
const SEARCH_TEXT = "quản lý khóa học 2026";

async function login(page, role = "hr") {
  if (BASE.includes("127.0.0.1") || BASE.includes("localhost")) {
    const account = role === "hr"
      ? { accountId: "acc-hr-demo", role: "hr", fullName: "Nguyễn Thị Cẩm Thanh" }
      : { accountId: "acc-001", role: "employee", fullName: "Nguyễn Văn An" };
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ account }) => {
      localStorage.setItem("mykis.session.v1", JSON.stringify({
        sessionId: crypto.randomUUID(),
        ...account,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        rememberMe: false,
      }));
    }, { account });
    await page.goto(`${BASE}${role === "hr" ? "/admin" : "/dashboard"}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-layout", { timeout: 15000 });
    return;
  }
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", role === "hr" ? HR_EMAIL : EMP_EMAIL);
  await page.fill("#loginPassword", role === "hr" ? HR_PASSWORD : EMP_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(role === "hr" ? "**/admin**" : "**/dashboard**", { timeout: 15000 });
}

async function sessionHeaders(page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("mykis.session.v1") || "{}");
    return { "X-Account-Id": s.accountId || "", "X-Account-Role": s.role || "hr" };
  });
}

async function typeWithoutFocusLoss(page, selector) {
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    if (!el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return document.querySelector(sel) === el && el.isConnected;
  }, selector);
  await page.locator(selector).first().focus();
  await expect(page.locator(selector).first()).toBeFocused();
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.keyboard.insertText(SEARCH_TEXT);
  await expect(page.locator(selector).first()).toHaveValue(SEARCH_TEXT);
  await expect(page.locator(selector).first()).toBeFocused();
  const state = await page.locator(selector).first().evaluate((el) => ({
    caret: el.selectionStart,
    length: el.value.length,
    scroll: window.scrollY,
  }));
  expect(state.caret).toBe(state.length);
  expect(Math.abs(state.scroll - beforeScroll)).toBeLessThanOrEqual(4);
}

test("public header keeps only public navigation and exposes real user dropdown", async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const header = page.locator(".header").first();
  await expect(header.getByRole("link", { name: /Trang chủ|Home/i })).toBeVisible();
  await expect(header.getByRole("link", { name: /Về KIS|About/i })).toBeVisible();
  await expect(header.getByText(/Khóa học|Courses/i)).toBeVisible();
  await expect(header.getByRole("link", { name: /Đăng nhập|Sign in/i })).toBeVisible();
  await expect(header.getByText(/Thông báo|Báo cáo đào tạo/i)).toHaveCount(0);

  await login(page, "hr");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await expect(header.getByText(/Thông báo|Báo cáo đào tạo/i)).toHaveCount(0);
  const trigger = page.locator("[data-user-menu-trigger]").first();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu").getByText("Vào trang quản trị")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("priority search inputs keep focus while typing Vietnamese text", async ({ page }) => {
  await login(page, "hr");
  for (const [url, selector] of [
    ["/admin/courses", "[data-course-search]"],
    ["/admin/employees", "#employeeDirSearch"],
    ["/admin/training-tracking", "[data-tt-search]"],
    ["/admin/cchn-registrations", "[data-cchn-search]"],
  ]) {
    await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(selector, { timeout: 15000 });
    await typeWithoutFocusLoss(page, selector);
  }

  await page.goto(`${BASE}/admin/audit-log`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-audit-filter] input[name='search']", { timeout: 15000 });
  await typeWithoutFocusLoss(page, "[data-audit-filter] input[name='search']");
});

test("course delete is one click with no confirmation popup and persists after reload", async ({ page }) => {
  await login(page, "hr");
  const headers = await sessionHeaders(page);
  const id = `smooth-delete-${Date.now()}`;
  const title = `[TEST] Smooth Delete ${id}`;
  const isLocal = BASE.includes("127.0.0.1") || BASE.includes("localhost");
  if (isLocal) {
    await page.route("**/api/courses**", async (route) => {
      const req = route.request();
      if (req.method() === "DELETE") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      if (req.url().includes("/impact")) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "not_found" }) });
      return route.fallback();
    });
  }
  const created = isLocal
    ? await page.evaluate(({ id, title }) => {
      const key = "mykis.courses.v1";
      const rows = JSON.parse(localStorage.getItem(key) || "[]");
      rows.push({ id, title, name: title, status: "draft", category: "Test", durationHours: 1, description: "Automated delete fixture", createdAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(rows));
      return true;
    }, { id, title })
    : await page.evaluate(async ({ BASE, headers, id, title }) => {
      const r = await fetch(`${BASE}/api/courses`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id, title, status: "draft", category: "Test", durationHours: 1, description: "Automated delete fixture" }),
      });
      return r.ok;
    }, { BASE, headers, id, title });
  expect(created).toBe(true);

  await page.goto(`${BASE}/admin/courses`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-course-search]").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(250);
  await page.locator("[data-course-search]").evaluate((el, value) => {
    el.focus();
    el.value = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }, title);
  const row = page.locator(`[data-course-row="${id}"]`);
  await expect(row).toBeVisible({ timeout: 15000 });
  const dialogs = [];
  page.on("dialog", (dialog) => { dialogs.push(dialog.type()); dialog.dismiss().catch(() => {}); });
  await row.locator("[data-course-delete]").evaluate((el) => el.click());
  await expect(page.locator("[data-confirm-course-delete], #courseDeleteConfirmInput")).toHaveCount(0);
  await expect(row).toHaveCount(0, { timeout: 15000 });
  expect(dialogs).toHaveLength(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.fill("[data-course-search]", title);
  await expect(page.locator(`[data-course-row="${id}"]`)).toHaveCount(0);
});

test("About KIS hero, timeline and footer remain stable", async ({ page }) => {
  await page.goto(`${BASE}/about-kis`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".about-hero-v2__stats")).toBeVisible();
  await expect(page.locator(".about-hero-v2__stats > *")).toHaveCount(4);
  const section = page.locator("#kis-history");
  await section.scrollIntoViewIfNeeded();
  const before = await section.evaluate((el) => el.innerHTML.length);
  await section.locator("[data-timeline-year]").nth(1).click();
  const after = await section.evaluate((el) => el.innerHTML.length);
  expect(after).toBeGreaterThan(before * 0.5);
  await expect(page.getByText("Nguyễn Thị Cẩm Thanh")).toBeVisible();
  await expect(page.locator('a[href="mailto:thanh.ntc@kisvn.vn"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
