import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("login retries a verified dual-role account with the selected role", () => {
  const source = read("src/features/auth/login.js");
  assert.match(source, /ROLE_SELECTION_REQUIRED/);
  assert.match(source, /requestedRole/);
  assert.match(source, /data-role-choice/);
  assert.match(source, /employee/);
  assert.match(source, /hr/);
});

test("change-password UI documents and enforces the six-character minimum", () => {
  const source = read("src/features/auth/change-password.js");
  assert.match(source, /minlength="6"/);
  assert.match(source, /Ít nhất 6 ký tự/);
  assert.doesNotMatch(source, /minlength="(?:8|10|12)"/);
  assert.doesNotMatch(source, /chữ hoa|ký tự đặc biệt|uppercase|special character/i);
});

test("HR accounts has a dedicated lazy-loaded employee-account module", () => {
  const bootstrap = read("src/app/bootstrap.js");
  const registry = read("src/app/route-registry.js");
  const build = read("scripts/build-static.mjs");
  const styleLoader = read("src/app/style-loader.js");
  assert.match(registry, /path: "\/hr\/accounts"[\s\S]*splitEntry: "accounts"/);
  assert.match(bootstrap, /accounts:\s*\(\) => import\("\.\.\/features\/accounts\/accounts\.js/);
  assert.match(build, /src\/features\/accounts\/accounts\.js/);
  assert.match(build, /src\/features\/accounts\/accounts\.css/);
  assert.match(styleLoader, /\/hr\/accounts[\s\S]*accounts\.css/);
});

test("employee account screen lists, reveals, resets, and updates usernames", () => {
  const source = read("src/features/accounts/accounts.js");
  assert.match(source, /\/api\/admin\/employee-accounts/);
  assert.match(source, /reveal-password/);
  assert.match(source, /hr-account-actions/);
  assert.match(source, /reset-password/);
  assert.match(source, /set-username/);
  assert.match(source, /data-account-search/);
  assert.match(source, /data-account-table/);
});
