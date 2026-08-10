import test from "node:test";
import assert from "node:assert/strict";

import { selectEffectiveRole } from "../../worker/routes/auth.js";

test("nkhaduy can request either granted role", () => {
  assert.equal(selectEffectiveRole(["employee", "hr"], "employee"), "employee");
  assert.equal(selectEffectiveRole(["employee", "hr"], "hr"), "hr");
});

test("role selection is required for a dual-role account", () => {
  assert.throws(
    () => selectEffectiveRole(["employee", "hr"]),
    (error) => error.code === "ROLE_SELECTION_REQUIRED" && error.status === 422,
  );
});

test("a requested role must be present in server-side grants", () => {
  assert.equal(selectEffectiveRole(["employee"], undefined), "employee");
  assert.throws(
    () => selectEffectiveRole(["employee"], "hr"),
    (error) => error.code === "INVALID_CREDENTIALS" && error.status === 401,
  );
});
