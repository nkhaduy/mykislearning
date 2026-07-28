import test from "node:test";
import assert from "node:assert/strict";
import { canonicalize, verifyStagingTarget } from "../../scripts/staging/staging-contract.mjs";

const base = {
  KIS_ALLOW_STAGING_MUTATION: "true",
  APP_ENV: "staging",
  KIS_STAGING_CLOUDFLARE_ACCOUNT_ID: "b9ae472cee29c5729ee90ccbb3533f33",
  KIS_STAGING_WORKER_NAME: "mykis-learning-staging",
  KIS_STAGING_HOSTNAME: "mykis-learning-staging.nkhaduy.workers.dev",
  KIS_STAGING_QUEUE_NAME: "kis-lms-export-staging",
  KIS_STAGING_DLQ_NAME: "kis-lms-export-dlq-staging",
  KIS_STAGING_R2_BUCKET_NAME: "kis-lms-exports-staging",
  KIS_STAGING_SUPABASE_PROJECT_REF: "stagingproject123456789",
  KIS_STAGING_SUPABASE_URL: "https://stagingproject123456789.supabase.co",
  KIS_STAGING_DATABASE_URL: "postgresql://postgres:secret@db.stagingproject123456789.supabase.co:5432/postgres",
  KIS_STAGING_APPROVAL_ID: "OWNER-STAGING-20260728T000000Z-e0ff4f9b",
  KIS_STAGING_APPROVED_BY: "local-system-owner",
  KIS_STAGING_CHANGE_OWNER: "local-system-owner",
  KIS_STAGING_ROLLBACK_OWNER: "local-system-owner",
  KIS_STAGING_BACKUP_OR_CLONE_ID: "SUPABASE-FRESH-STAGINGPROJECT123456789",
};

test("canonical contract accepts canonical values and defaults denylist", () => {
  const summary = verifyStagingTarget(base);
  assert.equal(summary.environment, "staging");
  assert.equal(summary.workerName, "mykis-learning-staging");
  assert.equal(summary.supabaseProjectRef, "stag...6789");
});

test("legacy aliases normalize to canonical fields", () => {
  const input = { ...base, KIS_STAGING_PROJECT_REF: base.KIS_STAGING_SUPABASE_PROJECT_REF };
  delete input.KIS_STAGING_SUPABASE_PROJECT_REF;
  assert.equal(canonicalize(input).KIS_STAGING_SUPABASE_PROJECT_REF, "stagingproject123456789");
});

test("conflicting aliases fail closed", () => {
  assert.throws(() => canonicalize({ ...base, KIS_STAGING_PROJECT_REF: "different123456789" }), /conflicts/);
});

for (const hostname of ["KISLMS.SITE", "kislms.site.", "kislms。site", "https://kislms.site/%2e%2e"]) {
  test(`production hostname bypass is refused: ${hostname}`, () => {
    assert.throws(() => verifyStagingTarget({ ...base, KIS_STAGING_HOSTNAME: hostname }), /staging hostname|percent-encoded|invalid/);
  });
}

test("production resource and project denylist cannot be bypassed by case", () => {
  assert.throws(() => verifyStagingTarget({ ...base, KIS_STAGING_WORKER_NAME: "MYKIS-LEARNING" }), /production/);
  assert.throws(() => verifyStagingTarget({ ...base, KIS_STAGING_SUPABASE_PROJECT_REF: "MOOQDTIEDFAMNLPITQTQ", KIS_STAGING_SUPABASE_URL: "https://mooqdtiedfamnlpitqtq.supabase.co", KIS_STAGING_DATABASE_URL: "postgresql://postgres:secret@db.mooqdtiedfamnlpitqtq.supabase.co:5432/postgres" }), /production|unknown-denied/);
});

test("transaction pooler is accepted only when username binds the staging ref", () => {
  const pooler = { ...base, KIS_STAGING_DATABASE_URL: "postgresql://postgres.stagingproject123456789:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres" };
  assert.equal(verifyStagingTarget(pooler).databaseHostname, "aws-1-ap-northeast-2.pooler.supabase.com");
  assert.throws(() => verifyStagingTarget({ ...pooler, KIS_STAGING_DATABASE_URL: "postgresql://postgres.otherproject:secret@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres" }), /identity does not match/);
});
