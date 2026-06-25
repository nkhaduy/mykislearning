import puppeteer from "puppeteer";
const URL = "https://mykis-learning.nkhaduy.workers.dev/about-kis";
const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector("#kis-history .tl-story__item", { timeout: 15000 });
const items = await page.$$("#kis-history .tl-story__item");
// scroll each item into view, one by one, slowly
let visible = 0;
for (const it of items) {
  await it.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await new Promise((r) => setTimeout(r, 450));
}
await new Promise((r) => setTimeout(r, 500));
visible = await page.evaluate(() => document.querySelectorAll("#kis-history .tl-story__item.is-visible").length);
const total = items.length;
console.log(`visible ${visible}/${total}`);
// Check active dot has navy + glow
const activeDot = await page.evaluate(() => {
  const a = document.querySelector("#kis-history .tl-story__item.is-active .tl-story__dot");
  if (!a) return null;
  const cs = getComputedStyle(a);
  return { bg: cs.backgroundColor, borderColor: cs.borderColor, transform: cs.transform };
});
console.log("activeDot:", JSON.stringify(activeDot));
await browser.close();
