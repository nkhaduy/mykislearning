import { expect, test } from "playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
const runtimePath = process.env.KIS_CLEAN_ROOM_CREDENTIALS;
if (!runtimePath) throw new Error("KIS_CLEAN_ROOM_CREDENTIALS is required");
if (!new Set(["127.0.0.1", "localhost"]).has(new URL(baseURL).hostname)) {
  throw new Error("clean-room role audit refuses non-local targets");
}

const runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
const artifactDir = resolve("output/playwright/clean-room-role-audit");
const evidencePath = resolve("docs/audit-remediation/evidence/UI_ROLE_AUDIT_RUNTIME.json");
mkdirSync(artifactDir, { recursive: true });
mkdirSync(resolve("docs/audit-remediation/evidence"), { recursive: true });

const audit = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  target: "local-disposable",
  roles: {},
  viewports: [],
  findings: [],
  productionMutation: "NONE",
};
let hrStorageState;

function installInstrumentation(page) {
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const responses = [];
  const apiRequests = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text().slice(0, 500) });
  });
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 500)));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) {
      const action = url.searchParams.get("action");
      apiRequests.push(`${request.method()} ${url.pathname}${action ? `?action=${action}` : ""}`);
    }
  });
  page.on("requestfailed", (request) => failedRequests.push({ method: request.method(), path: new URL(request.url()).pathname, error: request.failure()?.errorText || "failed" }));
  page.on("response", (response) => {
    if (response.status() >= 400) responses.push({ status: response.status(), path: new URL(response.url()).pathname });
  });
  return { consoleMessages, pageErrors, failedRequests, responses, apiRequests };
}

async function enablePerformanceObservers(page) {
  await page.addInitScript(() => {
    window.__kisAuditMetrics = { cls: 0, longTasks: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__kisAuditMetrics.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => { window.__kisAuditMetrics.longTasks += list.getEntries().length; })
        .observe({ type: "longtask", buffered: true });
    } catch {}
  });
}

async function login(page, identity) {
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#loginEmail").fill(identity.email);
  await page.locator("#loginPassword").fill(identity.password);
  await page.locator("#loginSubmitBtn").click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 15_000 });
}

async function visitRoutes(page, routes) {
  const timings = [];
  for (const route of routes) {
    const started = performance.now();
    await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
    await page.locator("body").waitFor({ state: "visible" });
    const state = await page.evaluate(() => ({
      textLength: (document.body.innerText || "").trim().length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      metrics: window.__kisAuditMetrics || { cls: 0, longTasks: 0 },
      routeEntry: document.body.dataset.routeEntry || "",
    }));
    expect(state.textLength, `${route} rendered blank`).toBeGreaterThan(20);
    expect(state.overflow, `${route} has horizontal overflow`).toBeLessThanOrEqual(2);
    timings.push({ route, durationMs: Math.round(performance.now() - started), ...state });
  }
  return timings;
}

async function api(page, path, options = {}) {
  return page.evaluate(async ({ path, options }) => {
    const response = await fetch(path, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text.slice(0, 200); }
    return { status: response.status, body };
  }, { path, options });
}

function finishRole(role, capture, timings, extra = {}) {
  const duplicates = Object.entries(Object.groupBy(capture.apiRequests, (request) => request))
    .filter(([, requests]) => requests.length > 1)
    .map(([request, requests]) => ({ request, count: requests.length }));
  const abortedRequests = capture.failedRequests.filter((item) => item.error === "net::ERR_ABORTED");
  const unexpectedFailedRequests = capture.failedRequests.filter((item) => item.error !== "net::ERR_ABORTED");
  audit.roles[role] = {
    status: capture.pageErrors.length || unexpectedFailedRequests.length ? "fail" : "pass",
    timings,
    consoleMessages: capture.consoleMessages,
    pageErrors: capture.pageErrors,
    failedRequests: capture.failedRequests,
    abortedRequests,
    unexpectedFailedRequests,
    httpErrors: capture.responses,
    duplicateRequests: duplicates,
    ...extra,
  };
}

test.describe.serial("clean-room autonomous role audit", () => {
  test("HR workflows, security boundaries, multi-tab and responsive shell", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.101" }, recordVideo: { dir: artifactDir } });
    const page = await context.newPage();
    await enablePerformanceObservers(page);
    const capture = installInstrumentation(page);
    await login(page, runtime.identities.hrB);
    hrStorageState = await context.storageState();
    const timings = await visitRoutes(page, ["/hr", "/hr/employees", "/hr/courses", "/hr/assign", "/hr/reports", "/hr/notifications", "/hr/audit-log"]);
    const employeeList = await api(page, "/api/employees?page=1&pageSize=20");
    expect(employeeList.status).toBe(200);
    const auditList = await api(page, "/api/admin/audit-logs?page=1&pageSize=20");
    expect(auditList.status).toBe(200);
    const courseId = `clean-room-course-${Date.now()}`;
    const created = await api(page, "/api/courses", { method: "POST", body: JSON.stringify({ id: courseId, status: "draft", deliveryMode: "online", data: { title: "Synthetic clean-room course" } }) });
    expect([200, 201]).toContain(created.status);
    const duplicate = await api(page, "/api/courses", { method: "POST", body: JSON.stringify({ id: courseId, status: "draft", deliveryMode: "online", data: { title: "Synthetic clean-room course" } }) });
    expect([200, 201, 409, 422]).toContain(duplicate.status);
    const coursesAfterDuplicate = await api(page, "/api/courses");
    expect((Array.isArray(coursesAfterDuplicate.body) ? coursesAfterDuplicate.body : []).filter((course) => course.id === courseId)).toHaveLength(1);
    const deleted = await api(page, `/api/courses?id=${encodeURIComponent(courseId)}&force=true`, { method: "DELETE" });
    expect(deleted.status).toBe(200);
    const secondPage = await context.newPage();
    await secondPage.goto(`${baseURL}/hr/courses`, { waitUntil: "domcontentloaded" });
    await expect(secondPage.locator("body")).toBeVisible();
    await page.screenshot({ path: `${artifactDir}/hr-1440x900.png`, fullPage: true });
    finishRole("hr", capture, timings, { createDuplicateDeleteCourse: "pass", multiTab: "pass" });
    await context.close();
  });

  test("Employee A learning routes and direct HR API denial", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.102" }, recordVideo: { dir: artifactDir } });
    const page = await context.newPage();
    await enablePerformanceObservers(page);
    const capture = installInstrumentation(page);
    await login(page, runtime.identities.employeeA);
    const timings = await visitRoutes(page, ["/dashboard", "/dashboard/courses", "/dashboard/quizzes", "/dashboard/learning-history", "/dashboard/notifications", "/account/security"]);
    const adminApi = await api(page, "/api/employees?page=1&pageSize=20");
    expect(adminApi.status).toBe(403);
    await page.goto(`${baseURL}/hr`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((url) => url.pathname !== "/hr", { timeout: 10_000 });
    expect(new URL(page.url()).pathname).not.toBe("/hr");
    const otherUser = await api(page, `/api/notifications?accountId=${encodeURIComponent(runtime.identities.employeeB.id)}`);
    expect(otherUser.status).toBe(403);
    await page.screenshot({ path: `${artifactDir}/employee-390x844.png`, fullPage: true });
    finishRole("employee", capture, timings, { adminApiDenied: true, crossUserDenied: true });
    await context.close();
  });

  test("HR scoped administration and responsive layouts", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.103" }, recordVideo: { dir: artifactDir } });
    const page = await context.newPage();
    await enablePerformanceObservers(page);
    const capture = installInstrumentation(page);
    await login(page, runtime.identities.hrA);
    const timings = await visitRoutes(page, ["/hr", "/hr/employees", "/hr/assign", "/hr/training-tracking", "/hr/reports"]);
    expect((await api(page, "/api/employees?page=1&pageSize=20")).status).toBe(200);
    await page.screenshot({ path: `${artifactDir}/hr-1024x768.png`, fullPage: true });
    finishRole("hrSecondary", capture, timings, { scopedEmployeeList: true });
    await context.close();
  });

  test("Legacy and unknown roles fail closed without a workspace", async ({ browser }) => {
    const results = {};
    for (const invalidRole of ["admin", "trainer", "unknown", null]) {
      const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.104" }, recordVideo: { dir: artifactDir } });
      const page = await context.newPage();
      await enablePerformanceObservers(page);
      await page.route("**/api/auth?action=session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, account: { id: "legacy-role", role: invalidRole } }) }));
      await page.goto(`${baseURL}/hr`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 10_000 });
      results[String(invalidRole)] = "denied";
      await context.close();
    }
    audit.roles.invalidLegacyRole = {
      status: "pass",
      results,
      workspaceStatus: "none",
      pageErrors: [],
      unexpectedFailedRequests: [],
      httpErrors: [],
    };
  });

  test("remaining viewport checks and evidence write", async ({ browser }) => {
    for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }]) {
      const context = await browser.newContext({ viewport, storageState: hrStorageState, extraHTTPHeaders: { "CF-Connecting-IP": "198.51.100.101" } });
      const page = await context.newPage();
      await page.goto(`${baseURL}/hr/courses`, { waitUntil: "domcontentloaded" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      audit.viewports.push({ ...viewport, route: "/hr/courses", overflow, status: overflow <= 2 ? "pass" : "fail" });
      await page.screenshot({ path: `${artifactDir}/hr-courses-${viewport.width}x${viewport.height}.png`, fullPage: true });
      await context.close();
    }
    const visualDefects = Object.values(audit.roles).flatMap((role) => [
      ...role.pageErrors.map((text) => ({ type: "pageerror", text })),
      ...role.unexpectedFailedRequests.map((item) => ({ type: "network", ...item })),
      ...role.httpErrors.filter((item) => ![403].includes(item.status)).map((item) => ({ type: "http", ...item })),
    ]);
    audit.findings = visualDefects;
    writeFileSync(evidencePath, `${JSON.stringify(audit, null, 2)}\n`);
    expect(audit.viewports.every((viewport) => viewport.status === "pass")).toBe(true);
  });
});
