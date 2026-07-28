# KIS LMS Production Approval Contract

The canonical production contract is stored outside the repository at `/tmp/kisvn-production-runtime.json` with mode `0600`. It contains the verified Cloudflare/Supabase target, exact allowlist, owner approval, restore-tested backup ID, one-time token, and secret material. Do not export or print its values.

The release preparation flow is:

```bash
npm run production:runtime:finalize -- --maintenance-window "START+07:00/END+07:00"
npm run production:gates
npm run production:manifest
npm run production:plan
```

`production:plan` loads the secure runtime directly, checks live Worker secret names and the current rollback version, validates repository evidence/checksums, and exits non-zero with only unresolved blockers. It prints `GO FOR PRODUCTION DEPLOYMENT` only when all controls pass.

The single final cutover command is:

```bash
npm run production:deploy-approved
```

It reloads the mode-`0600` runtime, requires the active maintenance window, reruns preflight/dry-runs, consumes the approval token once, applies linked Supabase migrations, and deploys the reviewed Worker/assets/config/secrets. It must not be run until the plan prints the literal GO line.
