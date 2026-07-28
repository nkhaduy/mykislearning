import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const scanner = new URL("../../scripts/scan-static-artifact.mjs", import.meta.url).pathname;

test("SEC-003: artifact scanner rejects employee datasets without printing file contents", () => {
  const root = mkdtempSync(join(tmpdir(), "kis-artifact-test-"));
  mkdirSync(join(root, "data"));
  writeFileSync(join(root, "data", "employees.json"), '[{"id":"synthetic-only"}]');
  const result = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /data\/employees\.json: forbidden private-data path/);
  assert.doesNotMatch(result.stderr, /synthetic-only/);
});

test("SEC-003: artifact scanner accepts a minimal public artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "kis-artifact-test-"));
  writeFileSync(join(root, "index.html"), "<!doctype html><title>Public</title>");
  const result = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("SEC-003: artifact scanner rejects personal company email addresses", () => {
  const root = mkdtempSync(join(tmpdir(), "kis-artifact-test-"));
  writeFileSync(join(root, "app.js"), 'const support = "person.name@kisvn.vn";');
  const result = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /app\.js: personal company email/);
  assert.doesNotMatch(result.stderr, /person\.name/);
});

test("SEC-003: artifact scanner permits only the approved public HR contact", () => {
  const root = mkdtempSync(join(tmpdir(), "kis-artifact-test-"));
  writeFileSync(join(root, "app.js"), 'const support = "thanh.ntc@kisvn.vn";');
  const result = spawnSync(process.execPath, [scanner, root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
