# Frappe-Inspired UX Remediation Report

Captured: 2026-07-30
Reference audit commit: `1465696f62c2ab97da197e27f701655f3cb64593`
Status: **PARTIAL - LOCAL REGRESSION PASS, PRODUCTION UX DEPLOYMENT BLOCKED**

The audit used Frappe as an information-density and workflow reference, not as a visual template. The current KIS identity, Be Vietnam Pro typography, role-aware `/hr` and `/dashboard` shells, split route architecture, and compact tables/forms were preserved.

## Verified locally

- Public home, About, login, HR shell, learner shell, employees, courses, reports, and secondary routes load without the legacy monolith.
- Current-page navigation, explicit route ownership, safe deep links, keyboard tab behavior, modal focus return, ESC handling, form labels, 429 copy, empty/error states, and mobile login pass automated checks.
- Seven required viewports (`1440x900`, `1280x800`, `1024x768`, `768x1024`, `430x932`, `390x844`, `360x800`) pass 21 public-route checks with no horizontal overflow or console errors.
- Authenticated synthetic route suite passes 8/8 for HR/Employee role rendering, direct navigation, reload, and forbidden states.
- No new animation, card proliferation, placeholder KPI, or broad visual redesign was introduced during the security remediation.

## Production findings

- All seven public viewports render `/`, `/login`, and `/about-kis` at HTTP 200 with zero horizontal overflow.
- Cloudflare Web Analytics injection is blocked by CSP and emits a console error on all sampled routes. The release source adds only the two required Cloudflare Insights origins.
- The active Worker retains a stale post-login redirect after an unsafe `returnTo`; the release source already clears it and passes the regression test.
- Authenticated production HR/Employee visual mutation journeys were not run because credential rotation evidence and protected deployment/runtime gates are incomplete.

## Remaining UX scope

- Full HR employee/course mutation journeys, slow/offline/reload/double-submit cases, authenticated mobile screenshots, and WebKit/Firefox coverage remain pending.
- No UX change is approved for production until authorization, credential rotation, release manifest, and protected deployment gates pass.
