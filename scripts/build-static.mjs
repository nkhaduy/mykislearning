import { cpSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");

// Clean dist
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const copy = (src, dest) => {
  const full = join(ROOT, src);
  if (!existsSync(full)) { console.log(`  skip (not found): ${src}`); return; }
  cpSync(full, join(DIST, dest || src), { recursive: true });
  console.log(`  copied: ${src}`);
};

// Core files
copy("index.html");
copy("app.js");
copy("styles.css");

// Static directories
copy("public");
copy("assets");
copy("images");
copy("vendor");
copy("data");
copy("lib");

// Route stub directories for direct navigation (each has index.html → SPA handles them)
// The SPA fallback in wrangler.jsonc handles these automatically via not_found_handling

// Favicons / manifest
for (const f of ["favicon.ico", "favicon.png", "favicon.svg", "manifest.json", "manifest.webmanifest"]) {
  copy(f);
}

console.log("\n✓ dist/ built");
