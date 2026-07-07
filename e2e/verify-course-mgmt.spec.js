// @ts-check
import { test, expect } from "playwright/test";

const PROD = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const HR_PASS = "Training@2026";

async function loginAsHr(page) {
  await page.goto(PROD + "/login");
  await page.fill("#loginEmail", HR_EMAIL);
  await page.fill("#loginPassword", HR_PASS);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(/\/admin/, { timeout: 15000 });
}

test("HR Overview - no raw i18n keys in breadcrumb or sidebar", async ({ page }) => {
  await loginAsHr(page);
  await page.waitForTimeout(1000);
  const body = await page.content();
  expect(body).not.toContain("trainingTracking.title");
  expect(body).not.toContain("cchnRegistration.title");
});

test("HR Overview - resolved tasks tab exists", async ({ page }) => {
  await loginAsHr(page);
  await page.waitForTimeout(2000);
  const body = await page.content();
  expect(body).toContain("Đã xử lý");
  expect(body).toContain("Chờ xử lý");
});

test("Course List - delete button for all courses", async ({ page }) => {
  await loginAsHr(page);
  await page.goto(PROD + "/admin/courses");
  await page.waitForTimeout(3000);
  const deleteBtns = page.locator("[data-course-delete]");
  const count = await deleteBtns.count();
  expect(count).toBeGreaterThan(0);
  const tableText = await page.locator("table tbody").first().innerText().catch(() => "");
  expect(tableText).not.toMatch(/\bundefined\b/);
});

test("Course delete - impact modal appears and closes", async ({ page }) => {
  await loginAsHr(page);
  await page.goto(PROD + "/admin/courses");
  await page.waitForTimeout(3000);
  await page.locator("[data-course-delete]").first().click();
  await page.waitForSelector("[data-close-course-delete]", { timeout: 6000 });
  const modal = page.locator("[role=dialog]").last();
  await expect(modal).toBeVisible();
  await page.locator("[data-close-course-delete]").click();
  await page.waitForTimeout(500);
  await expect(page.locator("[data-close-course-delete]")).not.toBeVisible({ timeout: 3000 });
});

test("Content picker - no Bai doc van ban type", async ({ page }) => {
  await loginAsHr(page);
  await page.goto(PROD + "/admin/courses");
  await page.waitForTimeout(3000);
  const detailBtn = page.locator("[data-course-detail]").first();
  const hasDetail = await detailBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasDetail) { return; }
  await detailBtn.click();
  await page.waitForTimeout(500);
  const addBtn = page.locator("[data-content-add]").first();
  const hasAdd = await addBtn.isVisible({ timeout: 2000 }).catch(() => false);
  if (!hasAdd) { return; }
  await addBtn.click();
  await page.waitForTimeout(500);
  const pickerText = await page.content();
  expect(pickerText).not.toContain("Bài đọc văn bản");
});
