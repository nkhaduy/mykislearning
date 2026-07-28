import test from "node:test";
import assert from "node:assert/strict";

import { buildCertificationCreatePayload, buildCertificationUpdatePayload } from "../../worker/routes/employees.js";

const valid = {
  name: "Synthetic Certificate",
  certificate_type: "synthetic",
  issuer: "Example Issuer",
  issue_date: "2026-01-01",
};

test("SEC-009: certificate create ignores privileged and unknown client fields", () => {
  const payload = buildCertificationCreatePayload({
    ...valid,
    account_id: "other-account",
    created_by: "forged-admin",
    role: "admin",
    status: "approved",
    verification_status: "approved",
    unknown_field: "value",
  });

  assert.deepEqual(payload, valid);
});

test("SEC-009: certificate update cannot change owner, status, or audit fields", () => {
  const payload = buildCertificationUpdatePayload({
    notes: "Reviewed",
    account_id: "other-account",
    status: "revoked",
    revoked_by: "forged-admin",
    updated_by: "forged-admin",
  });

  assert.deepEqual(payload, { notes: "Reviewed" });
});

test("SEC-009: invalid certificate dates are rejected", () => {
  assert.throws(() => buildCertificationCreatePayload({ ...valid, issue_date: "01/01/2026" }), /YYYY-MM-DD/);
  assert.throws(() => buildCertificationCreatePayload({ ...valid, expiry_date: "2025-01-01" }), /must not precede/);
});
