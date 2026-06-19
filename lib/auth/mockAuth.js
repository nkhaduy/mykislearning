import { generateTemporaryPassword } from "./passwordPolicy.js";

const HASH_PREFIX = "mock$";
const now = "2026-06-18 09:58";

export const accountStatuses = {
  active: { vi: "Đang hoạt động", en: "Active" },
  pendingActivation: { vi: "Chờ kích hoạt", en: "Pending Activation" },
  temporarilyLocked: { vi: "Tạm khóa", en: "Temporarily Locked" },
  passwordResetRequired: { vi: "Yêu cầu đổi mật khẩu", en: "Password Reset Required" },
  disabled: { vi: "Đã vô hiệu hóa", en: "Disabled" },
};

export const authAccounts = [
  {
    employeeCode: "KIS-2026-001",
    fullName: "Nguyễn Văn An",
    email: "an.nguyen@kisvn.vn",
    accountStatus: "active",
    role: "employee",
    passwordHash: "mock$dHJhaW5pbmcyMDI2",
    failedLoginAttempts: 1,
    lastFailedLoginAt: "2026-06-18 09:20",
    lastLoginAt: "2026-06-18 09:42",
    passwordResetRequired: false,
    temporaryPasswordGeneratedAt: null,
    lockedUntil: null,
    createdAt: "2026-06-17 08:15",
    activatedAt: "2026-06-17 09:02",
    createdBy: "Phạm Thu Hà",
    updatedBy: "Phạm Thu Hà",
    mfaStatus: "Mock SMS OTP enabled",
  },
  {
    employeeCode: "KIS-2026-003",
    fullName: "Lê Hoàng Nam",
    email: "nam.le@kisvn.vn",
    accountStatus: "temporarilyLocked",
    role: "employee",
    passwordHash: "mock$dHJhaW5pbmcyMDI2",
    failedLoginAttempts: 5,
    lastFailedLoginAt: "2026-06-18 09:58",
    lastLoginAt: null,
    passwordResetRequired: false,
    temporaryPasswordGeneratedAt: null,
    lockedUntil: "2026-06-18 10:15",
    createdAt: "2026-06-17 08:22",
    activatedAt: null,
    createdBy: "Phạm Thu Hà",
    updatedBy: "System",
    mfaStatus: "Not configured",
  },
  {
    employeeCode: "KIS-2026-004",
    fullName: "Phạm Thu Hà",
    email: "ha.pham@kisvn.vn",
    accountStatus: "passwordResetRequired",
    role: "employee",
    passwordHash: "mock$S0lTQFRlbXAyMDI2",
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: null,
    passwordResetRequired: true,
    temporaryPasswordGeneratedAt: "2026-06-18 08:30",
    lockedUntil: null,
    createdAt: "2026-06-18 08:30",
    activatedAt: null,
    createdBy: "Phạm Thu Hà",
    updatedBy: "Phạm Thu Hà",
    mfaStatus: "Pending enrollment",
  },
  {
    employeeCode: "HR-001",
    fullName: "Phòng Nhân sự",
    email: "hr@kisvn.vn",
    accountStatus: "active",
    role: "hr",
    passwordHash: "mock$dHJhaW5pbmcyMDI2",
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: "2026-06-18 09:55",
    passwordResetRequired: false,
    temporaryPasswordGeneratedAt: null,
    lockedUntil: null,
    createdAt: "2026-01-04 08:00",
    activatedAt: "2026-01-04 08:10",
    createdBy: "Super Admin",
    updatedBy: "Super Admin",
    mfaStatus: "Mock authenticator enabled",
  },
  {
    employeeCode: "MG-001",
    fullName: "Quản lý phòng ban",
    email: "manager@kisvn.vn",
    accountStatus: "active",
    role: "manager",
    passwordHash: "mock$dHJhaW5pbmcyMDI2",
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: "2026-06-18 09:12",
    passwordResetRequired: false,
    temporaryPasswordGeneratedAt: null,
    lockedUntil: null,
    createdAt: "2026-01-04 08:00",
    activatedAt: "2026-01-04 08:10",
    createdBy: "HR",
    updatedBy: "HR",
    mfaStatus: "Mock SMS OTP enabled",
  },
];

export const securityAuditLog = [
  { time: "2026-06-18 09:20", actor: "Nguyễn Văn An", role: "employee", action: "Login failed", target: "Nguyễn Văn An", description: "Sai mật khẩu lần 1. Không ghi nhận mật khẩu.", channel: "Web", device: "10.10.31.09 / Edge", result: "Failed" },
  { time: "2026-06-18 09:58", actor: "System", role: "system", action: "Account locked", target: "Lê Hoàng Nam", description: "Tài khoản tạm khóa sau 5 lần đăng nhập sai.", channel: "Web", device: "10.10.30.22 / Chrome", result: "Success" },
  { time: "2026-06-18 08:30", actor: "Phạm Thu Hà", role: "hr", action: "Temporary password generated", target: "Phạm Thu Hà", description: "Tạo mật khẩu tạm thời và bật yêu cầu đổi mật khẩu.", channel: "HR Admin", device: "10.10.24.18 / Chrome", result: "Success" },
];

export function mockPasswordHash(password) {
  return `${HASH_PREFIX}${btoa(password)}`;
}

export function findAccount(identifier) {
  const normalized = identifier.trim().toLowerCase();
  return authAccounts.find((account) => account.email.toLowerCase() === normalized || account.employeeCode.toLowerCase() === normalized);
}

export function addSecurityAuditLog(entry) {
  securityAuditLog.unshift({ time: now, channel: "Web", device: "10.10.24.18 / Prototype", result: "Success", ...entry });
}

export function lockAccount(account) {
  account.accountStatus = "temporarilyLocked";
  account.lockedUntil = "2026-06-18 10:15";
  addSecurityAuditLog({ actor: "System", role: "system", action: "Account locked", target: account.fullName, description: "Tạm khóa do nhiều lần đăng nhập sai." });
}

export function unlockAccount(employeeCode, actor = "Phạm Thu Hà") {
  const account = authAccounts.find((item) => item.employeeCode === employeeCode);
  if (!account) return null;
  account.failedLoginAttempts = 0;
  account.accountStatus = "active";
  account.lockedUntil = null;
  account.updatedBy = actor;
  addSecurityAuditLog({ actor, role: "hr", action: "HR unlocked account", target: account.fullName, description: "Mở khóa tài khoản và reset số lần đăng nhập sai." });
  return account;
}

export function requestPasswordReset(identifier, actor = "Employee") {
  const account = findAccount(identifier);
  addSecurityAuditLog({ actor, role: "employee", action: "Password reset requested", target: account?.fullName || identifier, description: "Yêu cầu đặt lại mật khẩu, không ghi nhận mật khẩu.", result: account ? "Success" : "Failed" });
  return Boolean(account);
}

export function forcePasswordChange(employeeCode, actor = "Phạm Thu Hà") {
  const account = authAccounts.find((item) => item.employeeCode === employeeCode);
  if (!account) return null;
  account.passwordResetRequired = true;
  account.accountStatus = "passwordResetRequired";
  account.updatedBy = actor;
  addSecurityAuditLog({ actor, role: "hr", action: "Password reset required enabled", target: account.fullName, description: "Buộc nhân viên đổi mật khẩu ở lần đăng nhập tiếp theo." });
  return account;
}

export function resetEmployeePassword(employeeCode, options = {}) {
  const account = authAccounts.find((item) => item.employeeCode === employeeCode);
  if (!account) return null;
  const temporaryPassword = options.temporaryPassword || generateTemporaryPassword();
  account.passwordHash = mockPasswordHash(temporaryPassword);
  account.temporaryPasswordGeneratedAt = now;
  account.failedLoginAttempts = 0;
  account.lockedUntil = null;
  if (options.requireChange !== false) {
    account.passwordResetRequired = true;
    account.accountStatus = "passwordResetRequired";
  } else {
    account.accountStatus = "active";
  }
  account.updatedBy = options.actor || "Phạm Thu Hà";
  addSecurityAuditLog({ actor: account.updatedBy, role: "hr", action: "HR reset password", target: account.fullName, description: "Reset mật khẩu. Audit log không ghi mật khẩu tạm thời." });
  addSecurityAuditLog({ actor: account.updatedBy, role: "hr", action: "Temporary password generated", target: account.fullName, description: "Mật khẩu tạm thời chỉ hiển thị một lần." });
  return { account, temporaryPassword };
}

export function disableAccount(employeeCode, reason, actor = "Phạm Thu Hà") {
  const account = authAccounts.find((item) => item.employeeCode === employeeCode);
  if (!account) return null;
  account.accountStatus = "disabled";
  account.updatedBy = actor;
  addSecurityAuditLog({ actor, role: "hr", action: "HR disabled account", target: account.fullName, description: `Vô hiệu hóa tài khoản. Lý do: ${reason}.` });
  return account;
}

export function checkLoginCredentials(identifier, password) {
  const account = findAccount(identifier);
  if (!account) return { ok: false, reason: "accountNotFound" };
  if (account.accountStatus === "disabled") return { ok: false, reason: "disabled", account };
  if (account.accountStatus === "temporarilyLocked") return { ok: false, reason: "locked", account };
  if (account.passwordHash !== mockPasswordHash(password)) {
    account.failedLoginAttempts += 1;
    account.lastFailedLoginAt = now;
    addSecurityAuditLog({ actor: account.fullName, role: account.role, action: "Login failed", target: account.fullName, description: `Sai mật khẩu lần ${account.failedLoginAttempts}. Không ghi mật khẩu.`, result: "Failed" });
    if (account.failedLoginAttempts >= 5) {
      lockAccount(account);
      return { ok: false, reason: "locked", account, attempts: account.failedLoginAttempts };
    }
    return { ok: false, reason: "wrongPassword", account, attempts: account.failedLoginAttempts };
  }
  account.failedLoginAttempts = 0;
  account.lastLoginAt = now;
  if (account.passwordResetRequired) return { ok: true, reason: "passwordResetRequired", account };
  return { ok: true, reason: "success", account };
}

export function changePassword(employeeCode, newPassword) {
  const account = authAccounts.find((item) => item.employeeCode === employeeCode);
  if (!account) return null;
  account.passwordHash = mockPasswordHash(newPassword);
  account.passwordResetRequired = false;
  account.accountStatus = "active";
  account.temporaryPasswordGeneratedAt = null;
  account.updatedBy = account.fullName;
  addSecurityAuditLog({ actor: account.fullName, role: account.role, action: "Employee changed password", target: account.fullName, description: "Nhân viên đổi mật khẩu. Audit log không ghi mật khẩu." });
  return account;
}
