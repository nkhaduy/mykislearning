# Employee Login and Account Administration Design

Date: 2026-08-10

## Context

Production advertises that users can sign in with an email address or username. The browser sends the entered `identifier`, but the Worker resolves normal accounts only with `profiles.email = identifier`. Therefore a value such as `nkhaduy` cannot resolve to its production profile and returns `INVALID_CREDENTIALS` before password verification.

The existing `/hr/accounts` route primarily renders support-request data. It does not provide a dedicated, production-backed employee account list. Password hashes are stored in `private.account_credentials` and must remain non-readable outside the credential verification service.

## Approaches Considered

1. Add a dedicated username column and role-grant records. This provides explicit identifiers, supports the owner account's two roles, and fails closed on collisions. This is the selected approach.
2. Resolve usernames only from email local parts. This avoids a new column but cannot express an explicit dual-role owner account cleanly.
3. Store plaintext employee passwords for HR viewing. This would expose every employee credential in a database leak. Plaintext storage will not be implemented; authenticated hash verification plus a separately encrypted escrow copy is selected instead.

## Selected Behavior

### Login identifiers

- Email addresses continue to match case-insensitively by full address.
- Normal employee usernames default to the email local part before `@`, with a uniqueness constraint and an HR-editable explicit value for collisions.
- Employee code remains an accepted exact login identifier.
- Username resolution succeeds only when exactly one eligible profile matches.
- Ambiguous, missing, inactive, locked, and wrong-password cases keep the same generic public error to prevent account enumeration.
- Local-development and deployment-test usernames keep their existing isolated behavior.

### Dual-role owner account

- The `nkhaduy` account receives explicit grants for both `employee` and `hr`.
- The login form displays an Employee/HR selector when the identifier is `nkhaduy`.
- The Worker validates the requested role against server-side grants before creating a session; a client-provided role can never grant access by itself.
- Auth sessions store the effective selected role and revalidate that role grant on every session check.
- Other accounts continue to receive only their assigned role and cannot promote themselves through a crafted login request.

### Password policy

- Employee-created, employee-changed, and HR-reset passwords use one server-side policy: 6 to 256 characters.
- Uppercase, lowercase, number, and special-character composition rules are removed.
- Self-service password changes must differ from the current password.
- The browser mirrors the server rule for immediate feedback, but the Worker remains authoritative.
- Existing hashes remain valid; no forced migration or password reset is required.

### Password escrow for HR viewing

- Authentication continues to use PBKDF2 password hashes. Hash verification is never replaced with plaintext comparison.
- On employee creation, self-service password change, and HR reset, the Worker also writes an AES-GCM encrypted escrow copy to a private table.
- Encryption uses a versioned `PASSWORD_ESCROW_KEY` Worker secret; the key is never stored in Supabase, static assets, logs, or API responses.
- Only an authenticated HR session can request a reveal. The reveal endpoint is rate-limited and writes a critical audit event containing actor and target IDs, never the password.
- The HR UI masks passwords by default and clears decrypted values when the dialog closes, the route changes, or a short display timeout expires.
- Existing passwords that predate escrow cannot be recovered from their hashes. Their state is `unavailable_until_reset`; HR must reset the password once before it can be revealed later.

### HR employee-account tab

- `/hr/accounts` becomes a dedicated employee-account management page backed by production APIs.
- The list includes employee name, employee code, email, username, department, account state, credential state, escrow availability, failed attempts, lock expiry, and last login.
- The endpoint returns only employee profiles and safe credential metadata such as `configured`, `mustChange`, and `escrowAvailable`. It never returns a password hash or ciphertext.
- HR can search/filter, unlock, disable/enable, revoke sessions, and reset an employee password.
- HR can reveal an escrowed current password on demand after an explicit confirmation.
- Account actions reject non-employee targets even if a crafted request bypasses the UI.
- A generated or manually entered temporary password is shown in the reset dialog and becomes the new encrypted escrow value. Decrypted values are never included in list responses.

## Architecture

- Add private username and account-role-grant storage with unique constraints and a deterministic login-resolution RPC.
- Extend server-side auth sessions with an effective role and revalidate the associated role grant during session validation.
- Add a private service RPC for paginated employee-account metadata, joining `public.profiles` to `private.account_credentials` while returning only safe booleans/status fields.
- Add a private password-escrow table containing ciphertext, IV, key version, and update metadata; encryption and decryption happen only inside the Worker.
- Add a Worker employee-account route requiring an HR session and mapping the RPC result to a stable JSON contract.
- Add a dedicated, rate-limited HR reveal endpoint that decrypts one password and writes a critical audit event.
- Harden the existing HR account-action route so every target must have the `employee` role.
- Replace the generic `/hr/accounts` data-route entry with a dedicated feature module and stylesheet.
- Keep credential hashing and verification in the existing credential service; reversible data is isolated to encrypted escrow and never used as the authentication source.

## Error Handling and Audit

- Identifier collisions fail closed as `INVALID_CREDENTIALS` and record an internal audit reason without logging the submitted password.
- Missing or invalid role grants fail closed without revealing whether the username has HR access.
- Account-list failures return a stable account-management error and allow retry.
- Password validation returns `INVALID_PASSWORD` for values shorter than 6 or longer than 256 characters without echoing the password.
- Reveal failures return a generic error and never fall back to returning ciphertext or hashes.
- Unlock, status change, session revocation, and reset actions remain audited with actor and target identifiers.
- Passwords, hashes, cookies, and tokens remain covered by the existing audit-redaction rules.

## Tests

- Unit tests prove email, employee-code, and username login resolution, including collisions.
- Auth tests prove `nkhaduy` can create either an employee or HR session only when the corresponding server-side grant exists.
- Authorization tests prove other users cannot request a different role.
- Auth route tests prove generic public errors and unchanged deployment-test behavior.
- Password-policy tests prove 6-character passwords are accepted and shorter passwords are rejected across create, change, and reset flows.
- Account API tests prove only employees are returned and hashes are absent.
- Authorization tests prove HR cannot use employee account actions against HR profiles.
- Escrow tests prove AES-GCM round trips, wrong-key failures, ciphertext uniqueness, audit redaction, and no plaintext persistence.
- Browser tests cover role selection, the employee-account page, reset modal, masked/revealed password handling, expiry clearing, and responsive rendering.
- Full unit/security test suites and the production build run before completion.

## Deployment

- Apply the new Supabase migration before deploying the Worker that calls the RPCs.
- Deploy the Worker and static assets from the production release lineage.
- Configure and verify `PASSWORD_ESCROW_KEY` before enabling password escrow writes or reveals.
- Smoke-test `nkhaduy` in both roles, full-email login, HR account listing, password reset, reveal auditing, and employee re-login.
- Do not modify or reveal the existing credential hash while diagnosing the current account.
