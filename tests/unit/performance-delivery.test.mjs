import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("PERF-001: responsive LCP images are preloaded from the document", () => {
  const loader = read("src/app/style-loader.js");
  assert.match(loader, /rel="preload" as="image" type="image\/webp" href="\/public\/images\/mykis-learning-banner-mobile\.webp"[^>]*media="\(max-width: 767px\)"[^>]*fetchpriority="high"/);
  assert.match(loader, /rel="preload" as="image" type="image\/webp" href="\/public\/images\/mykis-learning-banner-desktop\.webp"[^>]*media="\(min-width: 768px\)"[^>]*fetchpriority="high"/);
});

test("PERF-002/PERF-006: responsive and card images reserve intrinsic space", () => {
  const publicHome = read("src/features/public/home.js");
  assert.match(publicHome, /mykis-learning-banner-mobile\.webp[^>]*width="941" height="1672"/);
  assert.match(publicHome, /mykis-learning-banner-desktop\.webp[^>]*width="1672" height="941"/);
  assert.match(read("src/features/learner/learner.css"), /learner-course-card__cover\{[^}]*min-height:8rem/);
  assert.match(publicHome, /kis-logo-horizontal\.png[^>]*width="700" height="92"/);
});

test("PERF-003/ARCH-004: build copies explicit assets and browser modules", () => {
  const build = read("scripts/build-static.mjs");
  assert.doesNotMatch(build, /copy\("assets"\)/);
  assert.doesNotMatch(build, /copy\("lib"\)/);
  assert.doesNotMatch(build, /lib\/auth\/mockAuth/);
  assert.match(build, /assets\/about\/about-kis\.png/);
  assert.doesNotMatch(build, /lib\/services\/sessionService\.js/);
});

test("PERF-004/PERF-005: the home route does not import the application monolith", () => {
  const bootstrap = read("src/app/bootstrap.js");
  const publicHome = read("src/features/public/home.js");
  assert.match(bootstrap, /path === "\/"/);
  assert.match(bootstrap, /features\/public\/home\.js/);
  assert.doesNotMatch(bootstrap, /app\.js/);
  assert.doesNotMatch(publicHome, /app\.js|mockDatabase|xlsx|qrAttendance|employeeService/);
  assert.match(read("src/app/style-loader.js"), /home\.css/);
});

test("PERF-005: the public About route has an independent entry and stylesheet", () => {
  const bootstrap = read("src/app/bootstrap.js");
  const about = read("src/features/public/about.js");
  const loader = read("src/app/style-loader.js");
  assert.match(bootstrap, /path === "\/about-kis"/);
  assert.match(bootstrap, /features\/public\/about\.js/);
  assert.match(loader, /features\/public\/about\.css/);
  assert.doesNotMatch(about, /app\.js|mockDatabase|employeeService|xlsx\.full|jsqr|qrcode/);
});

test("PERF-003/PERF-004: public delivery budgets are enforced by the build", () => {
  const build = read("scripts/build-static.mjs");
  const budget = read("scripts/check-bundle-budget.mjs");
  assert.match(build, /check-bundle-budget\.mjs/);
  assert.match(budget, /publicJs: 250 \* 1024/);
  assert.match(budget, /publicAboutJs: 250 \* 1024/);
  assert.match(budget, /mobileLcpImage: 200 \* 1024/);
});
