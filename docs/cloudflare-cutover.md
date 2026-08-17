# Cloudflare Cutover

## Current targets

- Legacy Worker: `mykis-learning`
- Legacy rollback version: `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c`
- Pages project: `kislms-frappe`
- Preview branch: `frappe-supabase-preview`
- Production hostname: `kislms.site`

## Cutover

1. Confirm preview Employee, HR, security, mobile, console, and network checks pass.
2. Record the current Worker custom-domain record and deployment version.
3. Remove only the `kislms.site` Worker custom-domain binding.
4. Attach `kislms.site` to the Pages project and wait for active verification.
5. Run production browser checks against `https://kislms.site`.

## Rollback

Remove the Pages custom domain, recreate the Worker custom-domain record for `mykis-learning`, and verify Worker version `b7c2c3a2-af8c-4881-834c-a96bd75d8c1c`. Do not roll back or reset Supabase; the LMS migrations are additive.
