import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.log("Plan-only replay: provide a local JSON envelope path to validate; no queue or remote service is contacted.");
  process.exit(0);
}
const envelope = JSON.parse(readFileSync(inputPath, "utf8"));
assert.equal(envelope.kind, "report_export_dlq");
assert.ok(envelope.jobId && /^[-\w]{1,64}$/.test(envelope.jobId));
assert.ok(Number(envelope.attempts) <= 20);
assert.doesNotMatch(JSON.stringify(envelope), /password|token|secret|cookie|authorization/i);
console.log(JSON.stringify({ plan: "service_requeue_export_job", jobId: envelope.jobId, maxManualReplay: 3, remoteContacted: false }));
