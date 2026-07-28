import assert from "node:assert/strict";
import { EXPORT_FORMAT_LIMITS, EXPORT_REGISTRY } from "../worker/services/export-jobs.js";

const expected = ["employees", "course-completion", "enrollments", "attendance", "quiz-results", "learning-records", "certificates", "compliance"];
assert.deepEqual(Object.keys(EXPORT_REGISTRY).sort(), expected.sort());
assert.equal(EXPORT_FORMAT_LIMITS.csv.maxRows, 1_000_000);
assert.equal(EXPORT_FORMAT_LIMITS.xlsx.maxRows, 10_000);
assert.equal(EXPORT_FORMAT_LIMITS.pdf.maxRows, 120);
assert.ok(EXPORT_FORMAT_LIMITS.csv.retentionHours > 0 && EXPORT_FORMAT_LIMITS.xlsx.retentionHours > 0 && EXPORT_FORMAT_LIMITS.pdf.retentionHours > 0);
console.log(JSON.stringify({ reportTypes: expected, formats: EXPORT_FORMAT_LIMITS, truncation: false }));
