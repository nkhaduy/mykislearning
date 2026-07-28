import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const contract = JSON.parse(read("docs/audit-remediation/schema-normalization-contract.json"));

test("ARCH-007: duplicate schema models have an explicit non-destructive ownership contract", () => {
  const required = new Set(["course_content", "course_contents", "questions", "quiz_questions", "quiz_question_versions", "enrollments", "course_assignments", "lesson_progress", "content_progress", "learning_history", "learning_records"]);
  const covered = new Set(contract.groups.flatMap((group) => group.models));
  assert.deepEqual([...required].filter((model) => !covered.has(model)), []);
  assert.equal(contract.destructiveChangesAllowed, false);
  for (const group of contract.groups) {
    assert.ok(group.models.includes(group.canonicalTarget));
    assert.ok(group.currentWriter.length);
    assert.ok(group.currentReader.length);
    assert.ok(["high", "critical"].includes(group.risk));
  }
});

test("ARCH-007: current worker writers use canonical models and do not write legacy duplicates", () => {
  const workerSource = [
    "worker/routes/courses.js", "worker/routes/quizzes.js", "worker/routes/enrollments.js",
    "worker/routes/backfill.js", "worker/routes/content-versions.js", "worker/routes/content-progress.js",
    "worker/routes/learning-records.js",
  ].map(read).join("\n");
  for (const group of contract.groups) {
    assert.match(workerSource, new RegExp(`from\\(["']${group.canonicalTarget}["']\\)`), `${group.canonicalTarget} needs an active worker contract`);
    for (const legacy of group.legacyOnly) {
      assert.doesNotMatch(workerSource, new RegExp(`from\\(["']${legacy}["']\\)`), `${legacy} must remain legacy-only until reconciliation`);
    }
  }
});

test("ARCH-007: browser session roles remain narrower than unresolved legacy role values", () => {
  assert.deepEqual(contract.roles.runtime, ["employee", "hr", "admin"]);
  const bootstrap = read("src/app/bootstrap.js");
  assert.match(bootstrap, /\["employee", "hr", "admin"\]\.includes/);
  for (const role of [...contract.roles.databaseLegacy, ...contract.roles.clientLegacy]) {
    assert.doesNotMatch(bootstrap, new RegExp(`["']${role}["']`));
  }
});
