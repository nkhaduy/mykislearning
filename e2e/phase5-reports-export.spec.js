// @ts-check
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const HR_PASSWORD = process.env.HR_PASSWORD || "Training@2026";
const HR_HEADERS = { "Content-Type": "application/json", "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" };
const EMP_HEADERS = { "Content-Type": "application/json", "X-Account-Id": "emp-test-001", "X-Account-Role": "employee" };

async function api(page, path, headers = HR_HEADERS) {
  return page.evaluate(async ({ base, path, headers }) => {
    const r = await fetch(`${base}${path}`, { headers });
    const contentType = r.headers.get("content-type") || "";
    const disposition = r.headers.get("content-disposition") || "";
    if (contentType.includes("json")) {
      const data = await r.json().catch(() => null);
      return { status: r.status, contentType, disposition, data };
    }
    const body = await r.arrayBuffer();
    return { status: r.status, contentType, disposition, byteLength: body.byteLength };
  }, { base: BASE, path, headers });
}

async function loginHr(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", HR_EMAIL);
  await page.fill("#loginPassword", HR_PASSWORD);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(/\/admin/, { timeout: 15000 });
}

test("API — reports validate role, filters, pagination, and safe payload", async ({ page }) => {
  const overview = await api(page, "/api/admin/reports/overview?from_date=2026-01-01&to_date=2026-12-31");
  expect(overview.status, JSON.stringify(overview.data)).toBe(200);
  expect(overview.data.metrics).toHaveProperty("totalEmployees");
  expect(overview.data.metrics).toHaveProperty("completionRate");
  expect(JSON.stringify(overview.data)).not.toMatch(/password|service_role|storage_path|signedUrl/i);

  const empForbidden = await api(page, "/api/admin/reports/overview", EMP_HEADERS);
  expect(empForbidden.status).toBe(403);
  expect(empForbidden.data.error).toBe("HR_ONLY");

  const invalidType = await api(page, "/api/admin/reports/not-real");
  expect(invalidType.status).toBe(400);
  expect(invalidType.data.error).toBe("INVALID_REPORT_TYPE");

  const invalidSort = await api(page, "/api/admin/reports/employees?sortBy=password_hash");
  expect(invalidSort.status).toBe(400);
  expect(invalidSort.data.error).toBe("INVALID_SORT_FIELD");

  const invalidDate = await api(page, "/api/admin/reports/employees?from_date=2026-12-31&to_date=2026-01-01");
  expect(invalidDate.status).toBe(400);
  expect(invalidDate.data.error).toBe("INVALID_DATE_RANGE");

  const page1 = await api(page, "/api/admin/reports/employees?from_date=2026-01-01&to_date=2026-12-31&page=1&pageSize=2");
  expect(page1.status, JSON.stringify(page1.data)).toBe(200);
  expect(page1.data.rows.length).toBeLessThanOrEqual(2);
  expect(page1.data.page).toBe(1);

  const filtered = await api(page, "/api/admin/reports/employees?from_date=2026-01-01&to_date=2026-12-31&department=QA&pageSize=10");
  expect(filtered.status, JSON.stringify(filtered.data)).toBe(200);
  expect(filtered.data.rows.every((row) => row.department === "QA" || filtered.data.rows.length === 0)).toBeTruthy();
});

test("Export — CSV, XLSX, PDF endpoints return downloadable files and employee is blocked", async ({ page }) => {
  const csv = await api(page, "/api/admin/reports/export?report_type=employees&format=csv&from_date=2026-01-01&to_date=2026-12-31&pageSize=10");
  expect(csv.status).toBe(200);
  expect(csv.contentType).toContain("text/csv");
  expect(csv.disposition).toContain(".csv");
  expect(csv.byteLength).toBeGreaterThan(20);

  const xlsx = await api(page, "/api/admin/reports/export?report_type=employees&format=xlsx&from_date=2026-01-01&to_date=2026-12-31&pageSize=10");
  expect(xlsx.status).toBe(200);
  expect(xlsx.contentType).toContain("spreadsheetml");
  expect(xlsx.disposition).toContain(".xlsx");
  expect(xlsx.byteLength).toBeGreaterThan(1000);

  const pdf = await api(page, "/api/admin/reports/export?report_type=overview&format=pdf&from_date=2026-01-01&to_date=2026-12-31");
  expect(pdf.status).toBe(200);
  expect(pdf.contentType).toContain("application/pdf");
  expect(pdf.disposition).toContain(".pdf");
  expect(pdf.byteLength).toBeGreaterThan(100);

  const empExport = await api(page, "/api/admin/reports/export?report_type=employees&format=csv", EMP_HEADERS);
  expect(empExport.status).toBe(403);
  expect(empExport.data.error).toBe("HR_ONLY");
});

test("Browser — HR report hub loads, filters persist, and mobile layout is usable", async ({ page }) => {
  await loginHr(page);
  await page.goto(`${BASE}/admin/reports?type=departments&range=30d`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".report-head h1")).toBeVisible();
  await expect(page.locator(".report-tabs")).toBeVisible();
  await page.locator("[data-report-dept]").fill("QA");
  await expect(page).toHaveURL(/department=QA/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-report-dept]")).toHaveValue("QA");

  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin/reports?type=overview&range=30d`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".report-head")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBeFalsy();
  expect(errors.filter((line) => !/favicon|ERR_ABORTED/.test(line))).toEqual([]);
});
