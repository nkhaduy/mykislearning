# Employee Account Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `nkhaduy` select an authorized Employee or HR session, reduce the password minimum to six characters, and provide an HR-only employee account tab with audited encrypted password reveal.

**Architecture:** Supabase remains the source of truth for login identities, role grants, credential hashes, session roles, and encrypted escrow records. Cloudflare Workers resolve identifiers, enforce role grants, hash passwords for authentication, encrypt/decrypt escrow values with Web Crypto, and expose narrowly scoped HR APIs. Separate browser modules handle login role selection and employee-account administration without importing the legacy monolith.

**Tech Stack:** Cloudflare Workers, Web Crypto AES-GCM/PBKDF2, Supabase Postgres RPCs and private schema tables, vanilla ES modules, Node.js `node:test`, Playwright, Wrangler.

## Global Constraints

- Passwords are valid only when their length is between 6 and 256 characters; no composition rule is allowed.
- PBKDF2 hashes remain the sole authentication source.
- Escrow ciphertext, IVs, hashes, tokens, and secrets never appear in employee-account list responses or audit payloads.
- Only server-side role grants can authorize an effective session role.
- Only `employee` targets can be managed or revealed from the HR account tab.
- `PASSWORD_ESCROW_KEY` is a versioned JSON Worker secret and is never committed.
- Existing passwords without escrow remain `unavailable_until_reset`.
- Every schema-definer RPC sets `search_path = ''`, revokes `PUBLIC`, `anon`, and `authenticated`, and grants only `service_role`.

---

### Task 1: Database identity, role-grant, session-role, and escrow schema

**Files:**
- Modify: `supabase/migrations/20260810061944_employee_account_auth.sql`
- Test: `tests/unit/employee-account-auth-migration.test.mjs`

**Interfaces:**
- Produces: `public.service_resolve_login_identity(text) -> jsonb`
- Produces: `public.service_list_employee_accounts(text,text,integer,integer) -> setof record`
- Produces: `public.service_read_password_escrow(text) -> jsonb`
- Produces: `public.service_write_credential_bundle(text,text,boolean,text,text,text) -> boolean`
- Produces: `public.service_write_login_username(text,text) -> boolean`
- Produces: `private.account_login_identities`, `private.account_role_grants`, `private.password_escrow`
- Produces: `private.auth_sessions.effective_role`

- [ ] **Step 1: Write the failing migration contract test**

```js
test("AUTH-ACCOUNT-001: migration isolates identities, grants, and escrow", () => {
  assert.match(sql, /create table if not exists private\.account_login_identities/i);
  assert.match(sql, /create table if not exists private\.account_role_grants/i);
  assert.match(sql, /create table if not exists private\.password_escrow/i);
  assert.match(sql, /add column if not exists effective_role text/i);
  assert.match(sql, /service_resolve_login_identity/i);
  assert.match(sql, /service_list_employee_accounts/i);
  assert.match(sql, /service_write_credential_bundle/i);
  assert.match(sql, /revoke all on function[\s\S]*anon, authenticated/i);
  assert.doesNotMatch(sql, /plaintext_password|password_plain/i);
});
```

- [ ] **Step 2: Run the migration contract test and verify RED**

Run: `node --test tests/unit/employee-account-auth-migration.test.mjs`

Expected: FAIL because the migration is empty and the contract symbols are absent.

- [ ] **Step 3: Implement the private schema and RPC migration**

Use normalized lowercase usernames, deterministic collision suffixes, and explicit role grants:

```sql
create table if not exists private.account_login_identities (
  profile_id text primary key references public.profiles(id) on delete cascade,
  username text not null unique,
  updated_at timestamptz not null default now(),
  check (username = lower(username)),
  check (username ~ '^[a-z0-9._-]{1,80}$')
);

create table if not exists private.account_role_grants (
  profile_id text not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('employee', 'hr')),
  granted_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create table if not exists private.password_escrow (
  profile_id text primary key references public.profiles(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  key_version text not null,
  updated_at timestamptz not null default now()
);
```

Backfill one role grant per canonical profile, give the profile whose username is `nkhaduy` both grants, backfill `effective_role`, and update session RPCs so their returned `role` is the effective role only while the grant exists. Implement login resolution with precedence `email -> username -> employee_code`; return `{status:'ambiguous'}` when more than one best-rank row exists. Account listing must select only profiles having an `employee` grant and must return booleans rather than credential material.

- [ ] **Step 4: Run migration contract and existing SQL security tests**

Run: `node --test tests/unit/employee-account-auth-migration.test.mjs tests/security/auth-hardening.test.mjs tests/unit/rls-migration.test.mjs tests/unit/schema-normalization-contract.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit the schema task**

```bash
git add supabase/migrations/20260810061944_employee_account_auth.sql tests/unit/employee-account-auth-migration.test.mjs
git commit -m "feat: add employee login identity and escrow schema"
```

### Task 2: Effective-role sessions and six-character password policy

**Files:**
- Modify: `worker/services/auth-sessions.js`
- Modify: `worker/routes/auth.js`
- Modify: `worker/services/credentials.js`
- Test: `tests/unit/employee-login-role.test.mjs`
- Test: `tests/unit/password-policy.test.mjs`
- Modify: `tests/security/auth-hardening.test.mjs`

**Interfaces:**
- Consumes: `service_resolve_login_identity`, role-aware session RPCs, `service_write_credential_bundle`
- Produces: `validatePasswordInput(password, { currentPassword }) -> string`
- Produces: login request field `requestedRole: 'employee' | 'hr' | undefined`
- Produces: session profile `role` equal to the server-authorized effective role

- [ ] **Step 1: Write failing tests for role selection and password validation**

```js
test("nkhaduy can request either granted role", async () => {
  assert.deepEqual(selectEffectiveRole(["employee", "hr"], "employee"), "employee");
  assert.deepEqual(selectEffectiveRole(["employee", "hr"], "hr"), "hr");
});

test("a six-character password is valid without composition rules", () => {
  assert.equal(validatePasswordInput("abcdef"), "abcdef");
  assert.throws(() => validatePasswordInput("abcde"), /INVALID_PASSWORD/);
  assert.throws(() => validatePasswordInput("abcdef", { currentPassword: "abcdef" }), /PASSWORD_REUSED/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/unit/employee-login-role.test.mjs tests/unit/password-policy.test.mjs`

Expected: FAIL because exported helpers and role-aware auth behavior do not exist.

- [ ] **Step 3: Implement role selection and authoritative password validation**

Add exported pure helpers to `worker/routes/auth.js`:

```js
export function selectEffectiveRole(allowedRoles, requestedRole) {
  const allowed = [...new Set((allowedRoles || []).filter((role) => ["employee", "hr"].includes(role)))];
  const requested = String(requestedRole || "").trim().toLowerCase();
  if (requested) {
    if (!allowed.includes(requested)) throw Object.assign(new Error("INVALID_CREDENTIALS"), { status: 401, code: "INVALID_CREDENTIALS" });
    return requested;
  }
  if (allowed.length === 1) return allowed[0];
  throw Object.assign(new Error("ROLE_SELECTION_REQUIRED"), { status: 422, code: "ROLE_SELECTION_REQUIRED" });
}

export function validatePasswordInput(password, { currentPassword = null } = {}) {
  const value = String(password ?? "");
  if (value.length < 6 || value.length > 256) throw Object.assign(new Error("INVALID_PASSWORD"), { status: 422, code: "INVALID_PASSWORD" });
  if (currentPassword !== null && value === String(currentPassword)) throw Object.assign(new Error("PASSWORD_REUSED"), { status: 422, code: "PASSWORD_REUSED" });
  return value;
}
```

Replace the direct email lookup with `service_resolve_login_identity`, select an effective role only after password verification, and pass that role into `createAuthSession`. Make `verifySession` trust only the role returned by the role-aware session RPC. Apply `validatePasswordInput` to create-user, reset-password, and change-password.

- [ ] **Step 4: Run auth and session tests**

Run: `node --test tests/unit/employee-login-role.test.mjs tests/unit/password-policy.test.mjs tests/security/auth-hardening.test.mjs tests/security/auth-middleware.test.mjs tests/unit/deployment-test-account.test.mjs tests/unit/local-development-auth.test.mjs`

Expected: PASS with existing local/deployment behavior unchanged.

- [ ] **Step 5: Commit effective-role authentication**

```bash
git add worker/services/auth-sessions.js worker/routes/auth.js worker/services/credentials.js tests/unit/employee-login-role.test.mjs tests/unit/password-policy.test.mjs tests/security/auth-hardening.test.mjs
git commit -m "feat: authorize selectable account roles"
```

### Task 3: AES-GCM password escrow service and credential bundle writes

**Files:**
- Create: `worker/services/password-escrow.js`
- Modify: `worker/services/credentials.js`
- Modify: `worker/routes/auth.js`
- Modify: `worker/routes/account-support.js`
- Test: `tests/unit/password-escrow.test.mjs`
- Modify: `tests/security/auth-hardening.test.mjs`

**Interfaces:**
- Produces: `encryptEscrowPassword(password, profileId, env) -> { ciphertext, iv, keyVersion }`
- Produces: `decryptEscrowPassword(record, profileId, env) -> string`
- Produces: `writeCredentialBundle(supabase, profileId, passwordHash, escrow, { mustChange }) -> Promise<void>`
- Consumes: `PASSWORD_ESCROW_KEY`, a JSON object with `active` and `keys` fields whose selected value decodes to exactly 32 bytes

- [ ] **Step 1: Write failing Web Crypto tests**

```js
const env = { PASSWORD_ESCROW_KEY: JSON.stringify({ active: "v1", keys: { v1: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8" } }) };

test("escrow encrypts with unique IVs and decrypts only for the bound profile", async () => {
  const first = await encryptEscrowPassword("abcdef", "emp-1", env);
  const second = await encryptEscrowPassword("abcdef", "emp-1", env);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.equal(await decryptEscrowPassword(first, "emp-1", env), "abcdef");
  await assert.rejects(() => decryptEscrowPassword(first, "emp-2", env));
});
```

- [ ] **Step 2: Run escrow tests and verify RED**

Run: `node --test tests/unit/password-escrow.test.mjs`

Expected: FAIL because `worker/services/password-escrow.js` is missing.

- [ ] **Step 3: Implement versioned AES-GCM encryption**

Use `crypto.getRandomValues(new Uint8Array(12))`, a 256-bit imported AES-GCM key, the profile ID as `additionalData`, and base64url serialization. Reject missing, malformed, non-32-byte, unknown-version, and decryption-failure cases with `PASSWORD_ESCROW_UNAVAILABLE`; never include secret material in the error.

Update create, self-change, and both HR reset paths to:

```js
const passwordValue = validatePasswordInput(newPassword, { currentPassword });
const passwordHash = await hashPassword(passwordValue);
const escrow = await encryptEscrowPassword(passwordValue, profileId, env);
await writeCredentialBundle(supabase, profileId, passwordHash, escrow, { mustChange });
```

The bundle RPC must atomically update the hash metadata and escrow record. Existing `readCredential` remains hash-only.

- [ ] **Step 4: Run escrow, auth, audit-redaction, and reset tests**

Run: `node --test tests/unit/password-escrow.test.mjs tests/unit/password-policy.test.mjs tests/security/auth-hardening.test.mjs tests/security/rate-limit-hardening.test.mjs tests/unit/hr-creation-recovery.test.mjs`

Expected: PASS and no assertion finds plaintext password fields.

- [ ] **Step 5: Commit escrow support**

```bash
git add worker/services/password-escrow.js worker/services/credentials.js worker/routes/auth.js worker/routes/account-support.js tests/unit/password-escrow.test.mjs tests/security/auth-hardening.test.mjs
git commit -m "feat: encrypt employee password escrow"
```

### Task 4: HR employee-account APIs and target authorization

**Files:**
- Create: `worker/routes/employee-accounts.js`
- Modify: `worker/router.js`
- Modify: `worker/routes/account-support.js`
- Test: `tests/unit/employee-account-api.test.mjs`
- Modify: `tests/security/auth-hardening.test.mjs`

**Interfaces:**
- Produces: `GET /api/admin/employee-accounts?search=&status=&page=&pageSize=`
- Produces: `POST /api/admin/employee-accounts/:id/reveal-password`
- Produces: `POST /api/admin/hr-account-actions` actions `unlock`, `disable`, `enable`, `reset-password`, `revoke-sessions`, `set-username`
- Consumes: account listing/read escrow RPCs and `decryptEscrowPassword`

- [ ] **Step 1: Write failing API contract and authorization tests**

```js
test("employee account responses exclude credential material", () => {
  assert.match(routeSource, /service_list_employee_accounts/);
  assert.doesNotMatch(routeSource, /password_hash|ciphertext|service_read_account_credential/);
});

test("standalone account actions reject HR targets", () => {
  assert.match(actionSource, /target\.role !== "employee"[\s\S]*EMPLOYEE_TARGET_REQUIRED/);
});
```

- [ ] **Step 2: Run API tests and verify RED**

Run: `node --test tests/unit/employee-account-api.test.mjs tests/security/auth-hardening.test.mjs`

Expected: FAIL because the route and target guard are missing.

- [ ] **Step 3: Implement safe list and reveal endpoints**

Require `requirePrivilegedSession` for every route. Bound search to 80 characters, status to known values, page size to 10-100, and page to positive integers. Map rows to:

```js
{
  id, fullName, employeeCode, email, username, department,
  accountStatus, credentialConfigured, mustChange,
  escrowAvailable, failedLoginCount, lockedUntil, lastLoginAt
}
```

For reveal, fetch the target profile and encrypted record, confirm the target has an employee grant, enforce rate limit scope `employee-password-reveal` using `${caller.accountId}:${targetId}`, decrypt, write awaited critical audit action `account.password_revealed_by_hr`, and return `Cache-Control: no-store` with `{ password, expiresInSeconds: 30 }`. Return `PASSWORD_UNAVAILABLE_UNTIL_RESET` when no escrow exists.

Add the same employee-target guard to every HR account action and implement session revocation and normalized username updates.

- [ ] **Step 4: Run API/security tests**

Run: `node --test tests/unit/employee-account-api.test.mjs tests/security/auth-hardening.test.mjs tests/security/auth-middleware.test.mjs tests/security/rate-limit-hardening.test.mjs`

Expected: PASS with employee-only authorization enforced.

- [ ] **Step 5: Commit employee-account APIs**

```bash
git add worker/routes/employee-accounts.js worker/router.js worker/routes/account-support.js tests/unit/employee-account-api.test.mjs tests/security/auth-hardening.test.mjs
git commit -m "feat: add HR employee account APIs"
```

### Task 5: Login role selector and six-character browser validation

**Files:**
- Modify: `src/features/auth/login.js`
- Modify: `src/features/auth/change-password.js`
- Modify: `src/features/auth/auth.css`
- Modify: `tests/unit/auth-route-split.test.mjs`
- Modify: `tests/unit/login-contract.test.mjs`
- Test: `tests/unit/login-role-selector.test.mjs`

**Interfaces:**
- Consumes: login field `requestedRole`
- Produces: a visible Employee/HR radio group only for normalized identifier `nkhaduy`
- Produces: browser minimum length `6` for new-password fields

- [ ] **Step 1: Write failing browser-module contract tests**

```js
test("login renders a role selector for nkhaduy and submits requestedRole", () => {
  assert.match(login, /data-login-role="employee"/);
  assert.match(login, /data-login-role="hr"/);
  assert.match(login, /requestedRole/);
  assert.match(login, /normalizedIdentifier === "nkhaduy"/);
});

test("change password mirrors the six-character server policy", () => {
  assert.match(changePassword, /minlength="6"/);
  assert.doesNotMatch(changePassword, /uppercase|special character|ký tự đặc biệt/i);
});
```

- [ ] **Step 2: Run UI contract tests and verify RED**

Run: `node --test tests/unit/login-role-selector.test.mjs tests/unit/auth-route-split.test.mjs tests/unit/login-contract.test.mjs`

Expected: FAIL because the role selector and six-character rule are absent.

- [ ] **Step 3: Implement accessible role selection**

Keep `state.requestedRole = 'employee'`. Render a localized fieldset with two radios only when `state.email.trim().toLowerCase() === 'nkhaduy'`; update visibility during identifier input without storing a privileged decision outside the form. Submit:

```js
body: JSON.stringify({
  identifier,
  password,
  rememberMe: values.rememberMe === "on",
  ...(normalizedIdentifier === "nkhaduy" ? { requestedRole: state.requestedRole } : {}),
})
```

Add focus, selected, mobile, and error styles consistent with the existing auth visual language. Change password fields and localized copy to the six-character rule.

- [ ] **Step 4: Run auth UI tests**

Run: `node --test tests/unit/login-role-selector.test.mjs tests/unit/auth-route-split.test.mjs tests/unit/login-contract.test.mjs tests/unit/static-artifact.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit login UI**

```bash
git add src/features/auth/login.js src/features/auth/change-password.js src/features/auth/auth.css tests/unit/login-role-selector.test.mjs tests/unit/auth-route-split.test.mjs tests/unit/login-contract.test.mjs
git commit -m "feat: add authorized role selection to login"
```

### Task 6: Dedicated HR employee-account page

**Files:**
- Create: `src/features/accounts/accounts.js`
- Create: `src/features/accounts/accounts.css`
- Modify: `src/app/bootstrap.js`
- Modify: `src/app/style-loader.js`
- Modify: `src/app/route-registry.js`
- Modify: `scripts/build-static.mjs`
- Modify: `src/features/secondary/admin.js`
- Test: `tests/unit/employee-account-page.test.mjs`
- Modify: `tests/unit/route-registry-all.test.mjs`
- Modify: `tests/unit/static-artifact.test.mjs`

**Interfaces:**
- Consumes: employee-account list, reveal, and HR action endpoints
- Produces: split entry `accounts`
- Produces: search/filter table and account-action dialog with 30-second reveal clearing

- [ ] **Step 1: Write failing route and privacy contract tests**

```js
test("accounts is an independent production entry", () => {
  assert.match(registry, /path: "\/hr\/accounts"[^\n]*splitEntry: "accounts"/);
  assert.match(bootstrap, /accounts:\s*\(\)\s*=>\s*import\("\.\.\/features\/accounts\/accounts\.js/);
  assert.doesNotMatch(feature, /mockDatabase|app\.js|localStorage.*password/i);
});

test("revealed passwords are cleared on timeout and close", () => {
  assert.match(feature, /setTimeout\([\s\S]*30000/);
  assert.match(feature, /clearRevealedPassword/);
  assert.doesNotMatch(feature, /sessionStorage|localStorage/);
});
```

- [ ] **Step 2: Run account-page tests and verify RED**

Run: `node --test tests/unit/employee-account-page.test.mjs tests/unit/route-registry-all.test.mjs tests/unit/static-artifact.test.mjs`

Expected: FAIL because the split entry does not exist.

- [ ] **Step 3: Implement the employee-only account interface**

Build a responsive page using `createRouteShell` and `apiJson`. Include summary counts, search, status filters, table/card layouts, loading/error/empty states, and a modal containing unlock, disable/enable, revoke sessions, reset password, edit username, and reveal actions. Mask revealed values by default, require explicit confirmation before reveal, announce sensitive action results, add `autocomplete="new-password"`, and call `clearRevealedPassword()` on modal close, navigation/unload, action change, and after 30 seconds.

Remove `/hr/accounts` from the generic secondary config, register the new split entry and stylesheet, and copy both files in the static build.

- [ ] **Step 4: Run route, artifact, and page tests**

Run: `node --test tests/unit/employee-account-page.test.mjs tests/unit/route-registry-all.test.mjs tests/unit/route-split-navigation.test.mjs tests/unit/static-artifact.test.mjs tests/unit/performance-delivery.test.mjs`

Expected: PASS and artifact scan contains the new module without legacy dependencies.

- [ ] **Step 5: Commit the HR account page**

```bash
git add src/features/accounts/accounts.js src/features/accounts/accounts.css src/app/bootstrap.js src/app/style-loader.js src/app/route-registry.js scripts/build-static.mjs src/features/secondary/admin.js tests/unit/employee-account-page.test.mjs tests/unit/route-registry-all.test.mjs tests/unit/static-artifact.test.mjs
git commit -m "feat: build employee account administration page"
```

### Task 7: End-to-end verification and guarded production rollout

**Files:**
- Create: `e2e/employee-account-auth.spec.js`
- Modify: `.env.example`
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes: complete feature from Tasks 1-6
- Produces: deployable Worker/static artifact and documented secret/migration order

- [ ] **Step 1: Write the end-to-end flow**

Cover `nkhaduy` role selection, denial of ungranted role for a normal employee, HR employee-only list, six-character reset, reveal masking/unmasking, and employee re-login. Read all credentials from environment variables and skip production mutation tests unless `ALLOW_ACCOUNT_AUTH_MUTATION_TESTS=true`.

- [ ] **Step 2: Run all unit and security tests**

Run: `npm run test:unit && npm run test:security`

Expected: all Node unit/security tests pass with zero failures.

- [ ] **Step 3: Build and privacy-scan the static artifact**

Run: `npm run build`

Expected: exit 0; static privacy scan and bundle budget both pass.

- [ ] **Step 4: Run focused Playwright tests against a local Worker**

Run Worker: `npm run cf:dev`

Run tests in another shell: `BASE_URL=http://localhost:8787 npx playwright test e2e/employee-account-auth.spec.js`

Expected: all non-production flows pass; no console errors; desktop and mobile account layouts render.

- [ ] **Step 5: Verify schema and deployment prerequisites**

Run: `npx supabase migration list --local`

Run: `npx wrangler secret list`

Expected: migration `20260810061944_employee_account_auth.sql` is present and `PASSWORD_ESCROW_KEY` appears by name before deployment. If the secret is absent, generate a 32-byte base64url key outside repository output and set it with `npx wrangler secret put PASSWORD_ESCROW_KEY` before applying the migration.

- [ ] **Step 6: Apply migration, deploy, and smoke-test in safe order**

Apply the migration through the project's approved Supabase production migration workflow. Run `npm run production:gates`, create the release approval artifact with `npm run production:approval`, and deploy only through `npm run production:deploy-approved`. Verify `https://kislms.site/api/config`, login with `nkhaduy` in both roles, load `/hr/accounts`, reset one designated test employee to a six-character-or-longer password, reveal it once, confirm the critical audit event, and re-login as that employee. Never mutate a real employee password during smoke testing and never bypass a production gate that fails closed.

- [ ] **Step 7: Commit rollout documentation and E2E coverage**

```bash
git add e2e/employee-account-auth.spec.js .env.example docs/deployment.md
git commit -m "test: verify employee account authentication rollout"
```

### Task 8: Final review and release evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-employee-account-auth.md`

**Interfaces:**
- Consumes: fresh test/build/deployment output
- Produces: checked plan and final release handoff

- [ ] **Step 1: Re-run the full verification suite**

Run: `npm run test:unit && npm run test:security && npm run build`

Expected: exit 0 with zero test failures and successful privacy/budget scans.

- [ ] **Step 2: Review the complete diff for secrets and unrelated changes**

Run: `git diff 89f99c12d1033ce7faa2f8c01f4aa213167aac78...HEAD --check`

Run: `git diff 89f99c12d1033ce7faa2f8c01f4aa213167aac78...HEAD -- . ':(exclude)package-lock.json' | rg -n -i "password_escrow_key|service_role|plaintext_password|BEGIN (RSA|OPENSSH)|api[_-]?key"`

Expected: `git diff --check` exits 0; secret scan has no credential values.

- [ ] **Step 3: Mark every completed plan checkbox and commit evidence**

```bash
git add docs/superpowers/plans/2026-08-10-employee-account-auth.md
git commit -m "docs: record employee account auth verification"
```
