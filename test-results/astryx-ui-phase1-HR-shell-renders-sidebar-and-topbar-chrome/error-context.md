# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: astryx-ui-phase1.spec.js >> HR shell renders sidebar and topbar
- Location: e2e/astryx-ui-phase1.spec.js:20:1

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic:
  - generic:
    - main [ref=e1]:
      - link "Quay về trang chủ" [ref=e2] [cursor=pointer]:
        - /url: /
        - img [ref=e3]
        - text: Về trang chủ
      - generic [ref=e6]:
        - heading [level=1] [ref=e7]: Đăng nhập MyKIS Learning
        - paragraph [ref=e8]: Nền tảng Học tập và Phát triển năng lực Dành riêng cho nhân viên KIS Việt Nam
      - generic [ref=e10]:
        - generic [ref=e12]:
          - link "Quay về trang chủ" [ref=e13] [cursor=pointer]:
            - /url: /
            - img "KIS Vietnam" [ref=e14]
          - generic [ref=e16]:
            - button "VI" [ref=e17] [cursor=pointer]
            - button "EN" [ref=e18] [cursor=pointer]
            - button "KR" [ref=e19] [cursor=pointer]
        - heading "Đăng nhập" [level=2] [ref=e21]
        - generic [ref=e22]:
          - generic [ref=e23]: Email
          - textbox "Email" [ref=e24]:
            - /placeholder: Nhập email công ty
            - text: hr@kisvn.vn
        - generic [ref=e26]:
          - generic [ref=e27]: Mật khẩu
          - generic [ref=e28]:
            - textbox "Mật khẩu" [ref=e29]:
              - /placeholder: Nhập mật khẩu
            - button "Hiện mật khẩu" [ref=e30] [cursor=pointer]:
              - img [ref=e31]
        - generic [ref=e34]:
          - generic [ref=e35] [cursor=pointer]:
            - checkbox "Ghi nhớ đăng nhập trên thiết bị này" [ref=e36]
            - generic [ref=e37]: Ghi nhớ đăng nhập trên thiết bị này
          - button "cannotLogin" [ref=e38] [cursor=pointer]
        - button "Đăng nhập" [ref=e39] [cursor=pointer]:
          - generic [ref=e40]: Đăng nhập
        - paragraph [ref=e41]: Tài khoản được cấp bởi Phòng Nhân sự
        - group [ref=e42]:
          - generic "Tài khoản dùng thử" [ref=e43] [cursor=pointer]:
            - generic [ref=e44]:
              - img [ref=e45]
              - text: Tài khoản dùng thử
            - img [ref=e48]
    - dialog "Đăng nhập không thành công" [ref=e51]:
      - generic [ref=e52]:
        - generic [ref=e53]: ⚠
        - generic [ref=e54]:
          - heading "Đăng nhập không thành công" [level=2] [ref=e55]
          - paragraph [ref=e56]: Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra và thử lại.
      - button "Đóng" [active] [ref=e58] [cursor=pointer]
```

# Test source

```ts
  1   | // @ts-check
  2   | import { test, expect } from "playwright/test";
  3   | 
  4   | const BASE = process.env.BASE_URL || "https://mykis-learning.nkhaduy.workers.dev";
  5   | 
  6   | const HR_EMAIL = "hr@kisvn.vn";
  7   | const HR_PASS = "KIS@Admin2025";
  8   | const EMP_EMAIL = "employee@kisvn.vn";
  9   | const EMP_PASS = "KIS@Employee2025";
  10  | 
  11  | async function loginAs(page, email, password) {
  12  |   await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  13  |   await page.fill("#loginEmail", email);
  14  |   await page.fill("#loginPassword", password);
  15  |   await page.click("#loginSubmitBtn");
> 16  |   await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  17  | }
  18  | 
  19  | // ── 1. Shell render ─────────────────────────────────────────
  20  | test("HR shell renders sidebar and topbar", async ({ page }) => {
  21  |   await loginAs(page, HR_EMAIL, HR_PASS);
  22  |   await page.waitForSelector(".app-sidebar", { timeout: 8000 });
  23  |   await page.waitForSelector(".topbar", { timeout: 5000 });
  24  |   const sidebar = page.locator(".app-sidebar");
  25  |   await expect(sidebar).toBeVisible();
  26  |   const topbar = page.locator(".topbar");
  27  |   await expect(topbar).toBeVisible();
  28  | });
  29  | 
  30  | // ── 2. Sidebar active state ──────────────────────────────────
  31  | test("Sidebar marks active route correctly", async ({ page }) => {
  32  |   await loginAs(page, HR_EMAIL, HR_PASS);
  33  |   await page.goto(`${BASE}/admin/courses`);
  34  |   await page.waitForSelector(".app-sidebar .side-nav a.active", { timeout: 5000 });
  35  |   const active = page.locator(".app-sidebar .side-nav a.active");
  36  |   await expect(active).toHaveCount(1);
  37  |   await expect(active).toHaveAttribute("aria-current", "page");
  38  | });
  39  | 
  40  | // ── 3. Mobile drawer ─────────────────────────────────────────
  41  | test("Mobile drawer opens and closes", async ({ page }) => {
  42  |   await page.setViewportSize({ width: 390, height: 844 });
  43  |   await loginAs(page, HR_EMAIL, HR_PASS);
  44  |   const btn = page.locator("[data-open-mobile-nav]");
  45  |   await expect(btn).toBeVisible();
  46  |   await btn.click();
  47  |   const sidebar = page.locator("#appMobileDrawer");
  48  |   await expect(sidebar).toHaveAttribute("aria-hidden", "false");
  49  |   const closeBtn = page.locator("[data-close-mobile-nav]").first();
  50  |   await closeBtn.click();
  51  |   await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  52  | });
  53  | 
  54  | // ── 4. User dropdown ─────────────────────────────────────────
  55  | test("User dropdown opens in topbar", async ({ page }) => {
  56  |   await loginAs(page, HR_EMAIL, HR_PASS);
  57  |   const trigger = page.locator("[data-user-menu-trigger]").first();
  58  |   if (await trigger.count() === 0) return; // public pages only
  59  |   await trigger.click();
  60  |   const menu = page.locator("[data-user-menu]").first();
  61  |   await expect(menu).toBeVisible();
  62  | });
  63  | 
  64  | // ── 5. Keyboard navigation in sidebar ───────────────────────
  65  | test("Sidebar links are keyboard focusable", async ({ page }) => {
  66  |   await loginAs(page, HR_EMAIL, HR_PASS);
  67  |   await page.waitForSelector(".app-sidebar .side-nav a");
  68  |   const links = page.locator(".app-sidebar .side-nav a");
  69  |   const count = await links.count();
  70  |   expect(count).toBeGreaterThan(3);
  71  |   // Tab to first sidebar link
  72  |   await links.first().focus();
  73  |   await expect(links.first()).toBeFocused();
  74  | });
  75  | 
  76  | // ── 6. Course list renders ───────────────────────────────────
  77  | test("Course list page renders table and filter bar", async ({ page }) => {
  78  |   await loginAs(page, HR_EMAIL, HR_PASS);
  79  |   await page.goto(`${BASE}/admin/courses`);
  80  |   await page.waitForSelector(".filter-bar", { timeout: 8000 });
  81  |   await expect(page.locator(".filter-bar")).toBeVisible();
  82  |   await expect(page.locator(".table-wrap table, .ui-table")).toBeVisible();
  83  | });
  84  | 
  85  | // ── 7. Search input does not lose focus ──────────────────────
  86  | test("Course search input retains focus during typing", async ({ page }) => {
  87  |   await loginAs(page, HR_EMAIL, HR_PASS);
  88  |   await page.goto(`${BASE}/admin/courses`);
  89  |   const searchInput = page.locator("#courseSearchInput");
  90  |   await searchInput.waitFor({ timeout: 8000 });
  91  |   await searchInput.click();
  92  |   await expect(searchInput).toBeFocused();
  93  | 
  94  |   // Type character by character and verify focus stays
  95  |   for (const char of "ABC") {
  96  |     await page.keyboard.type(char);
  97  |     await expect(searchInput).toBeFocused();
  98  |   }
  99  |   // Verify value accumulated
  100 |   await expect(searchInput).toHaveValue(/ABC/i);
  101 | });
  102 | 
  103 | // ── 8. Filter selects do not cause page flicker ──────────────
  104 | test("Course filter selects update results without full page reload", async ({ page }) => {
  105 |   await loginAs(page, HR_EMAIL, HR_PASS);
  106 |   await page.goto(`${BASE}/admin/courses`);
  107 |   await page.waitForSelector("[data-course-filter-status]", { timeout: 8000 });
  108 |   const results = page.locator("#courseResults");
  109 |   const initial = await results.innerHTML();
  110 |   const select = page.locator("[data-course-filter-status]");
  111 |   await select.selectOption("published");
  112 |   // courseResults should update in place, not whole page reload
  113 |   await expect(page.locator(".filter-bar")).toBeVisible();
  114 |   await expect(page.locator("#courseSearchInput")).toBeVisible();
  115 | });
  116 | 
```