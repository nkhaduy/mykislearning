import { statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist");
const budgets = {
  publicJs: 250 * 1024,
  publicCss: 100 * 1024,
  publicAboutJs: 250 * 1024,
  publicAboutCss: 100 * 1024,
  mobileLcpImage: 200 * 1024,
};

const bytes = (path) => statSync(join(root, path)).size;
const measurements = {
  publicJs: [
    "src/app/style-loader.js",
    "src/app/bootstrap.js",
    "src/features/public/home.js",
  ].reduce((total, path) => total + bytes(path), 0),
  publicCss: bytes("src/features/public/home.css"),
  publicAboutJs: [
    "src/app/style-loader.js",
    "src/app/bootstrap.js",
    "src/features/public/about.js",
  ].reduce((total, path) => total + bytes(path), 0),
  publicAboutCss: bytes("src/features/public/home.css") + bytes("src/features/public/about.css"),
  mobileLcpImage: bytes("public/images/mykis-learning-banner-mobile.webp"),
};

const failures = Object.entries(measurements)
  .filter(([name, value]) => value > budgets[name])
  .map(([name, value]) => `${name}: ${value} bytes exceeds ${budgets[name]} bytes`);

if (failures.length) {
  console.error(`Bundle budget failed with ${failures.length} violation(s).`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Bundle budget passed: public JS ${measurements.publicJs} B, public CSS ${measurements.publicCss} B, mobile LCP image ${measurements.mobileLcpImage} B.`);
