# Frappe LMS Gap Analysis

Phase-one preview now passes Employee login/enroll/lesson/progress persistence, HR course/chapter/lesson publishing, negative Employee authoring checks, mobile course navigation, and console/network checks. Advanced upstream modules remain deferred as listed below.

Baseline: Frappe Learning `v2.61.0` (`d3bfe97d178eb076310dffd7407106bcdec15d67`).

| Capability | Status | Decision |
| --- | --- | --- |
| Vue/Frappe UI layouts, typography, nav, responsive shell | Ported | Reuse upstream directly |
| Catalogue, cards, course detail, outline | Native Supabase replacement | Preserve UI; replace resources with course adapter |
| Lesson player, next/previous, loading/empty states | Native Supabase replacement | Preserve UI; replace lesson resources |
| Login/logout/session refresh/protected routes | Native Supabase replacement | Supabase Auth, login-only |
| Enrollment and persistent progress | Native Supabase replacement | RLS plus atomic progress RPC |
| Profile | Native Supabase replacement | `profiles` adapter |
| Course/chapter/lesson authoring and publishing | Native Supabase replacement | HR RLS and Storage adapter |
| Instructor assignment | Native Supabase replacement | Profile role/relationship adapter |
| Quiz authoring, attempts, results | Deferred | Port after core Employee/HR flows |
| Batches, programs, certificates, assignments | Deferred | Add only with explicit product priority |
| SCORM, programming exercises, jobs, payments, coupons | Deferred | Not required for phase one |
| Email/Zoom/Meet/Raven integrations and notifications | Dropped | Native Frappe integrations are not deployed |
| Frappe websocket notifications | Dropped | No native websocket backend; optional Supabase Realtime later |
| QR/geolocation attendance | Deferred | KIS-specific backlog |
| Compliance/retraining | Deferred | KIS-specific backlog |
| Competency matrix and development plans | Deferred | KIS-specific backlog |
| Regulatory certificate lifecycle and historical reports | Deferred | KIS-specific backlog |
| Legacy KIS dashboard/sidebar/cards/player/admin | Dropped | Remove from active production path after cutover |
