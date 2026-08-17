import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifestPath = new URL("../../vendor/frappe-lms/manifest.json", import.meta.url);
const syncScriptPath = new URL("../../scripts/sync-frappe-ui.sh", import.meta.url);

test("vendors the pinned Frappe LMS frontend without media bloat", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const script = readFileSync(syncScriptPath, "utf8");

  assert.equal(manifest.upstream.tag, "v2.61.0");
  assert.equal(manifest.upstream.commit, "d3bfe97d178eb076310dffd7407106bcdec15d67");
  assert.deepEqual(manifest.fetchedPaths, ["frontend", "license.txt"]);
  assert.ok(manifest.excludedPaths.includes("frontend/public/*.mp4"));
  assert.ok(manifest.excludedPaths.includes("frontend/public/manifest/apple-splash-*.jpg"));
  assert.match(script, /--filter=blob:none/);
  assert.match(script, /sparse-checkout/);
});
