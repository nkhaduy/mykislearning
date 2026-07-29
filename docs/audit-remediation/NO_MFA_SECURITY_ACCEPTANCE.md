# KIS LMS No-MFA Security Acceptance

Status: **Accepted**

Production go-live is blocked while this status is `Pending` or `Rejected`.

## Decision in scope

MFA/2FA has been removed intentionally and must not be reintroduced by the operational-readiness work. HR users authenticate with passwords only.

Refresh-token rotation, refresh-token reuse detection, session revocation, distributed rate limiting, account disable controls, and audit logging reduce risk but do not replace MFA.

## Residual risks

- Password phishing can give an attacker a valid privileged credential.
- Credential stuffing can succeed when a password has been reused on another service.
- Password reuse increases the blast radius of third-party breaches.
- A compromised endpoint or browser can expose an authenticated privileged session.

## Compensating controls

- Enforce the approved password length, complexity, reset, and compromised-password policy.
- Prohibit shared HR accounts and require individually attributable identities.
- Keep access tokens short lived and use atomic refresh rotation with family reuse detection.
- Provide session review, current-device logout, logout-all, and administrative session revoke.
- Disable accounts promptly during offboarding, suspected compromise, or role removal.
- Apply shared Durable Object rate limits to login, refresh, reset, export, attendance, and public join flows.
- Alert on refresh-token reuse, login failure spikes, privileged session anomalies, and account-disable events.
- Maintain an incident process for credential reset, session-family revocation, account disable, audit review, and stakeholder notification.

## Operational requirements

- Password policy owner: Pending assignment
- Monitoring owner: Pending assignment
- Incident response owner: Nguyễn Khả Duy
- Go-live owner: Pending assignment
- Rollback owner: Pending assignment
- Approval date: 2026-07-28
- Review date: 2027-01-28
- Approver: Nguyễn Khả Duy (Chủ dự án KIS LMS)
- Approval record/reference: owner signoff 2026-07-28T21:23:49+07:00

## Approval

An authorized approver must choose exactly one status after reviewing the residual risk and staging evidence:

- `Pending`
- `Accepted`
- `Rejected`

This document must not be marked `Accepted` by the implementation agent. An `Accepted` decision must identify the approver, date, scope, review date, and any time-bound conditions.

## Owner sign-off command

An authorized owner can record the decision with the guarded command below. It is never run automatically and accepts only the exact residual-risk confirmation shown here.

```bash
npm run security:accept-no-mfa -- \
  --approved-by "<owner>" \
  --role "<authority>" \
  --review-date "YYYY-MM-DD" \
  --incident-owner "<incident owner>" \
  --confirm "Tôi hiểu và chấp nhận rủi ro còn lại khi tài khoản HR và Admin vận hành không có MFA/2FA. Tôi xác nhận đây là quyết định có chủ đích của chủ dự án, đồng thời chấp nhận áp dụng các biện pháp bù trừ gồm mật khẩu mạnh, refresh-token rotation, session revocation, rate limiting, audit logging, giám sát sự cố và quy trình khóa tài khoản."
```

## Recorded owner acceptance

- Approved at: 2026-07-28T21:23:49+07:00
- Approval date (Asia/Ho_Chi_Minh): 2026-07-28
- Approved by: Nguyễn Khả Duy
- Authority role: Chủ dự án KIS LMS
- Incident response owner: Nguyễn Khả Duy
- Review date: 2027-01-28
- Command executor Git identity: name=Nguyễn Khả Duy; email=91268374+nkhaduy@users.noreply.github.com
- Commit SHA: 2b9c633fc607fe6ac232c2e152dfdda68396aedc
- Confirmation: Tôi hiểu và chấp nhận rủi ro còn lại khi tài khoản HR vận hành không có MFA/2FA. Tôi xác nhận đây là quyết định có chủ đích của chủ dự án, đồng thời chấp nhận áp dụng các biện pháp bù trừ gồm mật khẩu mạnh, refresh-token rotation, session revocation, rate limiting, audit logging, giám sát sự cố và quy trình khóa tài khoản.
