# TypeScript inventory

The repository originally contained eight TypeScript files beside JavaScript
files with the same basename. Static import search, the route bundle inventory,
and `scripts/build-static.mjs` confirm that runtime and delivery use the
JavaScript files. The TypeScript copies are retained under
`legacy/typescript/` so they cannot shadow the runtime JavaScript during module
resolution, while still participating in `typecheck:legacy`.

| Archived path | Runtime reference | Classification | Source of truth | Decision |
| --- | --- | --- | --- | --- |
| `legacy/typescript/lib/auth/mockAuth.ts` | None | Prototype declarations with stale `manager`/`superAdmin` roles | Worker auth and `lib/auth/*.js` | Archive and typecheck only |
| `legacy/typescript/lib/auth/passwordPolicy.ts` | None | Typed duplicate of the browser password helper | `lib/auth/passwordPolicy.js` | Archive and typecheck only |
| `legacy/typescript/lib/auth/permissions.ts` | None | Prototype permission model; not Worker authorization | Worker route policy/auth middleware | Archive and typecheck only |
| `legacy/typescript/lib/i18n/en.ts` | None | Compatibility facade | `lib/i18n/en.js` | Archive; point facade at runtime JS |
| `legacy/typescript/lib/i18n/index.ts` | None | Compatibility facade | `lib/i18n/index.js` | Archive; point facade at runtime JS |
| `legacy/typescript/lib/i18n/kr.ts` | None | Compatibility facade | `lib/i18n/kr.js` | Archive; point facade at runtime JS |
| `legacy/typescript/lib/i18n/vi.ts` | None | Compatibility facade | `lib/i18n/vi.js` | Archive; point facade at runtime JS |
| `legacy/typescript/lib/mockDatabase.ts` | None | Incomplete compatibility facade | `lib/mockDatabase.js` | Archive; point facade at runtime JS |

The official typecheck also checks the active Worker authentication/security
path and the Node scripts used by CI. `skipLibCheck` is enabled only for the
Worker project because the installed Supabase client declarations currently
conflict with TypeScript 6 DOM/WebAuthn declarations; repository-owned Worker
files remain checked with `checkJs`.
