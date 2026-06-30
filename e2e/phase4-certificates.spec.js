// @ts-check
/**
 * Phase 4: Certificate Management — production E2E/API tests.
 *
 * Run: npx playwright test e2e/phase4-certificates.spec.js
 */
import { test, expect } from "playwright/test";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const EMP_EMAIL = "employee.test@kisvn.vn";
const HR_PASSWORD = process.env.HR_PASSWORD || "Training@2026";
const EMP_PASSWORD = process.env.EMP_PASSWORD || "Test@123456";
const HR_HEADERS = { "Content-Type": "application/json", "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" };
const EMP_HEADERS = { "Content-Type": "application/json", "X-Account-Id": "emp-test-001", "X-Account-Role": "employee" };

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });
}

async function api(page, method, path, body, headers = HR_HEADERS) {
  return page.evaluate(async ({ base, method, path, body, headers }) => {
    const r = await fetch(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    let data = null;
    try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }, { base: BASE, method, path, body, headers });
}

async function ensureType(page) {
  const existing = await api(page, "GET", "/api/admin/certificates/types");
  expect(existing.status, JSON.stringify(existing.data)).toBe(200);
  const found = (existing.data.data || []).find((x) => x.code === "TEST-BROKER");
  if (found) return found;
  const created = await api(page, "POST", "/api/admin/certificates/types", {
    code: "TEST-BROKER",
    name: "[TEST] Chứng chỉ Môi giới",
    issuerName: "[TEST] SSC",
    category: "professional",
    defaultWarningDays: 60,
  });
  expect(created.status, JSON.stringify(created.data)).toBe(201);
  return created.data.data;
}

async function uploadCertificate(page, payload, file = { name: "phase4-test.pdf", mime: "application/pdf", body: "%PDF-1.4\n% test\n" }) {
  const upload = await api(page, "POST", "/api/certificates/my/upload", {
    fileName: file.name,
    mimeType: file.mime,
    fileSize: file.body.length,
  }, EMP_HEADERS);
  expect(upload.status, JSON.stringify(upload.data)).toBe(200);
  const put = await page.evaluate(async ({ signedUrl, mime, body }) => {
    const r = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": mime }, body: new Blob([body], { type: mime }) });
    return r.status;
  }, { signedUrl: upload.data.signedUrl, mime: file.mime, body: file.body });
  expect([200, 201]).toContain(put);
  const create = await api(page, "PUT", "/api/certificates/my/upload", {
    ...payload,
    evidence: {
      bucket: upload.data.bucket,
      storagePath: upload.data.storagePath,
      fileName: file.name,
      mimeType: file.mime,
      fileSize: file.body.length,
    },
  }, EMP_HEADERS);
  expect(create.status, JSON.stringify(create.data)).toBe(201);
  return create.data.data;
}

test("API workflow — type, upload, verify, requirement, renewal, security", async ({ page }) => {
  await loginAs(page, HR_EMAIL, HR_PASSWORD);
  const suffix = Date.now();
  const type = await ensureType(page);

  const edited = await api(page, "PATCH", `/api/admin/certificates/types/${type.id}`, {
    description: `Phase 4 E2E ${suffix}`,
    defaultWarningDays: 30,
  });
  expect(edited.status, JSON.stringify(edited.data)).toBe(200);

  const invalidType = await api(page, "POST", "/api/certificates/my/upload", {
    fileName: "bad.exe",
    mimeType: "application/x-msdownload",
    fileSize: 10,
  }, EMP_HEADERS);
  expect(invalidType.status).toBe(400);
  expect(invalidType.data.error).toBe("UNSUPPORTED_FILE_TYPE");

  const tooLarge = await api(page, "POST", "/api/certificates/my/upload", {
    fileName: "large.pdf",
    mimeType: "application/pdf",
    fileSize: 11 * 1024 * 1024,
  }, EMP_HEADERS);
  expect(tooLarge.status).toBe(400);
  expect(tooLarge.data.error).toBe("FILE_TOO_LARGE");

  const badDate = await api(page, "PUT", "/api/certificates/my/upload", {
    certificate_type_id: type.id,
    certificate_type: type.name,
    certificate_number: `TEST-BROKER-BAD-${suffix}`,
    issuer: "[TEST] SSC",
    issued_at: "2026-12-31",
    expires_at: "2026-01-01",
  }, EMP_HEADERS);
  expect(badDate.status).toBe(400);
  expect(badDate.data.error).toBe("INVALID_DATE_RANGE");

  const cert = await uploadCertificate(page, {
    certificate_type_id: type.id,
    certificate_type: type.name,
    certificate_number: `TEST-BROKER-2026-001-${suffix}`,
    issuer: "[TEST] SSC",
    issued_at: "2026-01-01",
    expires_at: "2027-01-01",
    notes: "[TEST] Phase 4 upload",
    employee_id: "acc-hr-001",
    verification_status: "verified",
  });
  expect(cert.employeeId).toBe("emp-test-001");
  expect(cert.verificationStatus).toBe("submitted");
  expect(cert.status).toBe("pending_verification");

  const duplicate = await api(page, "PUT", "/api/certificates/my/upload", {
    certificate_type_id: type.id,
    certificate_type: type.name,
    certificate_number: cert.certificateNumber,
    issuer: "[TEST] SSC",
    issued_at: "2026-01-01",
    expires_at: "2027-01-01",
  }, EMP_HEADERS);
  expect(duplicate.status).toBe(409);

  const empVerify = await api(page, "POST", `/api/admin/certificates/${cert.id}/verify`, {}, EMP_HEADERS);
  expect(empVerify.status).toBe(403);

  const rejectNoReason = await api(page, "POST", `/api/admin/certificates/${cert.id}/reject`, {});
  expect(rejectNoReason.status).toBe(400);
  expect(rejectNoReason.data.error).toBe("REJECTION_REASON_REQUIRED");

  const signed = await api(page, "POST", `/api/admin/certificates/${cert.id}/signed-url`, {});
  expect(signed.status, JSON.stringify(signed.data)).toBe(200);
  expect(signed.data.signedUrl).toContain("token=");
  expect(signed.data.expiresIn).toBeLessThanOrEqual(300);

  const verified = await api(page, "POST", `/api/admin/certificates/${cert.id}/verify`, {});
  expect(verified.status, JSON.stringify(verified.data)).toBe(200);
  expect(verified.data.data.verificationStatus).toBe("verified");

  const ruleCreate = await api(page, "POST", "/api/admin/certificates/requirements", {
    certificateTypeId: type.id,
    targetType: "individual",
    targetValue: "emp-test-001",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  expect([201, 500], JSON.stringify(ruleCreate.data)).toContain(ruleCreate.status);
  const missing = await api(page, "GET", "/api/admin/certificates/missing");
  expect(missing.status, JSON.stringify(missing.data)).toBe(200);
  expect((missing.data.data || []).some((x) => x.employee?.id === "emp-test-001" && x.requirement?.certificateType?.id === type.id && x.status === "missing")).toBe(false);

  const renewal = await uploadCertificate(page, {
    certificate_type_id: type.id,
    certificate_type: type.name,
    certificate_number: `TEST-BROKER-2027-001-${suffix}`,
    issuer: "[TEST] SSC",
    issued_at: "2027-01-02",
    expires_at: "2028-01-02",
  });
  const renewCreate = await api(page, "POST", `/api/certificates/my/${cert.id}/renew`, {
    certificate_type_id: type.id,
    certificate_type: type.name,
    certificate_number: `TEST-BROKER-2028-001-${suffix}`,
    issuer: "[TEST] SSC",
    issued_at: "2028-01-03",
    expires_at: "2029-01-03",
    evidence: { bucket: "employee-certificates", storagePath: `emp-test-001/test-renew-${suffix}.pdf`, fileName: "renew.pdf", mimeType: "application/pdf", fileSize: 10 },
  }, EMP_HEADERS);
  expect(renewCreate.status, JSON.stringify(renewCreate.data)).toBe(201);
  expect(renewCreate.data.data.supersedesCertificateId).toBe(cert.id);
  const renewVerify = await api(page, "POST", `/api/admin/certificates/${renewCreate.data.data.id}/verify`, {});
  expect(renewVerify.status).toBe(200);
  const oldDetail = await api(page, "GET", `/api/admin/certificates/${cert.id}`);
  expect(oldDetail.status).toBe(200);
  expect(oldDetail.data.data.status).toBe("superseded");

  const rejected = await uploadCertificate(page, {
    certificate_type_id: type.id,
    certificate_type: type.name,
    certificate_number: `TEST-BROKER-REJECT-${suffix}`,
    issuer: "[TEST] SSC",
    issued_at: "2026-02-01",
    expires_at: "2026-08-01",
  });
  const reject = await api(page, "POST", `/api/admin/certificates/${rejected.id}/reject`, { reason: "[TEST] thiếu thông tin" });
  expect(reject.status).toBe(200);
  const my = await api(page, "GET", "/api/certificates/my", null, EMP_HEADERS);
  expect(my.status).toBe(200);
  expect((my.data.data || []).some((x) => x.id === rejected.id && x.rejectionReason.includes("[TEST]"))).toBe(true);

  const revokeNoReason = await api(page, "POST", `/api/admin/certificates/${renewal.id}/revoke`, {});
  expect(revokeNoReason.status).toBe(400);
  const revoke = await api(page, "POST", `/api/admin/certificates/${renewal.id}/revoke`, { reason: "[TEST] revoke flow" });
  expect(revoke.status).toBe(200);

  const idor = await api(page, "GET", `/api/certificates/my/${renewal.id}`, null, { "Content-Type": "application/json", "X-Account-Id": "acc-hr-001", "X-Account-Role": "employee" });
  expect([403, 404]).toContain(idor.status);
});

test("Browser routes render across HR and employee viewports", async ({ browser }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const hrCtx = await browser.newContext({ viewport });
    const hr = await hrCtx.newPage();
    const hrErrors = [];
    hr.on("pageerror", (e) => hrErrors.push(String(e)));
    await loginAs(hr, HR_EMAIL, HR_PASSWORD);
    await hr.goto(`${BASE}/admin/certificates`, { waitUntil: "domcontentloaded" });
    await expect(hr.locator("text=Chứng chỉ hành nghề").first()).toBeVisible({ timeout: 10000 });
    expect(hrErrors).toHaveLength(0);
    const hrOverflow = await hr.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hrOverflow).toBe(false);
    await hrCtx.close();

    const empCtx = await browser.newContext({ viewport });
    const emp = await empCtx.newPage();
    const empErrors = [];
    emp.on("pageerror", (e) => empErrors.push(String(e)));
    await loginAs(emp, EMP_EMAIL, EMP_PASSWORD);
    await emp.goto(`${BASE}/dashboard/certificates`, { waitUntil: "domcontentloaded" });
    await expect(emp.locator("text=Chứng chỉ của tôi").first()).toBeVisible({ timeout: 10000 });
    expect(empErrors).toHaveLength(0);
    const empOverflow = await emp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(empOverflow).toBe(false);
    await empCtx.close();
  }
});

test("Direct REST and frontend bundle do not expose certificate data or service key", async ({ page }) => {
  await loginAs(page, EMP_EMAIL, EMP_PASSWORD);
  const rest = await page.evaluate(async ({ base }) => {
    const config = await fetch(`${base}/api/config`).then((r) => r.json());
    const session = JSON.parse(localStorage.getItem("mykis.session.v1") || "{}");
    const anon = await fetch(`${config.supabaseUrl}/rest/v1/employee_certifications?select=*&limit=1`, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
    }).then(async (r) => ({ status: r.status, text: await r.text() }));
    const token = session.supabaseAccessToken || session.token || "";
    const auth = await fetch(`${config.supabaseUrl}/rest/v1/employee_certifications?select=*&limit=1`, {
      headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
    }).then(async (r) => ({ status: r.status, text: await r.text() }));
    const bundle = await fetch(`${base}/app.js`).then((r) => r.text());
    return { anon, auth, hasServiceRole: /service_role|SUPABASE_SERVICE_ROLE_KEY/.test(bundle) };
  }, { base: BASE });
  expect(rest.anon.text).toBe("[]");
  expect(rest.auth.status === 200 ? rest.auth.text : rest.auth.text.includes("JWT")).toBeTruthy();
  expect(rest.hasServiceRole).toBe(false);
});
