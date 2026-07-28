import test from "node:test";
import assert from "node:assert/strict";

import { assertSafeE2ETarget, isProductionTarget } from "../../scripts/assert-safe-e2e-target.mjs";
import { verifyStagingTarget } from "../../scripts/verify-staging-target.mjs";
import { isKnownAppRoute, isPrivateAppRoute } from "../../worker/services/route-policy.js";

test("ARCH-005: production Worker is recognized as a protected target", () => {
  assert.equal(isProductionTarget("https://mykis-learning.nkhaduy.workers.dev"), true);
});

test("ARCH-005: mutation E2E refuses production even with an explicit mutation flag", () => {
  assert.throws(() => assertSafeE2ETarget({
    baseURL: "https://mykis-learning.nkhaduy.workers.dev",
    suite: "mutation",
    mutationAllowed: true,
  }), /Refusing mutation E2E/);
});

test("ARCH-005: mutation E2E requires explicit opt-in", () => {
  assert.throws(() => assertSafeE2ETarget({
    baseURL: "http://127.0.0.1:8787",
    suite: "mutation",
    mutationAllowed: false,
  }), /disabled/);
});

test("ARCH-005: public read-only suite can target production without mutation", () => {
  assert.equal(assertSafeE2ETarget({
    baseURL: "https://mykis-learning.nkhaduy.workers.dev",
    suite: "public-readonly",
    mutationAllowed: false,
  }), true);
});

test("ARCH-005: authenticated synthetic read-only suite does not require mutation opt-in", () => {
  assert.equal(assertSafeE2ETarget({
    baseURL: "http://127.0.0.1:4173",
    suite: "authenticated-readonly",
    mutationAllowed: false,
  }), true);
});

test("UX-003: route policy distinguishes implemented and unknown routes", () => {
  assert.equal(isKnownAppRoute("/dashboard/courses/course-123"), true);
  assert.equal(isKnownAppRoute("/does-not-exist"), false);
  assert.equal(isPrivateAppRoute("/admin/reports"), true);
  assert.equal(isPrivateAppRoute("/about-kis"), false);
});

function stagingTarget(overrides = {}) {
  return {
    KIS_ALLOW_STAGING_MUTATION: "true",
    APP_ENV: "staging",
    KIS_STAGING_CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    KIS_STAGING_WORKER_NAME: "mykis-learning-staging",
    KIS_STAGING_HOSTNAME: "mykis-learning-staging.example.workers.dev",
    KIS_STAGING_QUEUE_NAME: "kis-lms-export-staging",
    KIS_STAGING_DLQ_NAME: "kis-lms-export-dlq-staging",
    KIS_STAGING_R2_BUCKET_NAME: "kis-lms-exports-staging",
    KIS_STAGING_SUPABASE_PROJECT_REF: "stagingref1234567890",
    KIS_STAGING_SUPABASE_URL: "https://stagingref1234567890.supabase.co",
    KIS_STAGING_DATABASE_URL: "postgresql://postgres:password@db.stagingref1234567890.supabase.co:5432/postgres",
    KIS_STAGING_APPROVAL_ID: "OWNER-STAGING-20260728T000000Z-e0ff4f9b",
    KIS_STAGING_APPROVED_BY: "local-system-owner",
    KIS_STAGING_CHANGE_OWNER: "local-system-owner",
    KIS_STAGING_ROLLBACK_OWNER: "local-system-owner",
    KIS_STAGING_BACKUP_OR_CLONE_ID: "SUPABASE-FRESH-stagingref1234567890",
    ...overrides,
  };
}

test("OPS-001: staging target guard accepts a fully explicit isolated target", () => {
  const result = verifyStagingTarget(stagingTarget());
  assert.equal(result.environment, "staging");
  assert.equal(result.queueName, "kis-lms-export-staging");
});

test("OPS-001: staging target guard refuses a production hostname", () => {
  assert.throws(() => verifyStagingTarget(stagingTarget({
    KIS_STAGING_HOSTNAME: "kislms.site",
    KIS_STAGING_HOSTNAME_ALLOWLIST: "kislms.site",
  })), /not an allowed staging hostname/);
});

test("OPS-001: staging target guard refuses a production project or service key fingerprint", () => {
  assert.throws(() => verifyStagingTarget(stagingTarget({
    KIS_STAGING_SUPABASE_PROJECT_REF: "mooqdtiedfamnlpitqtq",
    KIS_STAGING_SUPABASE_URL: "https://mooqdtiedfamnlpitqtq.supabase.co",
    KIS_STAGING_DATABASE_URL: "postgresql://postgres:password@db.mooqdtiedfamnlpitqtq.supabase.co:5432/postgres",
  })), /production or unknown-denied/);
});

test("OPS-001: staging target guard requires an explicit mutation opt-in", () => {
  assert.throws(() => verifyStagingTarget(stagingTarget({ KIS_ALLOW_STAGING_MUTATION: "false" })), /must equal true/);
});
