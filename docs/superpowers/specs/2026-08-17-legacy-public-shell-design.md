# Legacy KIS Public Shell with Frappe LMS Design

## Objective

Restore the exact legacy KIS public landing, About KIS, and login experience while keeping the authenticated Frappe-derived Vue LMS, Supabase Auth, PostgreSQL, Storage, RLS, enrollment, lessons, progress, and HR authoring implementation unchanged.

Production remains a Cloudflare Pages SPA at `https://kislms.site`. This is a public-shell restoration, not a rollback to the legacy LMS or Worker runtime.

## Source of truth

Use repository commit `1fe33aa6fcce` as the visual and content source. The canonical legacy files are:

- `src/features/public/home.js` and `src/features/public/home.css`
- `src/features/public/about.js` and `src/features/public/about.css`
- `src/features/auth/login.js`, `src/features/auth/auth.css`, and `src/features/auth/auth-visual.css`
- `src/shared/ui/font.css`
- the referenced files under `assets/` and `public/images/`

Reuse the original markup structure, multilingual copy, responsive rules, imagery, logos, local Be Vietnam Pro fonts, header, footer, mobile navigation, timeline interaction, and login presentation. Do not visually recreate these pages from screenshots when the source remains available.

## Application boundary

The active application remains the Vue 3 frontend under `frontend/`. Port only the public presentation into an isolated `frontend/src/legacy-public/` namespace. Public components may consume the current session store and Supabase auth service, but they must not import the legacy router, Worker API client, learner dashboard, course player, HR/admin modules, stores, or authentication backend.

Authenticated views continue to use the existing Frappe-derived shell in `frontend/src/App.vue`. The public header and footer render only inside public views. The LMS sidebar renders only for protected LMS routes. Public styles are scoped beneath page-specific root classes and loaded from the public components so they cannot alter Frappe UI controls or layout.

## Routes

Final public routes are:

- `/` — legacy landing page, visible to guests and authenticated users
- `/about-kis` — canonical legacy About KIS page
- `/about` — compatibility redirect to `/about-kis`
- `/login` — legacy login presentation backed by current Supabase Auth

The legacy `/training` and `/join/:token` pages are not restored because they are operational legacy LMS features rather than marketing/static pages and are not required by this release.

Existing authenticated routes remain unchanged to minimize production risk:

- `/courses`
- `/courses/:id`
- `/courses/:courseId/lessons/:lessonId`
- `/admin`

Guests opening a protected route are redirected to `/login?next=<safe-relative-route>`. Employees cannot enter `/admin`; HR can use both learner and authoring routes. Authenticated users opening `/login` are redirected to `/courses`. Opening `/` never automatically redirects an authenticated user.

## Authentication flow

The login form retains the legacy visual hierarchy, copy, input styling, password visibility control, language switcher, background, logo, and responsive layout. Its action layer calls the existing `supabase.auth.signInWithPassword` service through the session store.

After a successful login, redirect to a validated local `next` route when present; otherwise redirect to `/courses`. Only known protected routes are accepted as `next` values. External, protocol-relative, login, and unknown paths fall back to `/courses`.

The legacy authentication API, role-selection API, session cookies, password hashes, and Worker endpoints are not restored. Authorization remains derived from the protected `public.profiles` row linked by `auth_user_id`. Logout continues to call Supabase `signOut()` and redirects to `/login`. Supabase session persistence remains the current client behavior.

## Login support and password reset

Do not restore the legacy support-request API because it belongs to the retired Worker backend. The visible login assistance action must not be broken: replace it with a mail link to the legacy HR support address and localized subject/body text. A new password-reset implementation is deferred because it is not present in the current Supabase frontend contract and is not required for this release.

## Public assets

Copy only assets referenced by the restored pages, including KIS logos, the desktop/mobile learning banners, About KIS photography and timeline images, the head-office login background, favicon assets where required, and local Be Vietnam Pro font files. Preserve original dimensions and formats. Do not generate replacements, upscale images, or copy unused legacy dashboard/course/admin assets.

## HR account authorization

The existing Supabase Auth account for `nkhaduy@gmail.com` must be linked to an active `public.profiles` row with role `hr`. Update authorization in the database, not in browser-writable user metadata. Verify the profile's `auth_user_id`, email, role, and active status without printing credentials or tokens. The supplied password is used only through the rendered production login form for verification and is never written to the repository, command history, test artifacts, screenshots, or logs.

## Error handling and accessibility

Preserve the legacy field-level validation, loading state, password visibility control, focus styling, reduced-motion behavior, mobile navigation keyboard handling, image dimensions, and semantic headings. Translate Supabase authentication failures into concise localized messages without exposing raw backend details.

If profile loading fails after authentication, keep the protected route closed and show a recoverable login error rather than granting a default role. Failed public images must not prevent navigation or authentication.

## Testing

Add unit tests for route classification, safe post-login redirects, authenticated-login redirect, Employee rejection from `/admin`, and HR access to `/admin`. Add component tests for the legacy login form calling the existing session store and redirecting correctly.

Run frontend tests and production build, plus repository lint/typecheck checks that apply to changed files. Test a Cloudflare Pages preview before production.

Preview and production browser verification must cover:

- guest landing, About KIS, and login on desktop and mobile
- public assets, header/footer, language switching, and responsive navigation
- Supabase login, refresh persistence, logout, relogin, and protected-route redirects
- Employee catalogue, course, lesson, and progress persistence
- HR course create, edit, and publish
- direct SPA refresh for public and protected routes
- browser console errors and failed network requests

Production is PASS only after direct verification on `https://kislms.site`.

## Deployment and rollback

Build and deploy through the existing `kislms-frappe` Cloudflare Pages project. Do not change DNS, custom-domain bindings, Supabase schema beyond the requested HR profile authorization, or reattach the legacy Worker.

Keep deployment commit `53f7ded3e6c74ddc5d6d977369947a9bf035a99d` and the current Pages deployment as the immediate frontend rollback. If the public-shell release fails, promote the previous Pages deployment. Do not roll back Supabase schema or LMS data. The detached legacy Worker remains a secondary disaster-recovery option only and is not part of normal rollback.
