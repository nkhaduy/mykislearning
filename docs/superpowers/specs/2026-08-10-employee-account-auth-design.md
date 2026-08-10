# Employee Login and Account Administration Design

Date: 2026-08-10

## Context

Production advertises that users can sign in with an email address or username. The browser sends the entered `identifier`, but the Worker resolves normal accounts only with `profiles.email = identifier`. Therefore a value such as `nkhaduy` cannot resolve to `nkhaduy@kisvn.vn` and returns `INVALID_CREDENTIALS` before password verification.

The existing `/hr/accounts` route primarily renders support-request data. It does not provide a dedicated, production-backed employee account list. Password hashes are stored in `private.account_credentials` and must remain non-readable outside the credential verification service.

## Approaches Considered

1. Add a dedicated username column and backfill every profile. This provides explicit identifiers but requires an organization-wide naming and collision policy that is not currently defined.
2. Resolve usernames from existing identifiers. Accept exact email, exact employee code, or the email local part before `@`; reject ambiguous matches. This fixes the current account without creating another identity field. This is the selected approach.
3. Store reversible or plaintext employee passwords for HR viewing. This would expose every employee credential and invalidate the current security model. This approach will not be implemented.

## Selected Behavior

### Login identifiers

- Email addresses continue to match case-insensitively by full address.
- A value without `@` may match an employee code or the local part of an email address.
- Username resolution succeeds only when exactly one eligible profile matches.
- Ambiguous, missing, inactive, locked, and wrong-password cases keep the same generic public error to prevent account enumeration.
- Local-development and deployment-test usernames keep their existing isolated behavior.

### Password policy

- Employee-created, employee-changed, and HR-reset passwords use one server-side policy: 8 to 256 characters.
- Uppercase, lowercase, number, and special-character composition rules are removed.
- Self-service password changes must differ from the current password.
- The browser mirrors the server rule for immediate feedback, but the Worker remains authoritative.
- Existing hashes remain valid; no forced migration or password reset is required.

### HR employee-account tab

- `/hr/accounts` becomes a dedicated employee-account management page backed by production APIs.
- The list includes employee name, employee code, email/derived username, department, account state, credential state, failed attempts, lock expiry, and last login.
- The endpoint returns only `role = employee` profiles and safe credential metadata such as `configured` and `mustChange`. It never returns a password hash.
- HR can search/filter, unlock, disable/enable, revoke sessions, and reset an employee password.
- Account actions reject non-employee targets even if a crafted request bypasses the UI.
- A generated or manually entered temporary password is shown only in the reset dialog during that operation. It is not stored in browser state after the dialog closes and is not returned by later list requests.

## Architecture

- Add a private service RPC that resolves a login identifier deterministically without exposing profile search to anonymous clients.
- Add a private service RPC for paginated employee-account metadata, joining `public.profiles` to `private.account_credentials` while returning only safe booleans/status fields.
- Add a Worker employee-account route requiring an HR session and mapping the RPC result to a stable JSON contract.
- Harden the existing HR account-action route so every target must have the `employee` role.
- Replace the generic `/hr/accounts` data-route entry with a dedicated feature module and stylesheet.
- Keep credential hashing and verification in the existing credential service; no reversible password storage is introduced.

## Error Handling and Audit

- Identifier collisions fail closed as `INVALID_CREDENTIALS` and record an internal audit reason without logging the submitted password.
- Account-list failures return a stable account-management error and allow retry.
- Reset validation returns `INVALID_PASSWORD` without echoing the password.
- Unlock, status change, session revocation, and reset actions remain audited with actor and target identifiers.
- Passwords, hashes, cookies, and tokens remain covered by the existing audit-redaction rules.

## Tests

- Unit tests prove email, employee-code, and email-local-part login resolution, including ambiguous local parts.
- Auth route tests prove generic public errors and unchanged deployment-test behavior.
- Password-policy tests prove 8-character plain passwords are accepted and shorter passwords are rejected across create, change, and reset flows.
- Account API tests prove only employees are returned and hashes are absent.
- Authorization tests prove HR cannot use employee account actions against HR profiles.
- Browser tests cover the employee-account page, reset modal, one-time temporary-password display, and responsive rendering.
- Full unit/security test suites and the production build run before completion.

## Deployment

- Apply the new Supabase migration before deploying the Worker that calls the RPCs.
- Deploy the Worker and static assets from the production release lineage.
- Smoke-test `nkhaduy`, full-email login, HR account listing, password reset, and employee re-login.
- Do not modify or reveal the existing credential hash while diagnosing the current account.
