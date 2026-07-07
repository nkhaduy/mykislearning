// @ts-check
/**
 * Public Training External Links — production E2E tests
 *
 * Migration 20260707092048_public_training_external_links.sql MUST be applied before running.
 * These tests exercise real DB persistence via the production Worker + Supabase.
 *
 * Run: npx playwright test e2e/public-training-external-links.spec.js
 */
import { test, expect } from "playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const HR_PASSWORD = process.env.HR_PASSWORD || "Training@2026";
const RESULTS_DIR = "test-results/public-training-external-links";
const TEST_PREFIX = "[LIVE TRAINING TEST]";
const QUIZIZZ_URL = "https://quizizz.com/join?gc=00000000";
const FORMS_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfake/viewform";

// ── helpers ────────────────────────────────────────────────────

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

async function loginAs(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click("#loginSubmitBtn");
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15000 });
}

async function hrApi(page, method, path, body) {
  return page.evaluate(async ({ base, method, path, body }) => {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Account-Id": "acc-hr-001",
        "X-Account-Role": "hr",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, { base: BASE, method, path, body });
}

async function publicApi(page, method, apiPath, body, participantToken) {
  return page.evaluate(async ({ base, method, apiPath, body, participantToken }) => {
    const headers = { "Content-Type": "application/json" };
    if (participantToken) headers["Authorization"] = `Bearer ${participantToken}`;
    const r = await fetch(`${base}${apiPath}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, { base: BASE, method, apiPath, body, participantToken });
}

async function createTestFlow(page, overrides = {}) {
  const res = await hrApi(page, "POST", "/api/admin/live-training", {
    title: `${TEST_PREFIX} ${Date.now()}`,
    description: "Automated test flow",
    pretestUrl: QUIZIZZ_URL,
    posttestUrl: QUIZIZZ_URL,
    evaluationUrl: FORMS_URL,
    pretestRequired: true,
    posttestRequired: true,
    evaluationRequired: true,
    ...overrides,
  });
  return res;
}

async function closeFlow(page, flowId) {
  await hrApi(page, "POST", `/api/admin/live-training/${flowId}/close`, {});
}

// ── HR: list, create, detail ────────────────────────────────

test("HR-1 — HR login shows Hành trình buổi học menu item", async ({ browser }) => {
  ensureResultsDir();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  try {
    await loginAs(page, HR_EMAIL, HR_PASSWORD);
    await page.goto(`${BASE}/admin/live-training`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-layout", { timeout: 8000 });
    const menuText = await page.content();
    expect(menuText).toContain("Hành trình buổi học");
    expect(errs, `JS errors: ${errs.join(", ")}`).toHaveLength(0);
    await page.screenshot({ path: `${RESULTS_DIR}/hr1-list.png` });
  } finally {
    await ctx.close();
  }
});

test("HR-2 — HR can create a flow and see detail page", async ({ browser }) => {
  ensureResultsDir();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let flowId;
  try {
    await loginAs(page, HR_EMAIL, HR_PASSWORD);
    const res = await createTestFlow(page);
    expect([200, 201], JSON.stringify(res.data)).toContain(res.status);
    expect(res.data.ok).toBe(true);
    flowId = res.data.flow?.id;
    expect(flowId).toBeTruthy();
    const pubLink = res.data.flow?.publicLink;
    expect(pubLink).toContain("/join/");

    await page.goto(`${BASE}/admin/live-training/${flowId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".app-layout", { timeout: 8000 });
    const content = await page.content();
    expect(content).toContain(TEST_PREFIX);
    await page.screenshot({ path: `${RESULTS_DIR}/hr2-detail.png` });
  } finally {
    if (flowId) await closeFlow(page, flowId);
    await ctx.close();
  }
});

test("HR-3 — HR can update URLs and toggle step states", async ({ browser }) => {
  ensureResultsDir();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let flowId;
  try {
    await loginAs(page, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(page);
    flowId = create.data.flow.id;

    // Update URL
    const update = await hrApi(page, "PATCH", `/api/admin/live-training/${flowId}`, {
      pretestUrl: "https://quizizz.com/join?gc=11111111",
    });
    expect(update.status).toBe(200);
    expect(update.data.flow.pretest_url).toBe("https://quizizz.com/join?gc=11111111");

    // Open pretest
    const open = await hrApi(page, "PATCH", `/api/admin/live-training/${flowId}/steps/pretest`, { state: "open" });
    expect(open.status).toBe(200);
    expect(open.data.flow.pretest_state).toBe("open");

    // Close pretest
    const close = await hrApi(page, "PATCH", `/api/admin/live-training/${flowId}/steps/pretest`, { state: "closed" });
    expect(close.status).toBe(200);
    expect(close.data.flow.pretest_state).toBe("closed");
  } finally {
    if (flowId) await closeFlow(page, flowId);
    await ctx.close();
  }
});

// ── Public access ────────────────────────────────────────────

test("PUB-1 — /join/:token does not render app navigation or dashboard shell", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    // Open public page in fresh context (no session)
    const pubCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pubPage = await pubCtx.newPage();
    const errs = [];
    pubPage.on("pageerror", (e) => errs.push(String(e)));
    try {
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector(".public-training", { timeout: 10000 });
      const html = await pubPage.content();
      expect(html).not.toContain("sidebar");
      expect(html).not.toContain("topbar");
      expect(html).not.toContain("data-link");
      expect(errs, `JS errors: ${errs.join(", ")}`).toHaveLength(0);
      await pubPage.screenshot({ path: `${RESULTS_DIR}/pub1-no-nav.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("PUB-2 — Invalid access token returns 404 / error state", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    const res = await publicApi(page, "GET", "/api/public/live-training/INVALID_TOKEN_XYZ_99999", undefined, null);
    expect(res.status).toBe(404);
  } finally {
    await ctx.close();
  }
});

test("PUB-3 — Closed flow rejects new participant join", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;
    await closeFlow(hrPage, flowId);
    flowId = null; // already closed, no need to clean up again

    const pubCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pubPage = await pubCtx.newPage();
    try {
      const res = await publicApi(pubPage, "POST", `/api/public/live-training/${accessToken}/join`,
        { displayName: "Test User" }, null);
      expect([403, 410]).toContain(res.status);
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Participant join + persistence ────────────────────────────

test("PART-1 — Join creates participant and F5 restores progress via localStorage", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pubPage = await pubCtx.newPage();
    try {
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector(".public-training", { timeout: 10000 });

      // Join
      await pubPage.fill("#publicTrainingName", "Nguyễn Văn An Test");
      await pubPage.click("#publicTrainingJoinForm button[type=submit]");
      await pubPage.waitForSelector(".public-training-shell", { timeout: 10000 });

      // Verify localStorage was set
      const stored = await pubPage.evaluate((flowId) => {
        return localStorage.getItem(`mykis.publicTraining.${flowId}`);
      }, flowId);
      expect(stored, "participantToken should be in localStorage").toBeTruthy();

      // F5
      await pubPage.reload({ waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector(".public-training-shell", { timeout: 10000 });
      const nameAfterReload = await pubPage.textContent(".public-training-shell header strong");
      expect(nameAfterReload?.trim()).toBe("Nguyễn Văn An Test");

      await pubPage.screenshot({ path: `${RESULTS_DIR}/part1-f5-restored.png` });

      // Verify no duplicate on second join with same name
      const join2 = await publicApi(pubPage, "POST", `/api/public/live-training/${accessToken}/join`,
        { displayName: "Nguyễn Văn An Test" }, null);
      expect(join2.status).toBe(200);
      expect(join2.data.participant?.id, "participant id should be stable").toBeTruthy();

      // Check participants
      const pList = await hrApi(hrPage, "GET", `/api/admin/live-training/${flowId}/participants`);
      const names = (pList.data?.participants || []).map((p) => p.displayName);
      const matchCount = names.filter((n) => n === "Nguyễn Văn An Test").length;
      expect(matchCount, "only one participant per name").toBe(1);
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("PART-2 — Re-enter name after clearing localStorage recovers progress", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    // Open pretest so we can start it and generate some progress
    await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/steps/pretest`, { state: "open" });

    const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pubPage = await pubCtx.newPage();
    try {
      // Join
      const join = await publicApi(pubPage, "POST", `/api/public/live-training/${accessToken}/join`,
        { displayName: "Trần Thị Bình Test" }, null);
      expect(join.status).toBe(200);
      const originalToken = join.data.participantToken;
      const participantId = join.data.participant?.id;

      // Start pretest to generate progress
      const start = await publicApi(pubPage, "POST", `/api/public/live-training/${accessToken}/steps/pretest/start`,
        {}, originalToken);
      expect(start.status).toBe(200);

      // Clear localStorage and re-join with same name
      const join2 = await publicApi(pubPage, "POST", `/api/public/live-training/${accessToken}/join`,
        { displayName: "Trần Thị Bình Test" }, null);
      expect(join2.status).toBe(200);
      // Same participant id
      expect(join2.data.participant?.id).toBe(participantId);
      // Progress preserved
      expect(join2.data.participant?.pretestStartedAt, "pretestStartedAt should be preserved").toBeTruthy();
      // New token rotated (different from original)
      expect(join2.data.participantToken, "token should be rotated").not.toBe(originalToken);

      await pubPage.screenshot({ path: `${RESULTS_DIR}/part2-name-recovery.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Step gating ───────────────────────────────────────────────

test("STEP-1 — Closed step returns no URL and rejects start", async ({ browser }) => {
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const join = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/join`,
      { displayName: "Test Gating User" }, null);
    const token = join.data.participantToken;

    // State response should not expose URL when step is closed
    const state = await publicApi(hrPage, "GET", `/api/public/live-training/${accessToken}/state`, undefined, token);
    expect(state.data.steps?.pretest?.url, "closed step should not return url").toBeNull();

    // Start should fail (step closed)
    const start = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/pretest/start`, {}, token);
    expect(start.status).toBe(409);
    expect(start.data.error).toBe("STEP_CLOSED");
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("STEP-2 — Full pretest→posttest→evaluation→completion flow", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const join = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/join`,
      { displayName: "Test Full Flow" }, null);
    const token = join.data.participantToken;

    // Posttest blocked when pretest required and not done
    const posttestEarly = await publicApi(hrPage, "POST",
      `/api/public/live-training/${accessToken}/steps/posttest/start`, {}, token);
    expect(posttestEarly.status).toBe(409);

    // Pretest: open → start → complete
    await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/steps/pretest`, { state: "open" });
    const pStart = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/pretest/start`, {}, token);
    expect(pStart.status).toBe(200);
    expect(pStart.data.externalUrl).toBe(QUIZIZZ_URL);
    const pComplete = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/pretest/complete`, {}, token);
    expect(pComplete.status).toBe(200);
    expect(pComplete.data.participant?.pretestCompletedAt).toBeTruthy();

    // Evaluation blocked when posttest required and not done
    await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/steps/posttest`, { state: "open" });
    const evalEarly = await publicApi(hrPage, "POST",
      `/api/public/live-training/${accessToken}/steps/evaluation/start`, {}, token);
    expect(evalEarly.status).toBe(409);

    // Posttest: start → complete
    const ptStart = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/posttest/start`, {}, token);
    expect(ptStart.status).toBe(200);
    const ptComplete = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/posttest/complete`, {}, token);
    expect(ptComplete.status).toBe(200);

    // Evaluation: open → start → complete
    await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/steps/evaluation`, { state: "open" });
    const evStart = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/evaluation/start`, {}, token);
    expect(evStart.status).toBe(200);
    expect(evStart.data.externalUrl).toBe(FORMS_URL);
    const evComplete = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/steps/evaluation/complete`, {}, token);
    expect(evComplete.status).toBe(200);

    // Completion: blocked when completion_state closed
    const compEarly = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/complete`, {}, token);
    expect(compEarly.status).toBe(409);

    // HR opens completion
    await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/steps/completion`, { state: "open" });
    const compFinal = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/complete`, {}, token);
    expect(compFinal.status).toBe(200);
    expect(compFinal.data.participant?.completedAt).toBeTruthy();

    // State after F5 still shows completed
    const stateAfter = await publicApi(hrPage, "GET", `/api/public/live-training/${accessToken}/state`, undefined, token);
    expect(stateAfter.data.participant?.completedAt).toBeTruthy();

    await hrPage.screenshot({ path: `${RESULTS_DIR}/step2-full-flow.png` });
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("STEP-3 — Completion prerequisite gate blocks if required step not done", async ({ browser }) => {
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const join = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/join`,
      { displayName: "Test Gated Completion" }, null);
    const token = join.data.participantToken;

    // Open completion without any steps done
    await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/steps/completion`, { state: "open" });

    const comp = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/complete`, {}, token);
    expect(comp.status).toBe(409);
    expect(comp.data.error).toBe("COMPLETION_NOT_ALLOWED");
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── HR participant controls ────────────────────────────────────

test("HR-PART-1 — HR can adjust participant progress", async ({ browser }) => {
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const join = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/join`,
      { displayName: "Test HR Control" }, null);
    const participantId = join.data.participant?.id;

    // HR marks pretest completed
    const patch = await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/participants/${participantId}`,
      { pretestCompleted: true });
    expect(patch.status).toBe(200);
    expect(patch.data.participant?.pretestCompletedAt).toBeTruthy();

    // HR resets participant
    const reset = await hrApi(hrPage, "PATCH", `/api/admin/live-training/${flowId}/participants/${participantId}`,
      { reset: true });
    expect(reset.status).toBe(200);
    expect(reset.data.participant?.pretestCompletedAt).toBeNull();
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Security ──────────────────────────────────────────────────

test("SEC-1 — javascript: URL is rejected by the API", async ({ browser }) => {
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const res = await hrApi(hrPage, "POST", "/api/admin/live-training", {
      title: `${TEST_PREFIX} Security Test ${Date.now()}`,
      pretestUrl: "javascript:alert(1)",
    });
    expect(res.status).toBe(400);
    expect(res.data.ok).toBe(false);
  } finally {
    await hrCtx.close();
  }
});

test("SEC-2 — Participant cannot access HR admin routes", async ({ browser }) => {
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    // Use participant token on admin endpoint
    const join = await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/join`,
      { displayName: "Test Security Participant" }, null);
    const pToken = join.data.participantToken;

    // Participant token should not work on HR endpoint
    const res = await hrPage.evaluate(async ({ base, flowId, pToken }) => {
      const r = await fetch(`${base}/api/admin/live-training/${flowId}`, {
        headers: { "Authorization": `Bearer ${pToken}` },
      });
      return { status: r.status };
    }, { base: BASE, flowId, pToken });
    expect([401, 403]).toContain(res.status);
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("SEC-3 — HTML in participant name does not cause XSS in HR participant list", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const xssName = '<img src=x onerror="window._xss=1">Hacker';
    await publicApi(hrPage, "POST", `/api/public/live-training/${accessToken}/join`, { displayName: xssName }, null);

    // Load the detail page as HR
    await hrPage.goto(`${BASE}/admin/live-training/${flowId}`, { waitUntil: "domcontentloaded" });
    await hrPage.waitForSelector(".app-layout", { timeout: 8000 });

    const xssTriggered = await hrPage.evaluate(() => !!(window)._xss);
    expect(xssTriggered, "XSS must not execute").toBe(false);

    const html = await hrPage.content();
    expect(html).not.toContain('<img src=x');
    await hrPage.screenshot({ path: `${RESULTS_DIR}/sec3-xss-safe.png` });
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Polling stability ─────────────────────────────────────────

test("POLL-1 — Polling does not remount join form name input", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pubPage = await pubCtx.newPage();
    try {
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector("#publicTrainingName", { timeout: 10000 });

      // Type a name
      await pubPage.fill("#publicTrainingName", "Polling Test Name");

      // Wait 3 seconds for polling to fire
      await pubPage.waitForTimeout(3000);

      // Name must still be there (polling must not have cleared input)
      const nameValue = await pubPage.inputValue("#publicTrainingName");
      expect(nameValue).toBe("Polling Test Name");

      await pubPage.screenshot({ path: `${RESULTS_DIR}/poll1-name-stable.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Mobile layout ─────────────────────────────────────────────

test("MOBILE-1 — Public page has no horizontal overflow on 390px", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    const pubCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pubPage = await pubCtx.newPage();
    try {
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector(".public-training", { timeout: 10000 });

      const overflow = await pubPage.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(overflow, "no horizontal overflow at 390px").toBe(false);

      await pubPage.screenshot({ path: `${RESULTS_DIR}/mobile1-no-overflow.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── i18n ──────────────────────────────────────────────────────

test("I18N-1 — No raw i18n key displayed on public or HR page (VI default)", async ({ browser }) => {
  ensureResultsDir();
  const hrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hrPage = await hrCtx.newPage();
  let flowId, accessToken;
  try {
    await loginAs(hrPage, HR_EMAIL, HR_PASSWORD);
    const create = await createTestFlow(hrPage);
    flowId = create.data.flow.id;
    accessToken = create.data.flow.access_token;

    // HR page
    await hrPage.goto(`${BASE}/admin/live-training/${flowId}`, { waitUntil: "domcontentloaded" });
    await hrPage.waitForSelector(".app-layout", { timeout: 8000 });
    const hrContent = await hrPage.textContent(".content");
    const rawKeys = ["liveTraining.", "pretestUrl", "posttestUrl", "evaluationUrl", "openStep", "closeStep", "notOpen"];
    for (const key of rawKeys) {
      expect(hrContent, `should not have raw key "${key}"`).not.toContain(`:${key}`);
    }

    // Public page
    const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pubPage = await pubCtx.newPage();
    try {
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector(".public-training", { timeout: 10000 });
      const pubContent = await pubPage.textContent(".public-training");
      for (const key of rawKeys) {
        expect(pubContent, `public page should not have raw key "${key}"`).not.toContain(`:${key}`);
      }
      await pubPage.screenshot({ path: `${RESULTS_DIR}/i18n1-no-raw-keys.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});
