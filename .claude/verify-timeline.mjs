import puppeteer from "puppeteer";

const URL = "https://mykis-learning.nkhaduy.workers.dev/about-kis";
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });

const errors = [];
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

// Wait for timeline to render
await page.waitForSelector("#kis-history .tl-story__item", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 600));

const report = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll("#kis-history .tl-story__item"));
  const years = items.map((el) => el.querySelector(".tl-story__year")?.textContent?.trim());
  const data = window.timelineData || null;
  // capture per-item side + image src
  const detail = items.map((el) => ({
    year: el.querySelector(".tl-story__year")?.textContent?.trim(),
    side: el.classList.contains("tl-story__item--left") ? "left" : "right",
    events: Array.from(el.querySelectorAll(".tl-story__events li")).map((li) => li.textContent.trim()),
    img: el.querySelector(".tl-story__media img")?.getAttribute("src"),
  }));
  return { count: items.length, years, detail };
});

// Scroll through to trigger animation + progress + active dot
for (let y = 0; y < await page.evaluate(() => document.body.scrollHeight); y += 350) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await new Promise((r) => setTimeout(r, 60));
}
await new Promise((r) => setTimeout(r, 400));

const after = await page.evaluate(() => {
  const items = Array.from(document.querySelectorAll("#kis-history .tl-story__item"));
  const visibleCount = items.filter((el) => el.classList.contains("is-visible")).length;
  const activeCount = items.filter((el) => el.classList.contains("is-active")).length;
  const progressH = document.querySelector("[data-timeline-progress]")?.style?.height;
  const lineLeft = getComputedStyle(document.querySelector(".tl-story__line")).left;
  return { visibleCount, activeCount, progressH, lineLeft };
});

// Mobile viewport
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.reload({ waitUntil: "networkidle2" });
await page.waitForSelector("#kis-history .tl-story__item", { timeout: 15000 });
await new Promise((r) => setTimeout(r, 400));
const mobile = await page.evaluate(() => {
  const line = document.querySelector(".tl-story__line");
  const firstItem = document.querySelector(".tl-story__item");
  const cs = getComputedStyle(firstItem);
  return {
    lineLeft: cs.left !== undefined ? getComputedStyle(line).left : null,
    itemCols: cs.gridTemplateColumns,
    lineLeftVal: getComputedStyle(line).left,
  };
});
await page.screenshot({ path: "/Users/khaduy/Documents/KISVN/.claude/timeline-mobile.png", fullPage: false });

// Desktop screenshot near history section
await page.setViewport({ width: 1280, height: 900 });
await page.reload({ waitUntil: "networkidle2" });
await page.waitForSelector("#kis-history .tl-story__item", { timeout: 15000 });
await page.evaluate(() => document.querySelector("#kis-history").scrollIntoView({ block: "start" }));
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: "/Users/khaduy/Documents/KISVN/.claude/timeline-desktop.png", fullPage: false });

await browser.close();

console.log("=== TIMELINE VERIFICATION ===");
console.log("items:", report.count);
console.log("years:", JSON.stringify(report.years));
console.log("detail[0]:", JSON.stringify(report.detail[0]));
console.log("detail[last]:", JSON.stringify(report.detail[report.detail.length - 1]));
console.log("sides:", JSON.stringify(report.detail.map((d) => d.side)));
console.log("after scroll — visible:", after.visibleCount, "active:", after.activeCount, "progressH:", after.progressH);
console.log("mobile — lineLeft:", mobile.lineLeftVal, "gridCols:", mobile.itemCols);
console.log("consoleErrors:", consoleErrors.length, JSON.stringify(consoleErrors.slice(0, 5)));
console.log("pageerrors:", errors.length, JSON.stringify(errors.slice(0, 5)));
