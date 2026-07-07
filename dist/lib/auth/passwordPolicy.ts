export type PasswordPolicyCheck = {
  key: "minLength" | "uppercase" | "lowercase" | "number" | "special" | "notTemporary";
  passed: boolean;
};

export function validatePassword(password: string, temporaryPassword = "") {
  const checks: PasswordPolicyCheck[] = [
    { key: "minLength", passed: password.length >= 8 },
    { key: "uppercase", passed: /[A-Z]/.test(password) },
    { key: "lowercase", passed: /[a-z]/.test(password) },
    { key: "number", passed: /\d/.test(password) },
    { key: "special", passed: /[^A-Za-z0-9]/.test(password) },
    { key: "notTemporary", passed: Boolean(password) && password !== temporaryPassword },
  ];
  return { passed: checks.every((check) => check.passed), checks };
}

export function generateTemporaryPassword() {
  const random = Math.random().toString(36).slice(2, 8);
  return `KIS@${random}26`;
}
