# Security Posture: Password and Session Security, No MFA

MFA/2FA is intentionally removed. The application does not implement TOTP, recovery codes, MFA challenges, step-up authentication, or assurance tables/RPCs. This is a deliberate security posture and requires organizational acceptance before production.

Sensitive actions rely on server-side role authorization, a valid rotated session, current credential version, strict distributed rate limits, CSRF protection, confirmation UI, audit logging, and (where appropriate) re-entry of the current password. Password re-entry is not MFA and must not be described as MFA.

The retained controls are password authentication, refresh-token rotation and reuse detection, session revoke/logout-all, credential versioning, trusted client-IP handling, CSRF, audit logs, role-spoof rejection, export ownership checks, private R2 proxy downloads, and fail-closed local `1 / 1` behavior outside development. The MFA removal contract remains `npm run test:mfa`.
