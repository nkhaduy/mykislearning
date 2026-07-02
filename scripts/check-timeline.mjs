import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";

const URL = "https://mykis-learning.nkhaduy.workers.dev/about-kis";
mkdirSync("test-results", { recursive: true });

const browser = await chromium.launch();
let failed = 0;

async function check(viewport, label) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.locator("#kis-history").scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    const el = document.querySelector("#kis-history");
    el.scrollIntoView({ behavior: "instant", block: "start" });
    await new Promise((r) => setTimeout(r, 200));
    const bottom = el.getBoundingClientRect().bottom + window.scrollY;
    const step = window.innerHeight * 0.6;
    for (let y = window.scrollY; y < bottom; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
  await page.locator("#kis-history").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const isMobile = viewport.width <= 767;
  let res = await page.evaluate(() => {
    const years = [...document.querySelectorAll(".timeline-carousel__year")];
    const content = document.querySelector(".timeline-carousel__content");
    const header = document.querySelector(".timeline-carousel__header");
    const yearNav = document.querySelector(".timeline-carousel__years");
    const image = document.querySelector(".timeline-carousel__image");
    const yearBig = document.querySelector(".timeline-carousel__year-big");
    const events = document.querySelector(".timeline-carousel__events");
    const watermark = document.querySelector(".timeline-carousel__watermark");
    const prevBtn = document.querySelector(".timeline-carousel__btn--prev");
    const nextBtn = document.querySelector(".timeline-carousel__btn--next");
    let checks = 0;
    if (years.length === 7) checks++;
    if (content) checks++;
    if (header) checks++;
    if (yearNav) checks++;
    if (image) checks++;
    if (yearBig) checks++;
    if (events) checks++;
    if (watermark) checks++;
    if (prevBtn) checks++;
    if (nextBtn) checks++;
    const activeYear = document.querySelector(".timeline-carousel__year.is-active");
    if (activeYear) checks++;
    const firstDisabled = prevBtn?.disabled;
    const lastDisabled = nextBtn?.disabled;
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    return { count: years.length, checks, firstDisabled, lastDisabled, overflow };
  });

  await page.screenshot({ path: `test-results/timeline-${label}.png` });
  console.log(`[${label}]`, JSON.stringify(res), "errors:", errors.length);
  if (res.count !== 7) { console.log("  FAIL: not 7 years, got", res.count); failed++; }
  if (res.checks < 10) { console.log("  FAIL: missing elements, checks:", res.checks); failed++; }
  if (res.firstDisabled !== false) { console.log("  FAIL: prev should be enabled (starting at last year)"); failed++; }
  if (res.lastDisabled !== true) { console.log("  FAIL: next should be disabled (starting at last year)"); failed++; }
  if (res.overflow > 2) { console.log("  FAIL: overflow:", res.overflow); failed++; }
  if (errors.length) { console.log("  FAIL: console errors:", errors.slice(0,3)); failed++; }

  // Navigate to year 2020 and verify object-position
  const btn2020 = page.locator('[data-timeline-year="2020"]');
  if (await btn2020.count() === 1) {
    await btn2020.click();
    await page.waitForTimeout(600);
    const img2020 = await page.evaluate(() => {
      const img = document.querySelector('.timeline-carousel__image[data-year="2020"] img');
      if (!img) return "no-img";
      return getComputedStyle(img).objectPosition;
    });
    if (!/0%$/.test(img2020)) {
      console.log(`  FAIL: 2020 img not top-anchored (got: ${img2020})`);
      failed++;
    }
  } else {
    console.log("  FAIL: 2020 year button not found");
    failed++;
  }
  await page.close();
}

await check({ width: 1440, height: 900 }, "desktop-1440");
await check({ width: 1280, height: 900 }, "laptop-1280");
await check({ width: 768, height: 1024 }, "tablet-768");
await check({ width: 390, height: 844 }, "mobile-390");
await check({ width: 430, height: 932 }, "mobile-430");

await browser.close();
console.log(failed === 0 ? "ALL PASS" : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
