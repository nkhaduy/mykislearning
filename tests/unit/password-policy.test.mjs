import test from "node:test";
import assert from "node:assert/strict";

import { validatePasswordInput, validateEmployeeCreationInput } from "../../worker/routes/auth.js";

test("a six-character password is valid without composition rules", () => {
  assert.equal(validatePasswordInput("abcdef"), "abcdef");
  assert.equal(validatePasswordInput("------"), "------");
  assert.equal(validatePasswordInput("123456"), "123456");
});

test("password length and self-service reuse are rejected consistently", () => {
  assert.throws(() => validatePasswordInput("abcde"), /INVALID_PASSWORD/);
  assert.throws(() => validatePasswordInput("x".repeat(257)), /INVALID_PASSWORD/);
  assert.throws(() => validatePasswordInput("abcdef", { currentPassword: "abcdef" }), /PASSWORD_REUSED/);
});

test("employee creation uses the same six-character password policy", () => {
  const input = validateEmployeeCreationInput({
    email: "employee@example.com",
    password: "abcdef",
    fullName: "Employee Test",
    employeeCode: "EMP-001",
    department: "Operations",
  });
  assert.equal(input.password, "abcdef");
});
