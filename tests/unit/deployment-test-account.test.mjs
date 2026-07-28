import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  deploymentTestAccountForLogin,
  deploymentTestAccounts,
  deploymentTestAccountsEnabled,
  isReservedDeploymentTestProfile,
} from "../../worker/services/deployment-test-account.js";

const secretEnv = {
  APP_ENV: "production",
  DEPLOYMENT_TEST_ACCOUNT_ENABLED: "true",
  DEPLOYMENT_TEST_ACCOUNTS: JSON.stringify([
    { username: "opaque-user", password: "opaque-password", role: "employee" },
    { username: "opaque-admin", password: "opaque-admin-password", role: "admin" },
  ]),
};

test("DEPLOY-TEST-001: deployment test accounts are enabled only for HTTPS deploy runtimes", () => {
  assert.deepEqual(deploymentTestAccounts(secretEnv).map(({ username, role }) => ({ username, role })), [
    { username: "opaque-user", role: "employee" },
    { username: "opaque-admin", role: "admin" },
  ]);
  assert.equal(deploymentTestAccountsEnabled(new Request("https://lms.example.test/login"), secretEnv), true);
  assert.equal(deploymentTestAccountsEnabled(new Request("http://lms.example.test/login"), secretEnv), false);
  assert.equal(deploymentTestAccountsEnabled(new Request("https://localhost/login"), secretEnv), false);
  assert.equal(deploymentTestAccountsEnabled(new Request("https://lms.example.test/login"), { ...secretEnv, APP_ENV: "development" }), false);
  assert.equal(deploymentTestAccountsEnabled(new Request("https://lms.example.test/login"), { ...secretEnv, DEPLOYMENT_TEST_ACCOUNTS: "[]" }), false);
  assert.equal(deploymentTestAccountForLogin(new Request("https://lms.example.test/login"), secretEnv, "OPAQUE-ADMIN")?.role, "admin");
  assert.equal(isReservedDeploymentTestProfile({ id: "deployment-test:opaque-user" }), true);
});

test("DEPLOY-TEST-002: deployment account controls are absent from public source", async () => {
  const publicSource = await Promise.all([
    readFile(new URL("../../src/features/auth/login.js", import.meta.url), "utf8"),
    readFile(new URL("../../app.js", import.meta.url), "utf8"),
    readFile(new URL("../../index.html", import.meta.url), "utf8"),
  ]);
  for (const source of publicSource) {
    assert.doesNotMatch(source, /DEPLOYMENT_TEST_PASSWORD/);
    assert.doesNotMatch(source, /opaque-password/);
  }
});
