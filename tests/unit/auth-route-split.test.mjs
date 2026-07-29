import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("PERF-005: login route loads its own module and stylesheet", () => {
  const bootstrap = read("src/app/bootstrap.js");
  const loader = read("src/app/style-loader.js");
  assert.match(bootstrap, /path === "\/login"[\s\S]*features\/auth\/login\.js/);
  assert.match(loader, /auth\/auth\.css/);
  assert.doesNotMatch(read("src/features/auth/login.js"), /import\s+[^;]+from\s+["'][^"']*app\.js/);
});

test("UX-002: split login keeps native form and legacy automation selectors", () => {
  const login = read("src/features/auth/login.js");
  assert.match(login, /id="loginForm" method="post" action="\/api\/auth\?action=login" autocomplete="on"/);
  assert.match(login, /id="loginEmail"[^>]*type="email"[^>]*autocomplete="email"[^>]*required/);
  assert.match(login, /id="loginPassword"[^>]*autocomplete="current-password"[^>]*required/);
  assert.match(login, /state\.passwordVisible \? "text" : "password"/);
  assert.match(login, /id="loginSubmitBtn"/);
});

test("UX-002: non-JSON auth responses become a localized system error", () => {
  const login = read("src/features/auth/login.js");
  assert.match(login, /contentType[\s\S]*!\/\\bjson\\b\/i[\s\S]*non_json/);
  assert.match(login, /state\.error = "system"/);
});

test("UX-004: post-login redirect remains internal and modal keyboard handling is present", () => {
  const login = read("src/features/auth/login.js");
  const bootstrap = read("src/app/bootstrap.js");
  const session = read("lib/services/sessionService.js");
  assert.match(session, /route\.startsWith\("\/\/"\)/);
  assert.match(session, /consumePostLoginRedirect\(fallback = "\/dashboard"\)/);
  assert.match(login, /isSafeReturnTo\(route\)/);
  assert.match(login, /\/admin[\s\S]*\/hr/);
  assert.match(login, /\["hr", "employee"\]\.includes\(role\)/);
  assert.doesNotMatch(login, /profile\.role === "hr" \? profile\.role : "employee"/);
  assert.match(login, /isReturnToAllowedForRole\(state\.returnTo, role\)/);
  assert.match(login, /auth-destination/);
  assert.match(bootstrap, /fetch\("\/api\/auth\?action=session"/);
  assert.match(bootstrap, /location\.replace\(`\/login\?returnTo=/);
  assert.match(login, /event\.key === "Escape"/);
  assert.match(login, /event\.key !== "Tab"/);
  assert.match(login, /supportReturnFocus[\s\S]*querySelector\("\[data-support-open\]"\)\?\.focus/);
});

test("AUTHZ-ROLE-001: role inputs are canonical and legacy values fail closed", () => {
  const auth = read("worker/routes/auth.js");
  const employees = read("worker/routes/employees.js");
  assert.match(auth, /CANONICAL_ROLES\s*=\s*new Set\(\["hr", "employee"\]\)/);
  assert.match(auth, /if \(!CANONICAL_ROLES\.has\(role\)\) return json\(\{ error: "INVALID_ROLE" \}, 400\)/);
  assert.match(employees, /if \(!\["hr", "employee"\]\.includes\(patch\.role\)\) return json\(\{ error: "INVALID_ROLE" \}, 400\)/);
});

test("UX-005: account security route manages server-side sessions without MFA UI", () => {
  const security = read("src/features/auth/security.js");
  assert.match(security, /api\/auth\?action=sessions/);
  assert.match(security, /api\/auth\?action=revoke-session/);
  assert.match(security, /api\/auth\?action=logout-all/);
  assert.doesNotMatch(security, /MFA|TOTP|step-up|recoveryCode/);
});
