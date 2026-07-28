import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { processExportMessage, sanitizeExportParameters, validateExportBinding } from "../../worker/services/export-jobs.js";
import { handleReportExports } from "../../worker/routes/report-exports.js";
import { signToken } from "../../worker/services/crypto.js";

const JWT_SECRET = "export-route-test-secret-at-least-32-characters";

async function exportRequest(path, role, accountId = `${role}-owner`) {
  const token = await signToken({
    sub: accountId,
    role,
    sid: "00000000-0000-4000-8000-000000000099",
    exp: Math.floor(Date.now() / 1000) + 300,
  }, JWT_SECRET);
  return new Request(`https://lms.test${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

function exportRouteEnv(role, handlers = {}) {
  const calls = [];
  const supabase = {
    async rpc(name, params = {}) {
      calls.push({ name, params });
      if (name === "service_get_auth_session") {
        return { data: {
          valid: true,
          profile_id: params.p_profile_id,
          role,
          session_id: params.p_session_id,
          family_id: "00000000-0000-4000-8000-000000000098",
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        }, error: null };
      }
      if (handlers[name]) return handlers[name](params);
      return { data: null, error: null };
    },
  };
  return {
    calls,
    env: {
      APP_ENV: "production",
      NODE_ENV: "test",
      JWT_SECRET,
      TEST_SUPABASE_CLIENT: supabase,
      REPORT_EXPORT_BUCKET: handlers.bucket,
    },
  };
}

function row(index) {
  return {
    id: `employee-${index}`,
    employee: `Employee ${index}`,
    employee_code: `KIS${index}`,
    department: "IT",
    job_title: "Specialist",
    assigned: 2,
    completed: 1,
    in_progress: 1,
    not_started: 0,
    overdue: 0,
    completion_rate: 50,
    last_activity_at: "2026-07-28T00:00:00Z",
    sort_name: `employee ${String(index).padStart(6, "0")}`,
  };
}

function harness({ failUpload = false } = {}) {
  const calls = { claim: 0, chunks: 0, complete: 0, fail: 0, uploads: 0, aborts: 0 };
  const supabase = {
    rpc: async (name) => {
      if (name === "service_claim_export_job") {
        calls.claim += 1;
        if (calls.claim > 1) return { data: { claimed: false, state: "completed" }, error: null };
        return { data: { claimed: true, id: "00000000-0000-4000-8000-000000000001", requester_id: "hr-1", report_type: "employees", format: "csv", parameters: {}, permission_snapshot: { role: "hr" }, attempt_count: 1, max_attempts: 5 }, error: null };
      }
      if (name === "service_authorize_export_requester") return { data: { active: true, role: "hr" }, error: null };
      if (name === "service_report_detail_export") {
        calls.chunks += 1;
        return { data: { rows: calls.chunks === 1 ? [row(1), row(2)] : [], hasMore: false, nextPosition: null }, error: null };
      }
      if (name === "service_update_export_job_progress") return { data: true, error: null };
      if (name === "service_complete_export_job") { calls.complete += 1; return { data: true, error: null }; }
      if (name === "service_fail_export_job") { calls.fail += 1; return { data: { retry: true }, error: null }; }
      return { data: null, error: null };
    },
  };
  const bucket = {
    createMultipartUpload: () => ({
      uploadPart: async () => {
        calls.uploads += 1;
        if (failUpload) throw new Error("R2_TEMPORARY_FAILURE");
        return { etag: `etag-${calls.uploads}` };
      },
      complete: async () => {},
      abort: async () => { calls.aborts += 1; },
    }),
  };
  return { calls, env: { SUPABASE_CLIENT: supabase, REPORT_EXPORT_BUCKET: bucket } };
}

test("EXPORT-001: queue payload redelivery is idempotent and creates one object", async () => {
  const { calls, env } = harness();
  const message = { body: { version: 1, jobId: "00000000-0000-4000-8000-000000000001" } };
  assert.deepEqual(await processExportMessage(message, env), { ack: true, state: "completed" });
  assert.deepEqual(await processExportMessage(message, env), { ack: true, state: "completed" });
  assert.equal(calls.uploads, 1);
  assert.equal(calls.complete, 1);
  assert.equal(calls.claim, 2);
});

test("EXPORT-002: retryable R2 failures abort multipart upload and return retry", async () => {
  const { calls, env } = harness({ failUpload: true });
  const result = await processExportMessage({ body: { version: 1, jobId: "00000000-0000-4000-8000-000000000001" } }, env);
  assert.equal(result.retry, true);
  assert.equal(result.ack, false);
  assert.equal(calls.aborts, 1);
  assert.equal(calls.fail, 1);
});

test("EXPORT-003: job parameters are allowlisted and bindings fail only the export feature", () => {
  assert.deepEqual(sanitizeExportParameters({ fromDate: "2026-01-01", toDate: "2026-02-01", department: "IT", token: "secret", q: "name" }), {
    fromDate: "2026-01-01", toDate: "2026-02-01", fromIso: "", toIsoExclusive: "", department: "IT",
    jobTitle: "", employeeId: "", courseId: "", status: "", q: "name", sortDir: "asc",
  });
  assert.throws(() => validateExportBinding({}), /REPORT_EXPORT_QUEUE_MISSING/);
  assert.doesNotThrow(() => validateExportBinding({ REPORT_EXPORT_QUEUE: {}, REPORT_EXPORT_BUCKET: {} }));
});

test("EXPORT-004: migration enforces owner authorization, leases, expiry and private grants", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260728032000_background_export_jobs.sql", import.meta.url), "utf8");
  assert.match(sql, /status in \('queued','running','completed','failed','cancelled','expired'\)/);
  assert.match(sql, /unique \(requester_id, idempotency_key\)/);
  assert.match(sql, /lease_expires_at > now\(\)/);
  assert.match(sql, /requester_id = p_requester_id or p_is_admin/);
  assert.match(sql, /revoke all on table private\.export_jobs from public, anon, authenticated/);
  assert.match(sql, /service_export_employee_chunk[\s\S]*limit least\(1000/);
  assert.match(sql, /status = 'running'[\s\S]*EXPORT_LEASE_EXPIRED/);
  assert.match(sql, /status in \('queued','running','completed','failed','cancelled'\)/);
});

test("EXPORT-005: queue messages and stored parameters contain no credential material", () => {
  const source = readFileSync(new URL("../../worker/services/export-jobs.js", import.meta.url), "utf8");
  assert.match(source, /queue\.send\(\{ version: QUEUE_MESSAGE_VERSION, kind: "report_export", jobId: data\.id \}\)/);
  assert.doesNotMatch(source, /queue\.send\([^\n]*(token|secret|authorization|cookie)/i);
  assert.doesNotMatch(source, /sanitizeExportParameters[\s\S]{0,900}(password|mfa|recovery|session)/i);
});

test("EXPORT-006: HR can read only through the owner-bound RPC contract", async () => {
  const jobId = "00000000-0000-4000-8000-000000000001";
  const { calls, env } = exportRouteEnv("hr", {
    service_get_export_job: async () => ({ data: { id: jobId, status: "queued" }, error: null }),
  });
  const response = await handleReportExports(await exportRequest(`/api/admin/report-exports/${jobId}`, "hr"), env);
  assert.equal(response.status, 200);
  const read = calls.find((call) => call.name === "service_get_export_job");
  assert.equal(read.params.p_requester_id, "hr-owner");
  assert.equal(read.params.p_is_admin, false);
});

test("EXPORT-007: admin cross-owner access is explicit and role downgrade blocks download", async () => {
  const jobId = "00000000-0000-4000-8000-000000000002";
  const adminHarness = exportRouteEnv("admin", {
    service_get_export_job: async () => ({ data: { id: jobId, status: "completed" }, error: null }),
  });
  const adminResponse = await handleReportExports(await exportRequest(`/api/admin/report-exports/${jobId}`, "admin"), adminHarness.env);
  assert.equal(adminResponse.status, 200);
  assert.equal(adminHarness.calls.find((call) => call.name === "service_get_export_job").params.p_is_admin, true);

  let downloadLookupCalled = false;
  const downgradedHarness = exportRouteEnv("employee", {
    service_get_export_download: async () => {
      downloadLookupCalled = true;
      return { data: { available: true, object_key: "private/should-not-load" }, error: null };
    },
  });
  const downgraded = await handleReportExports(await exportRequest(`/api/admin/report-exports/${jobId}/download`, "employee", "former-hr"), downgradedHarness.env);
  assert.equal(downgraded.status, 403);
  assert.equal(downloadLookupCalled, false);
});

test("EXPORT-008: expired downloads return 410 without touching R2", async () => {
  const jobId = "00000000-0000-4000-8000-000000000003";
  let bucketRead = false;
  const { env } = exportRouteEnv("hr", {
    service_get_export_download: async () => ({ data: { available: false, state: "expired" }, error: null }),
    bucket: { get: async () => { bucketRead = true; return null; } },
  });
  const response = await handleReportExports(await exportRequest(`/api/admin/report-exports/${jobId}/download`, "hr"), env);
  assert.equal(response.status, 410);
  assert.equal(bucketRead, false);
});

test("EXPORT-009: Wrangler config sends exhausted deliveries to a dead-letter queue", () => {
  const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(wrangler, /dead_letter_queue/);
  assert.match(wrangler, /mykis-report-exports-dlq/);
  assert.match(wrangler, /mykis-report-exports-local-dlq/);
});

test("EXPORT-010: create, start, success, failure, cancel and download are audited", () => {
  const service = readFileSync(new URL("../../worker/services/export-jobs.js", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../worker/routes/report-exports.js", import.meta.url), "utf8");
  for (const action of ["report.export_job_created", "report.export_job_started", "report.export_job_completed", "report.export_job_failed", "report.export_job_cancelled"]) {
    assert.match(service, new RegExp(action.replaceAll(".", "\\.")));
  }
  assert.match(route, /report\.export_job_downloaded/);
});
