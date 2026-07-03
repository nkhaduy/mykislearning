import { test, expect } from "playwright/test";

const BASE_URL = process.env.ABOUT_BASE_URL || "https://mykis-learning.nkhaduy.workers.dev";
const OUT = "test-results/about-kis-ui-polish";
const YEARS = ["2015", "2016", "2018", "2019", "2020", "2021", "2025"];

async function gotoAbout(page) {
  await page.goto(`${BASE_URL}/about-kis`, { waitUntil: "networkidle" });
  await expect(page.locator(".about-page")).toBeVisible();
}

async function expectNoPageOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

test("hero metrics, timeline interaction, footer, and i18n", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAbout(page);
  await expectNoPageOverflow(page);

  const stats = page.locator(".about-hero-stat");
  await expect(stats).toHaveCount(4);
  await expect(stats).toContainText(["12/2010", "4.550 tỷ", "99.8%", "15+"]);

  const statBoxes = await stats.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  for (const box of statBoxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(1440);
  }
  expect(new Set(statBoxes.map((box) => Math.round(box.left))).size).toBe(2);
  expect(new Set(statBoxes.map((box) => Math.round(box.top))).size).toBe(2);
  await page.locator(".about-hero-v2").screenshot({ path: `${OUT}/hero-desktop.png` });

  await page.setViewportSize({ width: 768, height: 1024 });
  await gotoAbout(page);
  await expectNoPageOverflow(page);
  await page.locator(".about-hero-v2").screenshot({ path: `${OUT}/hero-tablet.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAbout(page);
  await expectNoPageOverflow(page);
  await page.locator(".about-hero-v2").screenshot({ path: `${OUT}/hero-mobile.png` });

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAbout(page);
  const timeline = page.locator("#kis-history");
  await timeline.scrollIntoViewIfNeeded();
  await expect(timeline).toBeVisible();
  const shellHandle = await timeline.elementHandle();
  await page.locator("#kis-history").screenshot({ path: `${OUT}/timeline-desktop-2025.png` });

  const startingScrollY = await page.evaluate(() => window.scrollY);
  for (const year of YEARS) {
    await page.getByRole("tab", { name: year, exact: true }).click();
    await expect(page.locator(".timeline-carousel__year-big")).toHaveText(year);
    await expect(page.locator(".timeline-carousel__content-inner")).toHaveAttribute("data-active-year", year);
    await expect(page.locator(`#timeline-year-${year}`)).toHaveAttribute("aria-selected", "true");
    const sameShell = await timeline.evaluate((node, original) => node === original, shellHandle);
    expect(sameShell).toBe(true);
    const textBlank = await page.locator(".timeline-carousel__content").evaluate((node) => node.textContent.trim().length === 0);
    expect(textBlank).toBe(false);
  }
  const endingScrollY = await page.evaluate(() => window.scrollY);
  expect(Math.abs(endingScrollY - startingScrollY)).toBeLessThanOrEqual(12);
  await page.locator("#kis-history").screenshot({ path: `${OUT}/timeline-desktop-2015.png` });

  await page.getByRole("tab", { name: "2020", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".timeline-carousel__year-big")).toHaveText("2020");
  await page.getByRole("tab", { name: "2021", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".timeline-carousel__year-big")).toHaveText("2021");

  await page.setViewportSize({ width: 390, height: 844 });
  await gotoAbout(page);
  await expectNoPageOverflow(page);
  await page.locator("#kis-history").scrollIntoViewIfNeeded();
  await page.locator("#kis-history").screenshot({ path: `${OUT}/timeline-mobile.png` });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("tab", { name: "2018", exact: true }).click();
  await expect(page.locator(".timeline-carousel__year-big")).toHaveText("2018");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const footer = page.locator(".footer-v2");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.locator(".footer-v2__support-box")).toHaveCount(0);
  await expect(footer.locator(".footer-v2__support-avatar")).toHaveCount(0);
  await expect(footer).toContainText("Nguyễn Thị Cẩm Thanh");
  await expect(footer.locator('a[href="mailto:thanh.ntc@kisvn.vn"]')).toHaveText("thanh.ntc@kisvn.vn");
  await page.locator(".footer-v2").screenshot({ path: `${OUT}/footer-mobile.png` });

  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoAbout(page);
  await page.locator(".footer-v2").scrollIntoViewIfNeeded();
  await expect(page.locator(".footer-v2")).toContainText("Nguyễn Thị Cẩm Thanh");
  await expect(page.locator(".footer-v2")).toContainText("Phó phòng, Phòng Nhân sự");
  await page.locator(".footer-v2").screenshot({ path: `${OUT}/footer-desktop.png` });

  await page.locator(".footer-v2").getByRole("button", { name: "EN" }).click();
  await expect(page.locator(".footer-v2")).toContainText("Assistant Manager, Human Resources Dept.");
  await page.locator(".footer-v2").getByRole("button", { name: "KR" }).click();
  await expect(page.locator(".footer-v2")).toContainText("인사부 부팀장");
  await expect(page.locator("body")).not.toContainText(/about\.footerContactRole|undefined/);

  expect(errors).toEqual([]);
});
