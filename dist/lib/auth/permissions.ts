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
  manager: ["account.employee.summary.read"],
  superAdmin: ["roles.manage", "account.hr.disable", "audit.security.all"],
} as const;

export function can(role: keyof typeof authPermissions, permission: string) {
  return (authPermissions[role] as readonly string[])?.includes(permission) || (role === "superAdmin" && authPermissions.superAdmin.includes(permission as never));
}
