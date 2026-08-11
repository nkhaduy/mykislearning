import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bootstrap = readFileSync(new URL("../../src/app/bootstrap.js", import.meta.url), "utf8");
const router = readFileSync(new URL("../../src/app/router.js", import.meta.url), "utf8");
const routeAssets = readFileSync(new URL("../../src/app/route-assets.js", import.meta.url), "utf8");
const legacyDetector = readFileSync(new URL("../../scripts/check-legacy-monolith.mjs", import.meta.url), "utf8");
const registry = readFileSync(new URL("../../src/app/route-registry.js", import.meta.url), "utf8");

test("ARCH-ROUTE-001: bootstrap routes through explicit feature entries without the monolith", () => {
  assert.match(bootstrap, /startRouter/);
  assert.match(routeAssets, /const routeModules = \{/);
  assert.match(router, /loadRouteModule\(route\)/);
  assert.match(legacyDetector, /src\/app\/route-assets\.js/);
  assert.doesNotMatch(bootstrap, /import\("\.\.\/\.\.\/app\.js"\)/);
  assert.doesNotMatch(routeAssets, /import\("\.\.\/\.\.\/app\.js"\)/);
  assert.doesNotMatch(bootstrap, /hydrateLegacySession|window\.[A-Za-z]+\s*=/);
  assert.match(registry, /export function matchRoute\(pathname\)/);
});
