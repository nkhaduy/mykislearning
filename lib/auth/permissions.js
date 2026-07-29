export const authPermissions = {
  employee: ["password.self.change", "password.reset.request"],
  hr: [
    "password.employee.reset",
    "password.employee.temporary",
    "password.employee.forceChange",
    "account.employee.unlock",
    "account.employee.disable",
    "activation.employee.resend",
    "audit.security.read",
  ],
};

export function can(role, permission) {
  return authPermissions[role]?.includes(permission) || false;
}
