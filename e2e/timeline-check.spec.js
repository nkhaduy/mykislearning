import { test, expect } from "playwright/test";

const URL = "https://mykis-learning.nkhaduy.workers.dev/about-kis";

test("timeline desktop 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.locator("#kis-history").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const items = page.locator(".tl-story__item");
  await expect(items).toHaveCount(7);
  // horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  // no dot/year overlap: each dot must be within node column horizontally centered
  const overlap = await page.evaluate(() => {
    const track = document.querySelector(".tl-story__track");
    const r = track.getBoundingClientRect();
    const lineX = r.left + r.width / 2;
    let bad = 0;
    document.querySelectorAll(".tl-story__item").forEach((it) => {
      const dot = it.querySelector(".tl-story__dot").getBoundingClientRect();
      const year = it.querySelector(".tl-story__year").getBoundingClientRect();
      // dot should be near center axis
      if (Math.abs((dot.left + dot.width / 2) - lineX) > 6) bad++;
      // year and dot should not vertically overlap
      if (year.bottom > dot.top + 2) bad++;
    });
    return bad;
  });
  expect(overlap).toBe(0);
  expect(errors.filter(e => /timeline|tl-story/i.test(e)).length).toBe(0);
  await page.screenshot({ path: "test-results/timeline-desktop.png", fullPage: false });
});

test("timeline mobile 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.locator("#kis-history").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  // year text must not wrap char-by-char: year element width should fit content (>= 38px)
  const minYearW = await page.evaluate(() => {
    let m = Infinity;
    document.querySelectorAll(".tl-story__year").forEach((y) => {
      const r = y.getBoundingClientRect();
      if (r.width < m) m = r.width;
    });
    return m;
  });
  expect(minYearW).toBeGreaterThan(40);
  // no overlap between dot and year on mobile (dot in left rail, year in content)
  const overlap = await page.evaluate(() => {
    let bad = 0;
    document.querySelectorAll(".tl-story__item").forEach((it) => {
      const dot = it.querySelector(".tl-story__dot").getBoundingClientRect();
      const year = it.querySelector(".tl-story__year").getBoundingClientRect();
      if (dot.right > year.left + 2) bad++;
    });
    return bad;
  });
  expect(overlap).toBe(0);
  await page.screenshot({ path: "test-results/timeline-mobile.png", fullPage: false });
  expect(errors.length).toBe(0);
});
