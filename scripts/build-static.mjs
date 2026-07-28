import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");

// Clean dist
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const copy = (src, dest) => {
  const full = join(ROOT, src);
  if (!existsSync(full)) { console.log(`  skip (not found): ${src}`); return; }
  const target = join(DIST, dest || src);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(full, target, { recursive: true });
  console.log(`  copied: ${src}`);
};

// Core files. The legacy monolith and global stylesheet are intentionally not
// copied: every known runtime route has an explicit feature entry and CSS.
copy("index.html");
copy("robots.txt");
copy("sitemap.xml");
copy("src/app/bootstrap.js");
copy("src/app/style-loader.js");
copy("src/app/route-registry.js");
copy("src/features/public/home.js");
copy("src/features/public/home.css");
copy("src/features/public/about.js");
copy("src/features/public/about.css");
copy("src/features/public/training.js");
copy("src/features/public/public-secondary.css");
copy("src/features/auth/login.js");
copy("src/features/auth/security.js");
copy("src/features/auth/change-password.js");
copy("src/features/auth/auth.css");
copy("src/features/auth/auth-visual.css");
copy("src/shared/api/client.js");
copy("src/shared/i18n/runtime.js");
copy("src/shared/ui/font.css");
copy("src/shared/ui/route-shell.js");
copy("src/shared/ui/route-shell.css");
copy("src/features/learner/dashboard.js");
copy("src/features/learner/courses.js");
copy("src/features/learner/learner.css");
copy("src/features/admin/dashboard.js");
copy("src/features/admin/admin.css");
copy("src/features/employees/employees.js");
copy("src/features/employees/employees.css");
copy("src/features/courses/admin-courses.js");
copy("src/features/courses/course-player.js");
copy("src/features/courses/courses.css");
copy("src/shared/ui/collection-route.js");
copy("src/features/training/live-training.js");
copy("src/features/quizzes/quizzes.js");
copy("src/features/records/records.js");
copy("src/features/operations/operations.css");
copy("src/features/attendance/scanner.js");
copy("src/features/attendance/attendance.css");
copy("src/features/reporting/reports.js");
copy("src/features/reporting/reporting.css");
copy("src/features/secondary/data-route.js");
copy("src/features/secondary/learner.js");
copy("src/features/secondary/admin.js");
copy("src/features/secondary/secondary.css");

// Preserve the approved original-resolution brand assets in the artifact.
for (const asset of [
  "assets/about/about-kis.png",
  "assets/about/about-kis.webp",
  "assets/about/global-network.png",
  "assets/about/global-network.webp",
  "assets/about/leader-cho-hun-hee.jpg",
  "assets/about/leader-choi-eun-suk.jpg",
  "assets/about/leader-shin-hyun-jae.jpg",
  "assets/about/tgd.jpeg",
  "assets/kis-logo-horizontal.png",
  "assets/kis-logo-white.png",
  "assets/fonts/be-vietnam-pro-latin-400.woff2",
  "assets/fonts/be-vietnam-pro-latin-500.woff2",
  "assets/fonts/be-vietnam-pro-latin-600.woff2",
  "assets/fonts/be-vietnam-pro-latin-700.woff2",
  "assets/fonts/be-vietnam-pro-latin-800.woff2",
  "assets/fonts/be-vietnam-pro-vietnamese-400.woff2",
  "assets/fonts/be-vietnam-pro-vietnamese-500.woff2",
  "assets/fonts/be-vietnam-pro-vietnamese-600.woff2",
  "assets/fonts/be-vietnam-pro-vietnamese-700.woff2",
  "assets/fonts/be-vietnam-pro-vietnamese-800.woff2",
  "assets/timeline/2015.jpeg",
  "assets/timeline/2016.jpeg",
  "assets/timeline/2018.png",
  "assets/timeline/2019.jpeg",
  "assets/timeline/2020.png",
  "assets/timeline/2021.png",
  "assets/timeline/2025.jpeg",
]) copy(asset);
// Keep only the browser module graph; legacy TypeScript and mock auth files
// contain test-only data and are not delivery dependencies.
for (const module of [
  "lib/i18n/en.js",
  "lib/i18n/index.js",
  "lib/i18n/kr.js",
  "lib/i18n/vi.js",
]) copy(module);

for (const asset of [
  "public/images/hoiso.webp",
  "public/images/kis-head-office.webp",
  "public/images/mykis-learning-banner-desktop.png",
  "public/images/mykis-learning-banner-mobile.png",
  "public/images/mykis-learning-banner-desktop.webp",
  "public/images/mykis-learning-banner-mobile.webp",
  "images/communication-training-course.png",
  "images/leadership-training-course.png",
  "vendor/jsqr.min.js",
]) copy(asset);

// Route stub directories for direct navigation (each has index.html → SPA handles them)
// The SPA fallback in wrangler.jsonc handles these automatically via not_found_handling

// Favicons / manifest
for (const f of [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "site.webmanifest",
]) {
  copy(f);
}

const scan = spawnSync(process.execPath, [join(ROOT, "scripts/scan-static-artifact.mjs"), DIST], { stdio: "inherit" });
if (scan.status !== 0) process.exit(scan.status || 1);

const budget = spawnSync(process.execPath, [join(ROOT, "scripts/check-bundle-budget.mjs"), DIST], { stdio: "inherit" });
if (budget.status !== 0) process.exit(budget.status || 1);

console.log("\n✓ dist/ built, privacy-scanned and budget-checked");
