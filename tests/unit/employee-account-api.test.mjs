import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isEmployeeAccountTarget } from "../../worker/routes/employee-accounts.js";

const routeSource = readFileSync(new URL("../../worker/routes/employee-accounts.js", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../../worker/router.js", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../../worker/routes/account-support.js", import.meta.url), "utf8");

test("employee account target checks reject HR and self-management", () => {
  assert.equal(isEmployeeAccountTarget({ id: "emp-1", role: "employee" }, "hr-1"), true);
  assert.equal(isEmployeeAccountTarget({ id: "hr-2", role: "hr" }, "hr-1"), false);
  assert.equal(isEmployeeAccountTarget({ id: "hr-1", role: "employee" }, "hr-1"), false);
});

test("HR account APIs expose employee metadata without credential material", () => {
  assert.match(routerSource, /\/api\/admin\/employee-accounts/);
  assert.match(routeSource, /service_list_employee_accounts/);
  assert.match(routeSource, /reveal-password/);
  assert.match(routeSource, /decryptEscrowPassword/);
  assert.doesNotMatch(routeSource, /password_hash|p_password_hash/);
});

test("password reveal is rate limited, audited, and never cached", () => {
  assert.match(routeSource, /enforceRateLimit[\s\S]*employee-password-reveal/);
  assert.match(routeSource, /account\.password_revealed/);
  assert.match(routeSource, /["']Cache-Control["']:\s*["']no-store["']/);
});

test("existing HR account actions reject non-employee targets", () => {
  assert.match(supportSource, /target\.role !== "employee"/);
  assert.match(supportSource, /EMPLOYEE_ACCOUNT_REQUIRED/);
});
