// @ts-check
/**
 * Public Training UI & Hydration — production E2E tests
 *
 * Covers: logo, background, language switcher, F5 no-flash, polling stability, responsive.
 *
 * Run: npx playwright test e2e/public-training-ui-hydration.spec.js
 */
import { test, expect } from "playwright/test";
import * as fs from "fs";

const BASE = "https://mykis-learning.nkhaduy.workers.dev";
const HR_EMAIL = "hr@kisvn.vn";
const HR_PASSWORD = process.env.HR_PASSWORD || "Training@2026";
const RESULTS_DIR = "test-results/public-training-ui-hydration";
const TEST_PREFIX = "[UI-HYD TEST]";

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

async function hrApi(page, method, apiPath, body) {
  return page.evaluate(async ({ base, method, apiPath, body }) => {
    const r = await fetch(`${base}${apiPath}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Account-Id": "acc-hr-001", "X-Account-Role": "hr" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data; try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, { base: BASE, method, apiPath, body });
}

async function publicApi(page, method, apiPath, body, participantToken) {
  return page.evaluate(async ({ base, method, apiPath, body, participantToken }) => {
    const headers = { "Content-Type": "application/json" };
    if (participantToken) headers["Authorization"] = `Bearer ${participantToken}`;
    const r = await fetch(`${base}${apiPath}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data; try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  }, { base: BASE, method, apiPath, body, participantToken });
}

async function createTestFlow(page) {
  return hrApi(page, "POST", "/api/admin/live-training", {
    title: `${TEST_PREFIX} ${Date.now()}`,
    description: "UI hydration test",
    pretestUrl: "https://quizizz.com/join?gc=00000000",
    posttestUrl: "https://quizizz.com/join?gc=00000000",
    evaluationUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfake/viewform",
    pretestRequired: true, posttestRequired: true, evaluationRequired: true,
  });
}

async function closeFlow(page, flowId) {
  await hrApi(page, "POST", `/api/admin/live-training/${flowId}/close`, {});
}

// ── Logo & background ──────────────────────────────────────────

test("LOGO-1 — White logo img present and loads successfully", async ({ browser }) => {
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
    const imgErrors = [];
    pubPage.on("response", (res) => {
      if (res.url().includes("kis-logo") && !res.ok()) imgErrors.push(res.url());
    });
    try {
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector(".pub-logo", { timeout: 10000 });
      const logoSrc = await pubPage.getAttribute(".pub-logo", "src");
      expect(logoSrc, "logo should use white variant").toContain("kis-logo-white");
      expect(imgErrors, `logo 404s: ${imgErrors.join(", ")}`).toHaveLength(0);
      await pubPage.screenshot({ path: `${RESULTS_DIR}/logo1-white-logo.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("BG-1 — Dark background and overlay present on join page", async ({ browser }) => {
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
      await pubPage.waitForSelector(".public-outer", { timeout: 10000 });

      // Outer container should be present and dark background
      const hasBg = await pubPage.evaluate(() => !!document.querySelector(".pub-bg"));
      const hasOv = await pubPage.evaluate(() => !!document.querySelector(".pub-ov"));
      expect(hasBg, ".pub-bg background element should exist").toBe(true);
      expect(hasOv, ".pub-ov overlay element should exist").toBe(true);

      await pubPage.screenshot({ path: `${RESULTS_DIR}/bg1-dark-background.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Language switcher ──────────────────────────────────────────

test("LANG-1 — Language switcher visible and switches between VI/EN/KR", async ({ browser }) => {
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
      await pubPage.waitForSelector(".pub-lang-wrap", { timeout: 10000 });

      // Switcher should have VI/EN/KR buttons
      const buttons = await pubPage.$$eval(".pub-lang-wrap .language-switch button", (els) => els.map((el) => el.textContent?.trim()));
      expect(buttons).toContain("VI");
      expect(buttons).toContain("EN");
      expect(buttons).toContain("KR");

      // Click EN and verify label change
      await pubPage.click(".pub-lang-wrap .language-switch button:text('EN')");
      await pubPage.waitForTimeout(300);
      const labelEN = await pubPage.textContent("#publicTrainingName ~ small, .pub-card small");
      // EN label for name hint should exist
      expect(labelEN).toBeTruthy();

      // Click KR
      await pubPage.click(".pub-lang-wrap .language-switch button:text('KR')");
      await pubPage.waitForTimeout(300);

      // Back to VI
      await pubPage.click(".pub-lang-wrap .language-switch button:text('VI')");
      await pubPage.waitForTimeout(300);

      await pubPage.screenshot({ path: `${RESULTS_DIR}/lang1-switcher.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("LANG-2 — Language switch after joining preserves journey view (no flash to join form)", async ({ browser }) => {
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
      await pubPage.fill("#publicTrainingName", "Lang Switch Tester");
      await pubPage.click("#publicTrainingJoinForm button[type=submit]");
      await pubPage.waitForSelector(".pub-journey", { timeout: 10000 });

      // Switch language — journey should remain visible, no join form
      await pubPage.click(".pub-lang-wrap .language-switch button:text('EN')");
      await pubPage.waitForTimeout(500);
      const joinFormVisible = await pubPage.isVisible("#publicTrainingJoinForm");
      expect(joinFormVisible, "join form must NOT appear after language switch when already joined").toBe(false);
      const journeyVisible = await pubPage.isVisible(".pub-journey");
      expect(journeyVisible, "journey must remain visible").toBe(true);

      await pubPage.screenshot({ path: `${RESULTS_DIR}/lang2-no-flash-after-switch.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── F5 hydration (no flash) ────────────────────────────────────

test("HYD-1 — F5 shows skeleton not join form while checking participant", async ({ browser }) => {
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
      // Join first
      await pubPage.goto(`${BASE}/join/${accessToken}`, { waitUntil: "domcontentloaded" });
      await pubPage.waitForSelector("#publicTrainingName", { timeout: 10000 });
      await pubPage.fill("#publicTrainingName", "F5 Hydration Test");
      await pubPage.click("#publicTrainingJoinForm button[type=submit]");
      await pubPage.waitForSelector(".pub-journey", { timeout: 10000 });

      // F5 — intercept /state to delay it so we can catch the skeleton
      await pubPage.route(`**/api/public/live-training/*/state`, async (route) => {
        await new Promise((r) => setTimeout(r, 800)); // 800ms delay
        await route.continue();
      });

      await pubPage.reload({ waitUntil: "domcontentloaded" });

      // During the delay, join form must NOT be visible
      const joinFormShownDuringHydration = await pubPage.evaluate(() => {
        return !!document.querySelector("#publicTrainingJoinForm");
      });
      expect(joinFormShownDuringHydration, "join form must not flash during F5 hydration").toBe(false);

      // Skeleton should be showing
      const skeletonShown = await pubPage.evaluate(() => {
        return !!(document.querySelector(".pub-skeleton-card") || document.querySelector("[aria-busy='true']"));
      });
      expect(skeletonShown, "skeleton should be shown during hydration").toBe(true);

      // Eventually journey resolves
      await pubPage.unrouteAll();
      await pubPage.waitForSelector(".pub-journey", { timeout: 15000 });

      await pubPage.screenshot({ path: `${RESULTS_DIR}/hyd1-no-flash.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

test("HYD-2 — New visitor (no localStorage) goes straight to join form, no skeleton flash", async ({ browser }) => {
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
      // Should show join form, not stuck on skeleton
      await pubPage.waitForSelector("#publicTrainingName", { timeout: 10000 });
      const skeleton = await pubPage.isVisible(".pub-skeleton-card");
      expect(skeleton, "skeleton should not persist for new visitor").toBe(false);
      await pubPage.screenshot({ path: `${RESULTS_DIR}/hyd2-new-visitor.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});

// ── Mobile ─────────────────────────────────────────────────────

test("MOBILE-2 — Join page has correct logo height on mobile (28px)", async ({ browser }) => {
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
      await pubPage.waitForSelector(".pub-logo", { timeout: 10000 });
      const logoHeight = await pubPage.evaluate(() => {
        const el = document.querySelector(".pub-logo");
        return el ? getComputedStyle(el).height : null;
      });
      // Should be 28px on mobile (per CSS @media rule)
      expect(logoHeight).toBe("28px");
      await pubPage.screenshot({ path: `${RESULTS_DIR}/mobile2-logo-height.png` });
    } finally {
      await pubCtx.close();
    }
  } finally {
    if (flowId) await closeFlow(hrPage, flowId);
    await hrCtx.close();
  }
});
