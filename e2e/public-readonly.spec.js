import { test, expect } from "playwright/test";

test("NEW-UX-RESTORE-001/003: restored home has no course discovery or private dependencies", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "MyKIS Learning" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();
  await expect(page.locator(".hero-banner-img")).toHaveJSProperty("naturalWidth", 941);
  expect(requests).toContain("/public/images/mykis-learning-banner-mobile.webp");
  expect(requests).not.toContain("/public/images/hoiso.webp");
  const stats = page.locator("[data-countup-section]");
  await stats.scrollIntoViewIfNeeded();
  await expect(stats).toHaveClass(/is-visible/);
  await expect(page.locator('[data-countup="4"]')).toHaveAttribute("data-countup-state", "complete", { timeout: 3000 });
  expect(await page.locator('[data-countup="4"]').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("linear-gradient");
  await page.locator(".kis-about-banner-v2").scrollIntoViewIfNeeded();
  await expect(page.locator(".kis-about-banner-v2")).toBeVisible();
  await expect(page.locator(".kis-about-banner-v2__image")).toHaveJSProperty("naturalWidth", 2560);
  await expect(page.locator("#featured-courses, .course-card-v2, [data-scroll='featured-courses']")).toHaveCount(0);
  await expect(page.locator('a[href="/training"], a[href="#featured-courses"], a[href="/#featured-courses"]')).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Khám phá khóa học");
  expect(requests.some((path) => path === "/api/courses" || path.includes("featured-course"))).toBe(false);
  expect(requests).not.toContain("/app.js");
  expect(requests).not.toContain("/styles.css");
  expect(requests).not.toContain("/vendor/xlsx.full.min.js");
  expect(requests).not.toContain("/vendor/jsqr.min.js");
  expect(requests.some((path) => path.includes("/src/features/hr/") || path.includes("/src/features/learner/") || path.includes("/src/features/reporting/"))).toBe(false);
  expect(await page.locator(".hero-title--kis").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Be Vietnam Pro");
  await page.locator(".footer-v2").scrollIntoViewIfNeeded();
  await expect(page.getByText("Nguyễn Thị Cẩm Thanh", { exact: true })).toBeVisible();
  await expect(page.getByText("Phòng Nhân sự", { exact: true })).toBeVisible();
  await expect(page.locator('a[href="mailto:thanh.ntc@kisvn.vn"]')).toHaveText("thanh.ntc@kisvn.vn");

  const menuButton = page.locator("[data-mobile-nav-toggle]");
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#public-nav").getByRole("link", { name: "Về KIS" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(menuButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test("NEW-UX-RESTORE-002: About route restores legacy sections and keeps split accessibility", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/about-kis");
  await expect(page.locator(".about-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Về KIS Việt Nam" })).toBeVisible();
  await expect(page.locator(".overview-section-v2, .board-section, .core-values-v2, .philosophy-v2, .network-v2, .ceo-v2")).toHaveCount(6);
  expect(requests).not.toContain("/app.js");
  expect(requests).not.toContain("/styles.css");
  expect(requests).not.toContain("/vendor/xlsx.full.min.js");
  expect(requests).not.toContain("/vendor/jsqr.min.js");
  expect(requests.some((path) => path.includes("/src/features/hr/") || path.includes("/src/features/learner/") || path.includes("/src/features/reporting/"))).toBe(false);
  await page.getByRole("tab", { name: "2020", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#timeline-panel")).toHaveAttribute("aria-labelledby", "timeline-year-2020");
  await expect(page.locator("#timeline-year-2020")).toHaveAttribute("aria-controls", "timeline-panel");
  await expect(page.locator(".timeline-carousel__year-big")).toHaveText("2020");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("tab", { name: "2021", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".timeline-carousel__year-big")).toHaveText("2021");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".network-reference-map").scrollIntoViewIfNeeded();
  await expect(page.locator(".network-reference-map img")).toHaveJSProperty("naturalWidth", 3840);
  await page.locator(".footer-v2").scrollIntoViewIfNeeded();
  await expect(page.locator('a[href="mailto:thanh.ntc@kisvn.vn"]')).toBeVisible();
  await page.locator(".footer-v2").getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "About KIS Vietnam" })).toBeVisible();
  await page.locator(".footer-v2").getByRole("button", { name: "KR" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "KIS Vietnam 소개" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/about\.|undefined/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});

test("public read-only: login form is available", async ({ page }) => {
  await page.setViewportSize({ width: 998, height: 463 });
  await page.goto("/login");
  await expect(page.locator("#loginForm")).toBeVisible();
  await expect(page.locator(".auth-home-link")).toContainText("Về trang chủ");
  await expect(page.locator(".auth-card h1")).toHaveText("Đăng nhập");
  await expect(page.locator('input[type="password"]')).toHaveAttribute("autocomplete", "current-password");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  expect(await page.locator(".auth-card").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.abs(bounds.top - (window.innerHeight - bounds.bottom));
  })).toBeLessThanOrEqual(1);
  await expect(page.locator(".auth-logo-link img")).toHaveJSProperty("naturalWidth", 700);
  expect(await page.locator(".auth-card").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Be Vietnam Pro");
});

test("public read-only: mobile login is lightweight and keyboard-safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = [];
  const consoleErrors = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/login");
  await expect(page.locator("#loginForm")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  expect(requests).not.toContain("/app.js");
  expect(requests).not.toContain("/styles.css");
  expect(requests).not.toContain("/public/images/kis-head-office.webp");
  expect(consoleErrors).toEqual([]);

  const supportButton = page.locator("[data-support-open]");
  await supportButton.click();
  const lastOption = page.locator('[data-support-type="issue"]');
  await lastOption.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-support-close]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".auth-modal")).toHaveCount(0);
  await expect(supportButton).toBeFocused();
});

test("public read-only: login rejects invalid and non-JSON responses safely", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/auth?action=login", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>unexpected fallback</title>",
  }));
  await page.goto("/login");

  await page.locator("#loginSubmitBtn").click();
  await expect(page.locator("#loginEmail")).toBeFocused();
  await page.locator("#loginEmail").fill("employee@example.invalid");
  await page.locator("#loginPassword").fill("SyntheticPassword!1");
  await page.locator("#loginSubmitBtn").click();
  await expect(page.getByRole("alert")).toContainText("Máy chủ trả về phản hồi không hợp lệ");
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(consoleErrors).toEqual([]);
});

test("public read-only: login reports rate limiting without claiming credentials are invalid", async ({ page }) => {
  await page.route("**/api/auth?action=login", (route) => route.fulfill({
    status: 429,
    contentType: "application/json",
    headers: { "Retry-After": "30" },
    body: JSON.stringify({ error: "RATE_LIMITED", retryAfter: 30 }),
  }));
  await page.goto("/login");
  await page.locator("#loginEmail").fill("employee@example.invalid");
  await page.locator("#loginPassword").fill("SyntheticPassword!1");
  await page.locator("#loginSubmitBtn").click();
  await expect(page.getByRole("alert")).toContainText("Có quá nhiều lần đăng nhập");
  await expect(page.getByRole("alert")).not.toContainText("không chính xác");
});

test("public read-only: protected deep links preserve only safe destinations", async ({ page }) => {
  await page.goto("/hr/reports?range=30");
  await page.waitForURL(/\/login\?returnTo=/);
  await expect(page.locator(".auth-destination")).toContainText("khu vực quản trị");
  expect(await page.evaluate(() => localStorage.getItem("mykis.postLoginRedirect.v1"))).toBe("/hr/reports?range=30");

  await page.goto("/login?returnTo=https%3A%2F%2Fattacker.example");
  await expect(page.locator(".auth-destination")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("mykis.postLoginRedirect.v1"))).toBeNull();
});

test("public read-only: synthetic successful login returns to the allowed destination", async ({ page }) => {
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action");
    if (action === "login") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          profile: { id: "synthetic-hr", fullName: "Synthetic HR", role: "hr", accountStatus: "active", passwordStatus: "normal" },
        }),
      });
    }
    if (action === "session") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, expires_at: Math.floor(Date.now() / 1000) + 3600, account: { id: "synthetic-hr", role: "hr" } }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
  });

  await page.goto("/login?returnTo=%2Fadmin%2Freports");
  await page.locator("#loginEmail").fill("synthetic@example.invalid");
  await page.locator("#loginPassword").fill("SyntheticPassword!1");
  await Promise.all([
    page.waitForURL(/\/hr\/reports$/),
    page.locator("#loginSubmitBtn").click(),
  ]);
  expect(new URL(page.url()).pathname).toBe("/hr/reports");
  expect(await page.evaluate(() => localStorage.getItem("mykis.postLoginRedirect.v1"))).toBeNull();
});

test("public read-only: unknown route has real 404 semantics and recovery links", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Không tìm thấy trang" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  expect(await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Be Vietnam Pro");
});
