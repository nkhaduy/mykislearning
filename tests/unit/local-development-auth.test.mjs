import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  LOCAL_ADMIN_EMAIL,
  LOCAL_ADMIN_PROFILE_ID,
  isReservedLocalAdminProfile,
  localDevelopmentAdminCredentials,
  localDevelopmentAdminEnabled,
} from "../../worker/services/local-development.js";
import { hasAdministrativeAccess } from "../../worker/middleware/auth.js";

const localEnv = {
  APP_ENV: "development",
  LOCAL_DEV_ADMIN_ENABLED: "true",
  SUPABASE_URL: "http://127.0.0.1:54321",
};

test("DEV-AUTH-001: local admin requires local runtime, app host, and database", () => {
  assert.equal(localDevelopmentAdminEnabled(new Request("http://127.0.0.1:8787/login"), localEnv), true);
  assert.equal(localDevelopmentAdminEnabled(new Request("https://lms.example.com/login"), localEnv), false);
  assert.equal(localDevelopmentAdminEnabled(new Request("http://127.0.0.1:8787/login"), { ...localEnv, SUPABASE_URL: "https://project.supabase.co" }), false);
  assert.equal(localDevelopmentAdminEnabled(new Request("http://127.0.0.1:8787/login"), { ...localEnv, APP_ENV: "production" }), false);
  assert.equal(localDevelopmentAdminEnabled(new Request("http://127.0.0.1:8787/login"), { ...localEnv, NODE_ENV: "production" }), false);
  assert.equal(localDevelopmentAdminEnabled(new Request("http://127.0.0.1:8787/login"), { ...localEnv, LOCAL_DEV_ADMIN_ENABLED: "false" }), false);
});

test("DEV-AUTH-002: local defaults and reserved profile stay server-side", () => {
  assert.deepEqual(localDevelopmentAdminCredentials({}), { username: "1", password: "1" });
  assert.equal(isReservedLocalAdminProfile({ id: LOCAL_ADMIN_PROFILE_ID }), true);
  assert.equal(isReservedLocalAdminProfile({ email: LOCAL_ADMIN_EMAIL }), true);
  for (const file of ["src/features/auth/login.js", "app.js", "index.html"]) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.equal(source.includes(LOCAL_ADMIN_EMAIL), false, `${file} exposes the reserved local profile`);
    assert.equal(source.includes("LOCAL_DEV_ADMIN_PASSWORD"), false, `${file} exposes the local credential control`);
  }
});

test("AUTHZ-ADMIN-001: admin and HR share administrative route privileges", () => {
  assert.equal(hasAdministrativeAccess("hr"), true);
  assert.equal(hasAdministrativeAccess("admin"), true);
  assert.equal(hasAdministrativeAccess("employee"), false);

  const routeFiles = [
    "worker/routes/courses.js", "worker/routes/enrollments.js", "worker/routes/quizzes.js",
    "worker/routes/notifications.js", "worker/routes/content-progress.js", "worker/routes/training.js",
    "worker/routes/external-training.js", "worker/routes/employees.js", "worker/routes/learning-records.js",
  ];
  for (const file of routeFiles) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /acct\.role\s*(?:===|!==)\s*["']hr["']/, `${file} bypasses the shared admin-role helper`);
  }
});
