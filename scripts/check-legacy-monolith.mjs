import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROUTE_DEFINITIONS } from "../src/app/route-registry.js";

const root = new URL("../", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const bootstrap = read("src/app/bootstrap.js");
const failures = [];
const runtimeRoutes = ROUTE_DEFINITIONS.filter((route) => !["/", "/login", "/about-kis"].includes(route.path || ""));
const entries = new Set([...bootstrap.matchAll(/^(\s*)([A-Za-z0-9]+): \(\) => import\(/gm)].map((match) => match[2]));

for (const route of runtimeRoutes) {
  if (!route.splitEntry) failures.push(`missing splitEntry: ${route.path || route.pattern}`);
  else if (!entries.has(route.splitEntry)) failures.push(`missing bootstrap entry ${route.splitEntry}: ${route.path || route.pattern}`);
}

function walk(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, output);
    else if (/\.(?:html|js|mjs|ts|json|jsonc)$/.test(name)) output.push(path);
  }
  return output;
}

const runtimeFiles = ["index.html", "scripts/build-static.mjs", ...walk(join(root, "src")), ...walk(join(root, "worker"))];
for (const absolute of runtimeFiles) {
  const content = readFileSync(absolute, "utf8");
  if (/(?:import\(|from\s+["'`])[^"'`]*app\.js["'`]/.test(content) || /(?:src|href)=["'][^"']*app\.js/.test(content)) {
    failures.push(`runtime references app.js: ${relative(root, absolute)}`);
  }
  if (/(?:src|href)=["'][^"']*styles\.css/.test(content)) failures.push(`runtime references legacy styles.css: ${relative(root, absolute)}`);
}

if (existsSync(join(root, "dist"))) {
  for (const absolute of walk(join(root, "dist"))) {
    const content = readFileSync(absolute, "utf8");
    if (/(?:import\(|from\s+["'`])[^"'`]*app\.js["'`]/.test(content) || /(?:src|href)=["'][^"']*app\.js/.test(content)) failures.push(`artifact references app.js: ${relative(root, absolute)}`);
    if (/(?:src|href)=["'][^"']*styles\.css/.test(content)) failures.push(`artifact references styles.css: ${relative(root, absolute)}`);
  }
  if (existsSync(join(root, "dist/app.js"))) failures.push("artifact contains dist/app.js");
  if (existsSync(join(root, "dist/styles.css"))) failures.push("artifact contains dist/styles.css");
}

if (failures.length) {
  console.error("Legacy monolith detector failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`Legacy monolith detector passed for ${runtimeRoutes.length} runtime routes and ${entries.size} explicit entries.`);
