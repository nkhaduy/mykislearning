import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifestPath = new URL("../../vendor/frappe-lms/manifest.json", import.meta.url);
const syncScriptPath = new URL("../../scripts/sync-frappe-lms-upstream.sh", import.meta.url);

test("vendors the pinned Frappe LMS frontend with a reproducible manifest", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const script = readFileSync(syncScriptPath, "utf8");

  assert.equal(manifest.upstream.tag, "v2.61.0");
  assert.equal(manifest.upstream.commit, "d3bfe97d178eb076310dffd7407106bcdec15d67");
  assert.equal(manifest.applicationBase, "frontend");
  assert.deepEqual(manifest.importedPaths, ["frontend", "license.txt"]);
  assert.match(manifest.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(manifest.checksum.algorithm, "sha256");
  assert.match(manifest.checksum.tree, /^[a-f0-9]{64}$/);
  assert.ok(manifest.excludedPaths.includes("frontend/public/*.mp4"));
  assert.ok(manifest.excludedPaths.includes("frontend/public/manifest/apple-splash-*.jpg"));
  assert.match(script, /--filter=blob:none/);
  assert.match(script, /sparse-checkout/);
  assert.match(script, /git diff --no-index --stat/);
});
