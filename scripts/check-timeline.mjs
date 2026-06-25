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
  const res = await page.evaluate((isMobile) => {
    const items = [...document.querySelectorAll(".tl-story__item")];
    const track = document.querySelector(".tl-story__track").getBoundingClientRect();
    const lineX = isMobile ? -1 : track.left + track.width / 2;
    let blockComplete = 0, blockOnOneSide = 0, img2020Top = 0, yearWithBlock = 0, overflow = 0;
    items.forEach((it) => {
      const block = it.querySelector(".tl-story__block");
      const year = it.querySelector(".tl-story__year");
      const media = it.querySelector(".tl-story__media");
      const card = it.querySelector(".tl-story__card");
      // block cohesive: year, media, card all present and stacked
      if (block && year && media && card) blockComplete++;
      // year within block horizontal span
      const br = block.getBoundingClientRect();
      const yr = year.getBoundingClientRect();
      if (yr.left >= br.left - 4 && yr.right <= br.right + 4) yearWithBlock++;
      if (!isMobile) {
        // block must be entirely on one side of the axis
        const isLeft = it.classList.contains("tl-story__item--left");
        if (isLeft && br.right <= lineX + 2) blockOnOneSide++;
        if (!isLeft && br.left >= lineX - 2) blockOnOneSide++;
      }
    });
    const img2020 = document.querySelector('.tl-story__item[data-timeline-year="2020"] .tl-story__media img');
    if (img2020 && /0%$/.test(getComputedStyle(img2020).objectPosition)) img2020Top++;
    overflow = document.documentElement.scrollWidth - window.innerWidth;
    return { count: items.length, blockComplete, blockOnOneSide, yearWithBlock, img2020Top, overflow };
  }, isMobile);

  await page.screenshot({ path: `test-results/timeline-${label}.png` });
  console.log(`[${label}]`, JSON.stringify(res), "errors:", errors.length);
  if (res.count !== 7) { console.log("  FAIL: not 7"); failed++; }
  if (res.blockComplete !== 7) { console.log("  FAIL: blocks incomplete:", res.blockComplete); failed++; }
  if (!isMobile && res.blockOnOneSide !== 7) { console.log("  FAIL: blocks cross axis:", res.blockOnOneSide); failed++; }
  if (res.yearWithBlock !== 7) { console.log("  FAIL: year not within block:", res.yearWithBlock); failed++; }
  if (res.img2020Top !== 1) { console.log("  FAIL: 2020 img not top-anchored"); failed++; }
  if (res.overflow > 2) { console.log("  FAIL: overflow:", res.overflow); failed++; }
  if (errors.length) { console.log("  FAIL: console errors:", errors.slice(0,3)); failed++; }
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
