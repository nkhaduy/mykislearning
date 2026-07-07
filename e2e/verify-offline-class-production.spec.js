// @ts-check
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "thanh.ntc@kisvn.vn";
const HR_PASSWORD = "Demo@123456";
const EMP_EMAIL = "employee.test@kisvn.vn";
const EMP_PASSWORD = "Test@123456";

test.describe("Offline Class Production Verification", () => {
  // ── HR tests require a valid HR account in Supabase ─────────────────
  // HR account thanh.ntc@kisvn.vn needs its password set via:
  //   POST /api/auth?action=setup-admin-password
  //   { email: "thanh.ntc@kisvn.vn", password: "Demo@123456" }
  // Until then, HR tests are skipped in CI.

  test.skip("1. HR sidebar has no raw i18n keys", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("#loginEmail", HR_EMAIL);
    await page.fill("#loginPassword", HR_PASSWORD);
    await page.click("#loginSubmitBtn");
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("trainingTracking");
    expect(body).not.toContain("cchnRegistration");
    expect(body).not.toContain("navComplianceShort");
    expect(body).toContain("Theo dõi đào tạo");
    expect(body).toContain("Đăng ký học CCHN");
    expect(body).toContain("Tuân thủ");
  });

  test.skip("2. /admin/sessions loading completes", async ({ page }) => {
    page.on("pageerror", (e) => console.log("PAGE_ERROR:", e.message));
    page.on("requestfailed", (req) => console.log("REQ_FAIL:", req.url()));
    await page.goto(`${BASE}/login`);
    await page.fill("#loginEmail", HR_EMAIL);
    await page.fill("#loginPassword", HR_PASSWORD);
    await page.click("#loginSubmitBtn");
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.goto(`${BASE}/admin/sessions`);
    await page.waitForTimeout(4000);
    const loadingVisible = await page.locator("text=Đang tải lớp học").isVisible().catch(() => false);
    expect(loadingVisible).toBeFalsy();
    const hasCards = await page.locator(".session-admin-card").first().isVisible().catch(() => false);
    const hasEmpty = await page.locator("text=Chưa có lớp trực tiếp nào").isVisible().catch(() => false);
    const hasError = await page.locator("text=Không thể tải danh sách lớp học").isVisible().catch(() => false);
    expect(hasCards || hasEmpty || hasError).toBeTruthy();
  });

  test("3. Employee blocked from /admin/sessions", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("#loginEmail", EMP_EMAIL);
    await page.fill("#loginPassword", EMP_PASSWORD);
    await page.click("#loginSubmitBtn");
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    await page.goto(`${BASE}/admin/sessions`);
    await page.waitForTimeout(3000);
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("Quản lý buổi học");
  });

  test.skip("4. Mobile no raw keys", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/login`);
    await page.fill("#loginEmail", HR_EMAIL);
    await page.fill("#loginPassword", HR_PASSWORD);
    await page.click("#loginSubmitBtn");
    await page.waitForURL("**/dashboard**", { timeout: 15000 });
    const body = await page.locator("body").textContent();
    expect(body).not.toContain("trainingTracking");
    expect(body).not.toContain("cchnRegistration");
  });

  test.skip("5. VI/EN/KR no raw keys", async ({ page }) => {
    for (const lang of ["vi", "en", "kr"]) {
      await page.goto(`${BASE}/login?lang=` + lang);
      await page.fill("#loginEmail", HR_EMAIL);
      await page.fill("#loginPassword", HR_PASSWORD);
      await page.click("#loginSubmitBtn");
      await page.waitForURL("**/dashboard**", { timeout: 15000 });
      const body = await page.locator("body").textContent();
      expect(body, `lang=${lang}`).not.toContain("trainingTracking");
      expect(body, `lang=${lang}`).not.toContain("cchnRegistration");
    }
  });
});
