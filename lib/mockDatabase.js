const ACCOUNT_KEY = "mykis.accounts.v1";
const AUDIT_KEY = "mykis.securityAudit.v1";
const SESSION_KEY = "mykis.session.v1";

const actor = { id: "HR-001", name: "Nguyễn Thị Cẩm Thanh", role: "hr" };
export const DEMO_HR_EMAIL = "thanh.ntc@kisvn.vn";
export const DEMO_HR_PASSWORD = "Demo@123456";

const demoHrAccount = {
  id: "acc-hr-demo",
  employeeCode: "HR-001",
  fullName: "Nguyễn Thị Cẩm Thanh",
  email: DEMO_HR_EMAIL,
  department: "HR",
  position: "HR/L&D Manager",
  role: "hr",
  accountStatus: "active",
  passwordHash: hashPassword(DEMO_HR_PASSWORD),
  passwordResetRequired: false,
  failedLoginAttempts: 0,
  lastLoginAt: null,
  lastFailedLoginAt: null,
  lockedUntil: null,
  createdAt: "2026-01-04 08:00",
  createdBy: "System",
  updatedAt: "2026-06-19 08:00",
  updatedBy: "System",
};

const seedAccounts = [
  {
    id: "acc-001",
    employeeCode: "KIS-2026-001",
    fullName: "Nguyễn Văn An",
    email: "an.nguyen@kisvn.vn",
    department: "Môi giới",
    position: "Chuyên viên Môi giới",
    role: "employee",
    accountStatus: "active",
    passwordHash: hashPassword("Training@2026"),
    passwordResetRequired: false,
    failedLoginAttempts: 1,
    lastLoginAt: "2026-06-18 09:42",
    lastFailedLoginAt: "2026-06-18 09:20",
    lockedUntil: null,
    createdAt: "2026-06-17 08:15",
    createdBy: "Nguyễn Thị Cẩm Thanh",
    updatedAt: "2026-06-18 09:42",
    updatedBy: "System",
  },
  {
    id: "acc-002",
    employeeCode: "KIS-2026-002",
    fullName: "Trần Minh Anh",
    email: "anh.tran@kisvn.vn",
    department: "Phân tích",
    position: "Chuyên viên Phân tích",
    role: "employee",
    accountStatus: "active",
    passwordHash: hashPassword("Training@2026"),
    passwordResetRequired: false,
    failedLoginAttempts: 0,
    lastLoginAt: "2026-06-18 10:11",
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: "2026-06-10 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
    updatedAt: "2026-06-18 10:11",
    updatedBy: "System",
  },
  {
    id: "acc-003",
    employeeCode: "KIS-2026-003",
    fullName: "Lê Hoàng Nam",
    email: "nam.le@kisvn.vn",
    department: "Vận hành",
    position: "Chuyên viên Vận hành",
    role: "employee",
    accountStatus: "temporarilyLocked",
    passwordHash: hashPassword("Training@2026"),
    passwordResetRequired: false,
    failedLoginAttempts: 5,
    lastLoginAt: null,
    lastFailedLoginAt: "2026-06-18 09:58",
    lockedUntil: "2026-06-18 10:15",
    createdAt: "2026-06-17 08:22",
    createdBy: "Nguyễn Thị Cẩm Thanh",
    updatedAt: "2026-06-18 09:58",
    updatedBy: "System",
  },
  {
    id: "acc-004",
    employeeCode: "KIS-2026-004",
    fullName: "Phạm Thu Hà",
    email: "ha.pham@kisvn.vn",
    department: "HR",
    position: "Chuyên viên L&D",
    role: "employee",
    accountStatus: "active",
    passwordHash: hashPassword("KIS@Temp2026"),
    passwordResetRequired: true,
    failedLoginAttempts: 0,
    lastLoginAt: null,
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: "2026-06-18 08:30",
    createdBy: "Nguyễn Thị Cẩm Thanh",
    updatedAt: "2026-06-18 08:30",
    updatedBy: "Nguyễn Thị Cẩm Thanh",
  },
  {
    id: "acc-005",
    employeeCode: "KIS-2026-005",
    fullName: "Đỗ Gia Huy",
    email: "huy.do@kisvn.vn",
    department: "IT",
    position: "Kỹ sư hệ thống",
    role: "manager",
    accountStatus: "active",
    passwordHash: hashPassword("Training@2026"),
    passwordResetRequired: false,
    failedLoginAttempts: 0,
    lastLoginAt: "2026-06-18 09:12",
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: "2026-01-04 08:00",
    createdBy: "Nguyễn Thị Cẩm Thanh",
    updatedAt: "2026-06-18 09:12",
    updatedBy: "System",
  },
  {
    id: "acc-hr-001",
    employeeCode: "HR-001",
    fullName: "Nguyễn Thị Cẩm Thanh",
    email: "hr@kisvn.vn",
    department: "HR",
    position: "HR/L&D Manager",
    role: "hr",
    accountStatus: "active",
    passwordHash: hashPassword("Training@2026"),
    passwordResetRequired: false,
    failedLoginAttempts: 0,
    lastLoginAt: "2026-06-18 09:55",
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: "2026-01-04 08:00",
    createdBy: "Super Admin",
    updatedAt: "2026-06-18 09:55",
    updatedBy: "System",
  },
  {
    id: "acc-sa-001",
    employeeCode: "SA-001",
    fullName: "Super Admin",
    email: "superadmin@kisvn.vn",
    department: "IT",
    position: "System Owner",
    role: "superAdmin",
    accountStatus: "active",
    passwordHash: hashPassword("Training@2026"),
    passwordResetRequired: false,
    failedLoginAttempts: 0,
    lastLoginAt: null,
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: "2026-01-04 08:00",
    createdBy: "System",
    updatedAt: "2026-01-04 08:00",
    updatedBy: "System",
  },
];

const seedAudit = [
  auditSeed("Login failed", "Nguyễn Văn An", "Sai mật khẩu lần 1. Không ghi nhận mật khẩu.", "failed"),
  auditSeed("Account locked", "Lê Hoàng Nam", "Tài khoản tạm khóa sau 5 lần đăng nhập sai.", "success"),
  auditSeed("Temporary password generated", "Phạm Thu Hà", "Mật khẩu tạm thời chỉ hiển thị một lần.", "success"),
];

function auditSeed(action, targetEmployeeName, description, result) {
  return {
    id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
    actorId: "system",
    actorName: result === "failed" ? targetEmployeeName : "System",
    actorRole: result === "failed" ? "employee" : "system",
    action,
    targetAccountId: "",
    targetEmployeeName,
    description,
    result,
    createdAt: "2026-06-18 09:58",
    ipAddress: "10.10.24.18",
    device: "Prototype Browser",
  };
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function initMockDatabase() {
  if (!localStorage.getItem(ACCOUNT_KEY)) writeJson(ACCOUNT_KEY, seedAccounts);
  if (!localStorage.getItem(AUDIT_KEY)) writeJson(AUDIT_KEY, seedAudit);
  ensureDemoHrAccount();
}

export function hashPassword(password) {
  return `mock$${btoa(unescape(encodeURIComponent(password)))}`;
}

export function mockVerifyPassword(account, password) {
  if (account.email?.toLowerCase() === DEMO_HR_EMAIL && password === DEMO_HR_PASSWORD) return true;
  return account.passwordHash === hashPassword(password);
}

export function verifyPassword(account, password) {
  return mockVerifyPassword(account, password);
}

export function getAccounts() {
  initMockDatabase();
  return readJson(ACCOUNT_KEY, seedAccounts);
}

function saveAccounts(accounts) {
  writeJson(ACCOUNT_KEY, accounts);
}

export function ensureDemoHrAccount() {
  const accounts = readJson(ACCOUNT_KEY, seedAccounts);
  const normalizedEmail = DEMO_HR_EMAIL.toLowerCase();
  const withoutStaleDemo = accounts.filter((account) => account.email?.toLowerCase() !== normalizedEmail && account.id !== demoHrAccount.id);
  const existingLegacyHr = withoutStaleDemo.find((account) => account.id === "acc-hr-001" || account.email?.toLowerCase() === "hr@kisvn.vn");
  const normalizedDemo = {
    ...demoHrAccount,
    id: existingLegacyHr?.id || demoHrAccount.id,
    employeeCode: existingLegacyHr?.employeeCode || demoHrAccount.employeeCode,
    lastLoginAt: existingLegacyHr?.email?.toLowerCase() === normalizedEmail ? existingLegacyHr.lastLoginAt : demoHrAccount.lastLoginAt,
    createdAt: existingLegacyHr?.createdAt || demoHrAccount.createdAt,
    createdBy: existingLegacyHr?.createdBy || demoHrAccount.createdBy,
    passwordHash: hashPassword(DEMO_HR_PASSWORD),
    accountStatus: "active",
    passwordResetRequired: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    role: "hr",
    fullName: "Nguyễn Thị Cẩm Thanh",
    email: DEMO_HR_EMAIL,
  };

  if (existingLegacyHr) {
    const index = withoutStaleDemo.findIndex((account) => account.id === existingLegacyHr.id);
    withoutStaleDemo[index] = normalizedDemo;
  } else {
    withoutStaleDemo.unshift(normalizedDemo);
  }

  writeJson(ACCOUNT_KEY, withoutStaleDemo);
  return normalizedDemo;
}

export function resetDemoHrAccount() {
  const accounts = readJson(ACCOUNT_KEY, seedAccounts).filter((account) => (
    account.id !== demoHrAccount.id
    && account.email?.toLowerCase() !== DEMO_HR_EMAIL
    && account.email?.toLowerCase() !== "hr@kisvn.vn"
    && account.id !== "acc-hr-001"
  ));
  const resetAccount = {
    ...demoHrAccount,
    passwordHash: hashPassword(DEMO_HR_PASSWORD),
    accountStatus: "active",
    passwordResetRequired: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
    updatedAt: now(),
    updatedBy: "System",
  };
  accounts.unshift(resetAccount);
  writeJson(ACCOUNT_KEY, accounts);
  clearSession();
  addSecurityAuditLog({
    actorName: "System",
    actorRole: "system",
    action: "Reset demo HR account",
    targetAccountId: resetAccount.id,
    targetEmployeeName: resetAccount.fullName,
    description: "Demo HR account was reset to active and ready for login.",
  });
  return resetAccount;
}

export function getAccountById(id) {
  return getAccounts().find((account) => account.id === id) || null;
}

export function findAccount(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  return getAccounts().find((account) => account.email.toLowerCase() === value) || null;
}

export function createAccount(data) {
  const account = {
    id: crypto.randomUUID?.() || `acc-${Date.now()}`,
    accountStatus: "pendingActivation",
    passwordHash: hashPassword(data.temporaryPassword || "KIS@Temp2026"),
    passwordResetRequired: true,
    failedLoginAttempts: 0,
    lastLoginAt: null,
    lastFailedLoginAt: null,
    lockedUntil: null,
    createdAt: now(),
    createdBy: actor.name,
    updatedAt: now(),
    updatedBy: actor.name,
    ...data,
  };
  const accounts = getAccounts();
  accounts.unshift(account);
  saveAccounts(accounts);
  addSecurityAuditLog({
    action: "Create account",
    targetAccountId: account.id,
    targetEmployeeName: account.fullName,
    description: "HR created account and sent activation email.",
  });
  return account;
}

export function updateAccount(id, data) {
  const accounts = getAccounts();
  const index = accounts.findIndex((account) => account.id === id);
  if (index < 0) return null;
  accounts[index] = { ...accounts[index], ...data, updatedAt: now(), updatedBy: actor.name };
  saveAccounts(accounts);
  return accounts[index];
}

export function resetPassword(accountId, temporaryPassword, options = {}) {
  const account = getAccountById(accountId);
  if (!account) return null;
  const temp = temporaryPassword || generateTemporaryPassword();
  const updated = updateAccount(accountId, {
    passwordHash: hashPassword(temp),
    passwordResetRequired: options.requireChange !== false,
    failedLoginAttempts: 0,
    accountStatus: options.unlock ? "active" : account.accountStatus === "temporarilyLocked" ? "active" : account.accountStatus,
    lockedUntil: options.unlock ? null : account.lockedUntil,
  });
  addSecurityAuditLog({
    action: "Reset password",
    targetAccountId: accountId,
    targetEmployeeName: account.fullName,
    description: "Password reset. Temporary password is not stored in audit log.",
  });
  return { account: updated, temporaryPassword: temp };
}

export function forcePasswordChange(accountId) {
  const account = getAccountById(accountId);
  if (!account) return null;
  const updated = updateAccount(accountId, { passwordResetRequired: true });
  addSecurityAuditLog({
    action: "Force password change",
    targetAccountId: accountId,
    targetEmployeeName: account.fullName,
    description: "Employee must change password on next login.",
  });
  return updated;
}

export function unlockAccount(accountId) {
  const account = getAccountById(accountId);
  if (!account) return null;
  const updated = updateAccount(accountId, { accountStatus: "active", failedLoginAttempts: 0, lockedUntil: null });
  addSecurityAuditLog({
    action: "Unlock account",
    targetAccountId: accountId,
    targetEmployeeName: account.fullName,
    description: "Account unlocked by HR.",
  });
  return updated;
}

export function disableAccount(accountId, reason = "") {
  const account = getAccountById(accountId);
  if (!account) return null;
  const updated = updateAccount(accountId, { accountStatus: "disabled" });
  addSecurityAuditLog({
    action: "Disable account",
    targetAccountId: accountId,
    targetEmployeeName: account.fullName,
    description: `Account disabled. Reason: ${reason || "N/A"}.`,
  });
  return updated;
}

export function resendActivationEmail(accountId) {
  const account = getAccountById(accountId);
  if (!account) return null;
  addSecurityAuditLog({
    action: "Resend activation email",
    targetAccountId: accountId,
    targetEmployeeName: account.fullName,
    description: "Activation email resent.",
  });
  return account;
}

export function getSecurityAuditLog() {
  initMockDatabase();
  return readJson(AUDIT_KEY, seedAudit);
}

export function addSecurityAuditLog(event) {
  const entry = {
    id: crypto.randomUUID?.() || `audit-${Date.now()}`,
    actorId: actor.id,
    actorName: event.actorName || actor.name,
    actorRole: event.actorRole || actor.role,
    result: "success",
    createdAt: now(),
    ipAddress: "10.10.24.18",
    device: "Prototype Browser",
    ...event,
  };
  const logs = getSecurityAuditLog();
  logs.unshift(entry);
  writeJson(AUDIT_KEY, logs);
  return entry;
}

export function login(identifier, password) {
  const account = findAccount(identifier);
  if (!account) return { ok: false, reason: "accountNotFound" };
  if (account.email?.toLowerCase() === DEMO_HR_EMAIL) ensureDemoHrAccount();
  const freshAccount = findAccount(identifier) || account;
  if (freshAccount.accountStatus === "disabled") return { ok: false, reason: "disabled", account: freshAccount };
  if (freshAccount.accountStatus === "temporarilyLocked") return { ok: false, reason: "locked", account: freshAccount };
  if (!verifyPassword(freshAccount, password)) {
    const failed = freshAccount.failedLoginAttempts + 1;
    const locked = failed >= 5;
    updateAccount(freshAccount.id, {
      failedLoginAttempts: failed,
      lastFailedLoginAt: now(),
      accountStatus: locked ? "temporarilyLocked" : freshAccount.accountStatus,
      lockedUntil: locked ? plusMinutes(15) : freshAccount.lockedUntil,
    });
    addSecurityAuditLog({
      actorName: freshAccount.fullName,
      actorRole: freshAccount.role,
      action: locked ? "Account locked" : "Login failed",
      targetAccountId: freshAccount.id,
      targetEmployeeName: freshAccount.fullName,
      description: `Failed login attempt ${failed}. Password is not stored.`,
      result: locked ? "success" : "failed",
    });
    return { ok: false, reason: locked ? "locked" : "wrongPassword", attempts: failed, account: freshAccount };
  }
  const updated = updateAccount(freshAccount.id, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now() });
  setSession({ accountId: freshAccount.id, role: freshAccount.role, fullName: freshAccount.fullName });
  if (freshAccount.passwordResetRequired) return { ok: true, reason: "passwordResetRequired", account: updated };
  return { ok: true, reason: "success", account: updated };
}

export function changePassword(accountId, currentPassword, newPassword) {
  const account = getAccountById(accountId);
  if (!account || !verifyPassword(account, currentPassword)) return { ok: false, reason: "wrongCurrentPassword" };
  updateAccount(accountId, {
    passwordHash: hashPassword(newPassword),
    passwordResetRequired: false,
    accountStatus: account.accountStatus === "temporarilyLocked" ? "active" : account.accountStatus,
  });
  addSecurityAuditLog({
    actorName: account.fullName,
    actorRole: account.role,
    action: "Change password",
    targetAccountId: account.id,
    targetEmployeeName: account.fullName,
    description: "User changed password. Password is not stored in audit log.",
  });
  return { ok: true, account: getAccountById(accountId) };
}

export function getSession() {
  return readJson(SESSION_KEY, null);
}

export function setSession(session) {
  writeJson(SESSION_KEY, session);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function generateTemporaryPassword() {
  return `KIS@${Math.random().toString(36).slice(2, 8)}26`;
}

function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function plusMinutes(minutes) {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
