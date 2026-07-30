# Production Credential Rotation Report

Captured: 2026-07-30T10:24:04+07:00
Release commit: `bff45256a3729173e0056b9e9082d227b9b7da47`
Status: **BLOCKED - LEGACY SUPABASE KEY STILL ACTIVE**

No raw credential, token, password, session cookie, or PII is stored in this report.

## Inventory

| Credential class | Classification | Evidence |
| --- | --- | --- |
| Cloudflare deployment API token | ROTATED_NOT_VERIFIED | The exposed candidate is revoked/invalid. Current encrypted Wrangler OAuth can read/deploy Workers but receives HTTP 403 from Alerting and token-management APIs. |
| Supabase service-role key | EXPOSED_AND_ACTIVE | A fresh production secret key was created and tested. The exposed legacy service-role candidate remains enabled because the healthy Worker still depends on legacy credentials. |
| Supabase public/anon key | ROTATED_NOT_VERIFIED | A fresh publishable key was created and tested; legacy keys remain enabled until protected deployment succeeds. |
| Supabase database credentials | UNKNOWN | Linked production access and dump/restore verification passed without printing a password; transcript exposure cannot be disproved from provider state alone. |
| Worker signing/hash secrets | NOT_EXPOSED | Current replacement values exist only in mode-0600 secure runtime and do not occur in repository, Git history, dist, reports, or Playwright artifacts. |
| Alerting credential | UNKNOWN | No separate alerting token was found. Current Cloudflare OAuth lacks Alerting access. |
| GitHub token | NOT_EXPOSED | The current credential does not match transcript candidates and no active value was found in release artifacts. |
| Temporary smoke/browser credentials | NOT_EXPOSED | Synthetic credentials were stored only in disposable mode-0600 files and the isolated runtime was stopped and removed. |

## Provider actions completed

- Created production Supabase publishable key `kis_lms_web_bff45256`; provider test passed.
- Created production Supabase secret key `kis_lms_worker_bff45256`; provider test passed.
- Bound the new keys to a mode-0600 production runtime outside the repository.
- Verified the exposed Cloudflare API-token candidate is revoked/invalid.
- Verified current replacement production secret values are absent from tracked files, untracked release files, current diff, Git history, `dist`, reports, and Playwright artifacts.

## Remaining blocker

The legacy Supabase service-role key cannot be disabled before a protected Worker deployment switches production to the new key. The protected plan did not return `GO FOR PRODUCTION DEPLOYMENT`, so the legacy key was not revoked and no Worker secret was mutated.

Cloudflare alert policy and delivery refresh also requires a replacement Cloudflare credential with Alerting permission. Current OAuth returns HTTP 403 and no controllable authenticated browser session is available.

Credential rotation verification: **FAIL/BLOCKED**
Old exposed credentials revoked: **FAIL/BLOCKED**
Active exposed production credentials: **1**
Production health: **PASS**
Deployment performed: **NO**
