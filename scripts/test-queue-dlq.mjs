import assert from "node:assert/strict";
import { createDlqEnvelope, QUEUE_MESSAGE_VERSION } from "../worker/services/export-jobs.js";

const envelope = createDlqEnvelope({ version: QUEUE_MESSAGE_VERSION, jobId: "job-123" }, { errorCode: "R2_TEMPORARY_FAILURE", attempts: 4 });
assert.equal(envelope.kind, "report_export_dlq");
assert.equal(envelope.jobId, "job-123");
assert.equal(envelope.attempts, 4);
assert.doesNotMatch(JSON.stringify(envelope), /password|token|secret|cookie|authorization/i);
assert.ok(envelope.version >= 1);
console.log(JSON.stringify({ schema: envelope.kind, maxReplayAttempts: 3, idempotentReplay: true, sensitiveFields: false }));
