import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(new URL("..", import.meta.url).pathname);
const managedPort = 4183;
const baseURL = process.env.BUNDLE_BASE_URL || `http://127.0.0.1:${managedPort}`;
const evidencePath = resolve(root, process.env.BUNDLE_EVIDENCE_PATH || "docs/audit-remediation/evidence/route-bundles.json");
const target = new URL(baseURL);
if (!["127.0.0.1", "localhost"].includes(target.hostname)) {
  throw new Error(`Refusing route bundle measurement against non-local target: ${target.hostname}`);
}

const routes = [
  { route: "/", role: "public" },
  { route: "/login", role: "public" },
  { route: "/about-kis", role: "public" },
  { route: "/dashboard", role: "employee" },
  { route: "/dashboard/courses", role: "employee" },
  { route: "/dashboard/courses/course-a", role: "employee" },
  { route: "/hr", role: "hr" },
  { route: "/hr/employees", role: "hr" },
  { route: "/hr/courses", role: "hr" },
  { route: "/hr/reports", role: "hr" },
  { route: "/hr/live-training", role: "hr" },
  { route: "/hr/quizzes", role: "hr" },
  { route: "/dashboard/quizzes", role: "employee" },
  { route: "/hr/learning-records", role: "hr" },
  { route: "/dashboard/certificates", role: "employee" },
  { route: "/attendance/scan", role: "employee" },
  { route: "/training", role: "public" },
  { route: "/join/synthetic-token", role: "public" },
  ...[
    "/dashboard/learning-paths", "/dashboard/learning-paths/path-a", "/dashboard/gallery", "/dashboard/gallery/album-a",
    "/dashboard/resources", "/dashboard/calendar", "/dashboard/learning-history", "/dashboard/history", "/dashboard/compliance",
    "/dashboard/compliance/cycle-a", "/dashboard/skills", "/dashboard/development-plan", "/dashboard/development-plan/plan-a", "/dashboard/notifications",
  ].map((route) => ({ route, role: "employee" })),
  ...[
    "/hr/assign", "/hr/learning-paths", "/hr/learning-paths/path-a", "/hr/sessions", "/hr/training-tracking",
    "/hr/cchn-registrations", "/hr/accounts", "/hr/competencies", "/hr/skills-matrix", "/hr/development-plans",
    "/hr/retraining", "/hr/compliance", "/hr/compliance/cycles/cycle-a", "/hr/certificates", "/hr/certifications",
    "/hr/gallery", "/hr/notifications", "/hr/audit-log",
  ].map((route) => ({ route, role: "hr" })),
];

const syntheticIds = {
  employee: "11111111-1111-4111-8111-111111111111",
  hr: "44444444-4444-4444-8444-444444444444",
  admin: "55555555-5555-4555-8555-555555555555",
};

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function routePayload(pathname) {
  if (pathname === "/api/courses") return [{ id: "course-a", title: "Synthetic Course", status: "published" }];
  if (pathname === "/api/enrollments") return [{ id: "enrollment-a", courseId: "course-a", status: "inProgress", progressPercent: 45, deadline: "2026-08-15" }];
  if (pathname === "/api/notifications") return [];
  if (pathname === "/api/admin/overview") return { totalEmployees: 10000, visitedToday: 700, onlineNow: 40, learningNow: 20, pendingActions: 0, activeCourseCount: 30, completionRate: 82, tasks: [], onlineLearning: [], inactiveEmployeeRows: [], upcomingSessions: [] };
  if (pathname === "/api/admin/reports/overview") return { metrics: { totalEmployees: 10000, activeLearners: 6000, openCourses: 30, completionRate: 82, onTimeCompletionRate: 76, overdueLearners: 100 }, departmentComparison: [], priorityExceptions: [] };
  if (pathname === "/api/admin/live-training") return { flows: [] };
  if (pathname === "/api/employees") return { items: [], pageSize: 50, hasMore: false, nextCursor: null };
  return [];
}

async function configureSyntheticNetwork(page, role) {
  if (role !== "public") {
    await page.route("**/api/**", (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith("/api/")) return route.continue();
      return route.fulfill({ status: 200, json: routePayload(url.pathname) });
    });
    await page.route("**/api/auth?action=session*", (route) => route.fulfill({
      status: 200,
      json: { authenticated: true, account: { id: syntheticIds[role], role }, expires_at: Math.floor(Date.now() / 1000) + 3600 },
    }));
  }
}

async function measure(browser, definition) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await configureSyntheticNetwork(page, definition.role);
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(`${baseURL}${definition.route}`, { waitUntil: "domcontentloaded" });
  if (definition.role === "public") {
    await page.locator("#app").waitFor({ state: "attached" });
  } else {
    await page.waitForFunction(() => {
      return Boolean(document.body?.dataset.routeEntry || document.querySelector("#app"));
    });
  }
  await page.waitForTimeout(500);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((rawEntry) => {
    const entry = /** @type {PerformanceResourceTiming} */ (rawEntry);
    return {
      path: new URL(entry.name).pathname,
      initiatorType: entry.initiatorType,
      encodedBodySize: entry.encodedBodySize || 0,
      transferSize: entry.transferSize || 0,
    };
  }).filter((entry) => ["script", "link"].includes(entry.initiatorType) || /\.js$|\.css$/.test(entry.path)));
  const scripts = resources.filter((entry) => /\.js$/.test(entry.path));
  const styles = resources.filter((entry) => /\.css$/.test(entry.path));
  const result = {
    route: definition.route,
    role: definition.role,
    entry: await page.evaluate(() => {
      return document.body?.dataset.routeEntry || "public";
    }),
    initialJsBytes: scripts.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    initialCssBytes: styles.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    requestCount: new Set(requests).size,
    scripts: scripts.map((entry) => entry.path),
    styles: styles.map((entry) => entry.path),
    xlsxLoaded: requests.includes("/vendor/xlsx.full.min.js"),
    qrLoaded: requests.some((path) => ["/vendor/jsqr.min.js", "/vendor/qrcode.min.js", "/vendor/qrcode.browser.js"].includes(path)),
    monolithLoaded: requests.includes("/app.js"),
    adminCodeLoaded: requests.some((path) => path === "/app.js" || path.startsWith("/src/features/admin/") || path.startsWith("/src/features/employees/") || path.startsWith("/src/features/reporting/")),
  };
  await context.close();
  return result;
}

let server = null;
try {
  if (!process.env.BUNDLE_BASE_URL) {
    server = spawn(process.execPath, [resolve(root, "scripts/spa-fallback-server.mjs")], {
      cwd: root,
      env: { ...process.env, PORT: String(managedPort) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForServer(baseURL);
  }
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const results = [];
  for (const definition of routes) results.push(await measure(browser, definition));
  await browser.close();
  const evidence = {
    generatedAt: new Date().toISOString(),
    environment: { baseURL, viewport: "390x844", browser: "Chrome", data: "synthetic route interception" },
    findings: ["PERF-005", "UX-001"],
    results,
  };
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Route bundle evidence written to ${evidencePath}`);
  for (const result of results) {
    console.log(`${result.route}: JS ${result.initialJsBytes} B, CSS ${result.initialCssBytes} B, monolith=${result.monolithLoaded}, xlsx=${result.xlsxLoaded}, qr=${result.qrLoaded}`);
  }
} finally {
  server?.kill("SIGTERM");
}
