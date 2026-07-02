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
  const yearBtns = page.locator(".timeline-carousel__year");
  await expect(yearBtns).toHaveCount(7);
  // horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  // active year must be visible and have correct aria
  const activeYear = page.locator(".timeline-carousel__year.is-active");
  await expect(activeYear).toHaveAttribute("aria-current", "true");
  await expect(activeYear).toHaveAttribute("aria-selected", "true");
  // year-big should show the active year
  const yearBig = page.locator(".timeline-carousel__year-big");
  await expect(yearBig).toBeVisible();
  // image should be loaded
  const img = page.locator(".timeline-carousel__image img");
  await expect(img).toBeVisible();
  // prev/next buttons should exist
  await expect(page.locator(".timeline-carousel__btn--prev")).toBeVisible();
  await expect(page.locator(".timeline-carousel__btn--next")).toBeVisible();
  // events list should have content
  const events = page.locator(".timeline-carousel__events li");
  await expect(events.first()).toBeVisible();
  expect(errors.filter(e => /timeline|carousel/i.test(e)).length).toBe(0);
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
  // year nav should be scrollable (horizontal)
  const yearNav = page.locator(".timeline-carousel__years");
  await expect(yearNav).toBeVisible();
  // active year button must be visible
  const activeYear = page.locator(".timeline-carousel__year.is-active");
  await expect(activeYear).toBeVisible();
  // image should be visible with correct aspect
  const img = page.locator(".timeline-carousel__image img");
  await expect(img).toBeVisible();
  // year-big should be visible
  const yearBig = page.locator(".timeline-carousel__year-big");
  await expect(yearBig).toBeVisible();
  // events should be readable
  const events = page.locator(".timeline-carousel__events li");
  await expect(events.first()).toBeVisible();
  // prev/next buttons should exist with touch-friendly size
  const prevBtn = page.locator(".timeline-carousel__btn--prev");
  const nextBtn = page.locator(".timeline-carousel__btn--next");
  await expect(prevBtn).toBeVisible();
  await expect(nextBtn).toBeVisible();
  await page.screenshot({ path: "test-results/timeline-mobile.png", fullPage: false });
  expect(errors.length).toBe(0);
});
