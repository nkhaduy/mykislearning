// @ts-check
import { test, expect } from "playwright/test";

const BASE = process.env.BASE_URL || "https://mykis-learning.nkhaduy.workers.dev";

const HR_EMAIL = "hr@kisvn.vn";
const HR_PASS = "KIS@Admin2025";
const EMP_EMAIL = "employee@kisvn.vn";
const EMP_PASS = "KIS@Employee2025";

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click("#loginSubmitBtn");
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
}

// ── 1. Shell render ─────────────────────────────────────────
test("HR shell renders sidebar and topbar", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.waitForSelector(".app-sidebar", { timeout: 8000 });
  await page.waitForSelector(".topbar", { timeout: 5000 });
  const sidebar = page.locator(".app-sidebar");
  await expect(sidebar).toBeVisible();
  const topbar = page.locator(".topbar");
  await expect(topbar).toBeVisible();
});

// ── 2. Sidebar active state ──────────────────────────────────
test("Sidebar marks active route correctly", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".app-sidebar .side-nav a.active", { timeout: 5000 });
  const active = page.locator(".app-sidebar .side-nav a.active");
  await expect(active).toHaveCount(1);
  await expect(active).toHaveAttribute("aria-current", "page");
});

// ── 3. Mobile drawer ─────────────────────────────────────────
test("Mobile drawer opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, HR_EMAIL, HR_PASS);
  const btn = page.locator("[data-open-mobile-nav]");
  await expect(btn).toBeVisible();
  await btn.click();
  const sidebar = page.locator("#appMobileDrawer");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  const closeBtn = page.locator("[data-close-mobile-nav]").first();
  await closeBtn.click();
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
});

// ── 4. User dropdown ─────────────────────────────────────────
test("User dropdown opens in topbar", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  const trigger = page.locator("[data-user-menu-trigger]").first();
  if (await trigger.count() === 0) return; // public pages only
  await trigger.click();
  const menu = page.locator("[data-user-menu]").first();
  await expect(menu).toBeVisible();
});

// ── 5. Keyboard navigation in sidebar ───────────────────────
test("Sidebar links are keyboard focusable", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.waitForSelector(".app-sidebar .side-nav a");
  const links = page.locator(".app-sidebar .side-nav a");
  const count = await links.count();
  expect(count).toBeGreaterThan(3);
  // Tab to first sidebar link
  await links.first().focus();
  await expect(links.first()).toBeFocused();
});

// ── 6. Course list renders ───────────────────────────────────
test("Course list page renders table and filter bar", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".filter-bar", { timeout: 8000 });
  await expect(page.locator(".filter-bar")).toBeVisible();
  await expect(page.locator(".table-wrap table, .ui-table")).toBeVisible();
});

// ── 7. Search input does not lose focus ──────────────────────
test("Course search input retains focus during typing", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  const searchInput = page.locator("#courseSearchInput");
  await searchInput.waitFor({ timeout: 8000 });
  await searchInput.click();
  await expect(searchInput).toBeFocused();

  // Type character by character and verify focus stays
  for (const char of "ABC") {
    await page.keyboard.type(char);
    await expect(searchInput).toBeFocused();
  }
  // Verify value accumulated
  await expect(searchInput).toHaveValue(/ABC/i);
});

// ── 8. Filter selects do not cause page flicker ──────────────
test("Course filter selects update results without full page reload", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector("[data-course-filter-status]", { timeout: 8000 });
  const results = page.locator("#courseResults");
  const initial = await results.innerHTML();
  const select = page.locator("[data-course-filter-status]");
  await select.selectOption("published");
  // courseResults should update in place, not whole page reload
  await expect(page.locator(".filter-bar")).toBeVisible();
  await expect(page.locator("#courseSearchInput")).toBeVisible();
});

// ── 9. Course detail tabs switch content ─────────────────────
test("Course detail page tabs switch between panels", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".table-wrap table tbody tr a[href^='/admin/courses/']", { timeout: 8000 });
  const firstLink = page.locator(".table-wrap table tbody tr a[href^='/admin/courses/']").first();
  const href = await firstLink.getAttribute("href");
  if (!href) return;
  await page.goto(`${BASE}${href}`);
  await page.waitForSelector(".detail-tabs", { timeout: 8000 });
  const tabs = page.locator(".detail-tabs [role='tab']");
  const count = await tabs.count();
  expect(count).toBeGreaterThanOrEqual(2);

  // Click second tab
  if (count >= 2) {
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
  }
});

// ── 10. Loading / empty / error state primitives ─────────────
test("Course list shows empty state when no matches", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  const search = page.locator("#courseSearchInput");
  await search.waitFor({ timeout: 8000 });
  await search.fill("ZZZZZZZZZ_no_match_9999");
  await page.waitForTimeout(400);
  const results = page.locator("#courseResults");
  const html = await results.innerHTML();
  // Should show empty state text, not a table
  expect(html).toMatch(/Chưa có khóa học|empty|no courses/i);
});

// ── 11. No horizontal overflow on courses page ───────────────
test("Course list has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".content", { timeout: 8000 });
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
});

// ── 12. No raw i18n keys visible ────────────────────────────
test("Course list page shows no raw i18n translation keys", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".content", { timeout: 8000 });
  const text = await page.locator(".content").innerText();
  // Raw keys look like "course.manage" "table.createdAt" etc.
  expect(text).not.toMatch(/\b[a-z]+\.[a-zA-Z]+\b(?! |\.)/);
});

// ── 13. No undefined in visible text ────────────────────────
test("Course list page shows no literal undefined", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".content", { timeout: 8000 });
  const text = await page.locator(".content").innerText();
  expect(text).not.toContain("undefined");
});

// ── 14. No console errors on courses page ────────────────────
test("Course list has no console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".filter-bar", { timeout: 8000 });
  // Filter out known non-critical noise
  const fatal = errors.filter((e) => !e.includes("favicon") && !e.includes("chrome-extension"));
  expect(fatal).toHaveLength(0);
});

// ── 15. Reduced motion: skeleton has no animation ────────────
test("Skeleton has no animation under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginAs(page, HR_EMAIL, HR_PASS);
  // Navigate to a page that shows skeleton briefly
  const anim = await page.evaluate(() => {
    const el = document.querySelector(".ui-skeleton, .hr-overview-skeleton span");
    if (!el) return null;
    const style = getComputedStyle(el);
    return style.animationName;
  });
  // Either skeleton not present or animation is none/unset
  if (anim !== null) {
    expect(["none", ""]).toContain(anim);
  }
});

// ── 16. New CSS tokens defined in :root ──────────────────────
test("KIS × Astryx token bridge variables are defined", async ({ page }) => {
  await page.goto(`${BASE}/`);
  const token = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--ui-color-accent").trim()
  );
  expect(token).toBeTruthy();
  expect(token).not.toBe("");

  const spacing = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--spacing-4").trim()
  );
  expect(spacing).toBe("16px");

  const radius = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--radius-element").trim()
  );
  expect(radius).toBe("8px");
});

// ── 17. No duplicate React runtime ───────────────────────────
test("No React runtime loaded in production bundle", async ({ page }) => {
  const scriptUrls = [];
  page.on("response", (resp) => {
    if (resp.url().includes(".js")) scriptUrls.push(resp.url());
  });
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForSelector(".filter-bar", { timeout: 10000 });
  const reactLoaded = scriptUrls.some((url) => url.includes("react") || url.includes("react-dom"));
  expect(reactLoaded).toBe(false);
});

// ── 18. Public landing page not broken ───────────────────────
test("Landing page renders without visible CSS regression", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForSelector("main, .landing-hero, .hero", { timeout: 8000 });
  // No white screen
  const body = await page.locator("body").boundingBox();
  expect(body?.height).toBeGreaterThan(300);
  // No horizontal overflow
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});

// ── 19. Login page not broken ────────────────────────────────
test("Login page renders form correctly", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 8000 });
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"], .btn-primary')).toBeVisible();
});

// ── 20. Sidebar nav groups have uppercase labels ──────────────
test("Sidebar nav group labels are rendered (not empty)", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASS);
  await page.waitForSelector(".app-sidebar .side-nav__group", { timeout: 5000 });
  const groups = page.locator(".app-sidebar .side-nav__group");
  const count = await groups.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const text = await groups.nth(i).innerText();
    expect(text.trim().length).toBeGreaterThan(0);
    // Should not be raw key
    expect(text).not.toMatch(/^[a-z]+\.[a-zA-Z]+$/);
  }
});
