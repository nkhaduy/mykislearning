# Two-Role UI Verification

Captured: 2026-07-29 (Asia/Ho_Chi_Minh)

- Canonical HR routes use `/hr`; legacy `/admin...` browser links redirect to the equivalent HR route.
- Employee direct links to HR routes are redirected before a protected feature mounts.
- Login return targets are role-aware and legacy Admin links are canonicalized to HR.
- Session roles outside `hr` and `employee` fail closed; there is no Trainer workspace, navigation or unavailable page.
- Static build includes every module imported by the HR and Employee route registries.
- Public E2E passed `9/9`; authenticated route E2E passed `8/8`; all 51 runtime routes passed the monolith detector and route-bundle measurement.

The dedicated local clean-room browser runtime could not be restarted because Docker port `54322` was already owned by another local Supabase project. No existing project was stopped or mutated. Database replay, Worker authorization, route-registry and browser E2E coverage passed independently.

Production mutation: `NONE`
Production deploy: `NONE`
