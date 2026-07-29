import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("ARCH-ROUTE-004: priority course, training, quiz, record and attendance routes have split entries", () => {
  const registry = read("src/app/route-registry.js");
  const expected = [
    ["/hr/courses", "courseManagement"], ["/dashboard/courses/:id", "coursePlayer"],
    ["/hr/live-training", "liveTraining"], ["/hr/quizzes", "quizzes"],
    ["/dashboard/quizzes", "quizzes"], ["/hr/learning-records", "learningRecords"],
    ["/dashboard/certificates", "learningRecords"], ["/attendance/scan", "attendance"],
  ];
  for (const [path, entry] of expected) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(registry, new RegExp(`${escaped}[\\s\\S]{0,260}splitEntry: "${entry}"`), `${path} must use ${entry}`);
  }
});

test("ARCH-ROUTE-005: priority entries do not import the monolith or eager heavy libraries", () => {
  for (const path of [
    "src/features/courses/admin-courses.js", "src/features/courses/course-player.js",
    "src/features/training/live-training.js", "src/features/quizzes/quizzes.js",
    "src/features/records/records.js", "src/features/attendance/scanner.js",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /app\.js|mockDatabase|xlsx\.full|from ["']xlsx|from ["']jsqr|from ["']qrcode/);
  }
  assert.match(read("src/features/attendance/scanner.js"), /script\.src = "\/vendor\/jsqr\.min\.js"/);
});
