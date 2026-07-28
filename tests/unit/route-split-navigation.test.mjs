import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bootstrap = readFileSync(new URL("../../src/app/bootstrap.js", import.meta.url), "utf8");
const registry = readFileSync(new URL("../../src/app/route-registry.js", import.meta.url), "utf8");

test("ARCH-ROUTE-001: bootstrap routes through explicit feature entries without the monolith", () => {
  assert.match(bootstrap, /const splitEntries = \{/);
  assert.match(bootstrap, /await splitEntries\[routeDefinition\.splitEntry\]\(\)/);
  assert.doesNotMatch(bootstrap, /import\("\.\.\/\.\.\/app\.js"\)/);
  assert.doesNotMatch(bootstrap, /hydrateLegacySession|window\.[A-Za-z]+\s*=/);
  assert.match(registry, /export function matchRoute\(pathname\)/);
});
