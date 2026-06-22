import { importedEmployees, importSummary } from "../data/employees.js";
import { courseApiService } from "./services/courseApiService.js";

// Fire-and-forget helpers — never block synchronous callers
function apiSyncCourse(course, actorAccountId) {
  courseApiService.saveCourse(course, actorAccountId).catch((err) =>
    console.warn("[course-sync] saveCourse failed:", err?.message)
  );
}
function apiSyncEnrollment(enrollment, actorAccountId) {
  courseApiService.assignEnrollments([enrollment], actorAccountId).catch((err) =>
    console.warn("[course-sync] assignEnrollment failed:", err?.message)
  );
}
function apiSyncContent(courseId, items, actorAccountId) {
  courseApiService.saveContent(courseId, items, actorAccountId).catch((err) =>
    console.warn("[course-sync] saveContent failed:", err?.message)
  );
}
function apiSyncProgress(progress, accountId) {
  courseApiService.saveProgress(progress, accountId, "employee").catch((err) =>
    console.warn("[course-sync] saveProgress failed:", err?.message)
  );
}

const ACCOUNT_KEY = "mykis.accounts.v1";
const AUDIT_KEY = "mykis.securityAudit.v1";
const SESSION_KEY = "mykis.session.v1";
const EMPLOYEE_OVERRIDE_KEY = "mykis.employeeOverrides.v1";
const CUSTOM_EMPLOYEES_KEY = "mykis.customEmployees.v1";

const actor = { id: "HR-001", name: "Nguyễn Thị Cẩm Thanh", role: "hr" };
export const DEMO_HR_EMAIL = "thanh.ntc@kisvn.vn";
export const DEMO_HR_PASSWORD = "Demo@123456";
export const DEMO_EMPLOYEE_EMAIL = "an.nguyen@kisvn.vn";
export const DEMO_EMPLOYEE_PASSWORD = "Training@2026";
export const HR_SUPPORT_NAME = "Ms. Thanh";
export const HR_SUPPORT_EMAIL = DEMO_HR_EMAIL;

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
    email: DEMO_EMPLOYEE_EMAIL,
    department: "Môi giới",
    position: "Chuyên viên Môi giới",
    role: "employee",
    accountStatus: "active",
    passwordHash: hashPassword(DEMO_EMPLOYEE_PASSWORD),
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
    role: "employee",
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
  else {
    const accounts=readJson(ACCOUNT_KEY,seedAccounts); let changed=false;
    accounts.forEach(account=>{if(account.role==="manager"){account.role="employee";changed=true;}});
    if(changed)writeJson(ACCOUNT_KEY,accounts);
  }
  if (!localStorage.getItem(AUDIT_KEY)) writeJson(AUDIT_KEY, seedAudit);
  seedLearningData();
  seedImportedAccounts();
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

function employeeMatchKey(employee) {
  return `${employee.fullName}|${employee.department}|${employee.position}`.toLowerCase();
}

function seedImportedAccounts() {
  const accounts = readJson(ACCOUNT_KEY, seedAccounts);
  const byEmail = new Map(accounts.filter((account) => account.email).map((account) => [account.email.toLowerCase(), account]));
  const byProfile = new Map(accounts.map((account) => [employeeMatchKey(account), account]));
  let changed = false;

  for (const employee of importedEmployees) {
    if (employee.dataIssue || !employee.email) continue;
    const isDemoHr = employee.email.toLowerCase() === DEMO_HR_EMAIL;
    const existing = byEmail.get(employee.email.toLowerCase()) || byProfile.get(employeeMatchKey(employee));
    if (existing) {
      const protectedHr = existing.email?.toLowerCase() === DEMO_HR_EMAIL;
      Object.assign(existing, {
        employeeCode: `KIS-${String(employee.originalNo).padStart(3, "0")}`,
        fullName: protectedHr ? "Nguyễn Thị Cẩm Thanh" : employee.fullName,
        department: employee.department,
        position: protectedHr ? existing.position : employee.position,
        email: protectedHr ? DEMO_HR_EMAIL : employee.email,
        role: protectedHr ? "hr" : existing.role || employee.role,
        importedEmployeeId: employee.id,
        certificateType: employee.certificateType,
        leadershipTraining: employee.leadershipTraining,
        communicationTraining: employee.communicationTraining,
        specializationCourses: employee.specializationCourses,
        dataIssue: employee.dataIssue || "",
      });
      changed = true;
    } else {
      accounts.push({
        id: `acc-${employee.id}`,
        employeeCode: `KIS-${String(employee.originalNo).padStart(3, "0")}`,
        fullName: employee.fullName,
        email: employee.email,
        department: employee.department,
        position: employee.position,
        role: isDemoHr ? "hr" : "employee",
        accountStatus: isDemoHr ? "active" : "pendingActivation",
        passwordHash: hashPassword(isDemoHr ? DEMO_HR_PASSWORD : "KIS@Temp2026"),
        passwordResetRequired: !isDemoHr,
        failedLoginAttempts: 0,
        lastLoginAt: null,
        lastFailedLoginAt: null,
        lockedUntil: null,
        createdAt: "2026-06-19 08:00",
        createdBy: "Import",
        updatedAt: "2026-06-19 08:00",
        updatedBy: "Import",
        importedEmployeeId: employee.id,
        certificateType: employee.certificateType,
        leadershipTraining: employee.leadershipTraining,
        communicationTraining: employee.communicationTraining,
        specializationCourses: employee.specializationCourses,
        dataIssue: "",
      });
      changed = true;
    }
  }

  if (changed) writeJson(ACCOUNT_KEY, accounts);
}

export function getImportSummary() {
  return importSummary;
}

export function getEmployees() {
  const accounts = readJson(ACCOUNT_KEY, seedAccounts);
  const overrides = readJson(EMPLOYEE_OVERRIDE_KEY, {});
  const byEmail = new Map(accounts.filter((account) => account.email).map((account) => [account.email.toLowerCase(), account]));
  const byEmployeeId = new Map(accounts.filter((account) => account.importedEmployeeId).map((account) => [account.importedEmployeeId, account]));
  const merged = [...importedEmployees, ...readJson(CUSTOM_EMPLOYEES_KEY, [])].map((employee) => ({
    ...employee,
    ...(overrides[employee.id] || {}),
    specializationCourses: {
      ...employee.specializationCourses,
      ...(overrides[employee.id]?.specializationCourses || {}),
    },
  }));
  const emailCounts = merged.reduce((acc, employee) => {
    if (employee.email) acc[employee.email.toLowerCase()] = (acc[employee.email.toLowerCase()] || 0) + 1;
    return acc;
  }, {});
  return merged.map((employee) => {
    const dynamicIssue = !employee.email && employee.fullName === "Trần Thị Kim Thanh"
      ? "invalid_email"
      : employee.email && emailCounts[employee.email.toLowerCase()] > 1
        ? "duplicate_email"
        : "";
    const account = (employee.email && !employee.dataIssue ? byEmail.get(employee.email.toLowerCase()) : null) || byEmployeeId.get(employee.id);
    const isDemoHr = employee.email?.toLowerCase() === DEMO_HR_EMAIL;
    return {
      ...employee,
      dataIssue: dynamicIssue,
      role: isDemoHr ? "hr" : account?.role || employee.role,
      accountStatus: isDemoHr ? "active" : dynamicIssue ? "pendingReview" : account?.accountStatus || employee.accountStatus,
      passwordResetRequired: isDemoHr ? false : account?.passwordResetRequired ?? employee.passwordResetRequired,
      failedLoginAttempts: isDemoHr ? 0 : account?.failedLoginAttempts ?? 0,
      lockedUntil: isDemoHr ? null : account?.lockedUntil ?? null,
      accountId: account?.id || "",
    };
  });
}

export function createEmployeeRecord(data) {
  const fullName=String(data?.fullName||"").trim(),email=String(data?.email||"").trim().toLowerCase(),employeeCode=String(data?.employeeCode||"").trim();
  if(!fullName||!employeeCode||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false,error:"invalid_employee"};
  const accounts=getAccounts(); if(accounts.some(a=>a.email?.toLowerCase()===email))return {ok:false,error:"duplicate_email"}; if(accounts.some(a=>a.employeeCode?.toLowerCase()===employeeCode.toLowerCase()))return {ok:false,error:"duplicate_code"};
  const temporaryPassword=data.temporaryPassword||generateTemporaryPassword(); const id=`employee-${crypto.randomUUID?.()||Date.now()}`;
  const account=createAccount({employeeCode,fullName,email,department:String(data.department||""),position:String(data.position||""),role:"employee",accountStatus:data.accountStatus||"active",temporaryPassword,passwordResetRequired:true,importedEmployeeId:id});
  if(!account)return {ok:false,error:"account_failed"};
  const rows=readJson(CUSTOM_EMPLOYEES_KEY,[]); rows.push({id,originalNo:null,fullName,email,department:String(data.department||""),position:String(data.position||""),jobTitle:String(data.position||""),employeeCode,joinDate:data.joinDate||"",defaultLanguage:data.defaultLanguage||"vi",phone:data.phone||"",location:data.location||"",managerName:data.managerName||"",notes:data.notes||"",role:"employee",accountStatus:account.accountStatus,accountId:account.id,createdAt:now()}); writeJson(CUSTOM_EMPLOYEES_KEY,rows);
  addSecurityAuditLog({action:"Create employee",targetAccountId:account.id,targetEmployeeName:fullName,description:"HR created employee profile and account."}); return {ok:true,employee:getEmployees().find(e=>e.id===id),account,temporaryPassword};
}

export function updateEmployeeProfile(employeeId, data) {
  const overrides = readJson(EMPLOYEE_OVERRIDE_KEY, {});
  overrides[employeeId] = { ...(overrides[employeeId] || {}), ...data };
  if (typeof overrides[employeeId].email === "string") overrides[employeeId].email = overrides[employeeId].email.trim().toLowerCase();
  writeJson(EMPLOYEE_OVERRIDE_KEY, overrides);

  const employee = getEmployees().find((item) => item.id === employeeId);
  if (!employee || employee.dataIssue || !employee.email) return employee;
  const accounts = readJson(ACCOUNT_KEY, seedAccounts);
  const existing = accounts.find((account) => account.importedEmployeeId === employee.id || account.email?.toLowerCase() === employee.email.toLowerCase());
  if (existing) {
    Object.assign(existing, {
      fullName: employee.fullName,
      department: employee.department,
      position: employee.position,
      email: employee.email,
      dataIssue: "",
      updatedAt: now(),
      updatedBy: actor.name,
    });
  } else {
    accounts.push({
      id: `acc-${employee.id}`,
      employeeCode: `KIS-${String(employee.originalNo).padStart(3, "0")}`,
      fullName: employee.fullName,
      email: employee.email,
      department: employee.department,
      position: employee.position,
      role: "employee",
      accountStatus: "pendingActivation",
      passwordHash: hashPassword("KIS@Temp2026"),
      passwordResetRequired: true,
      failedLoginAttempts: 0,
      lastLoginAt: null,
      lastFailedLoginAt: null,
      lockedUntil: null,
      createdAt: now(),
      createdBy: actor.name,
      updatedAt: now(),
      updatedBy: actor.name,
      importedEmployeeId: employee.id,
      certificateType: employee.certificateType,
      leadershipTraining: employee.leadershipTraining,
      communicationTraining: employee.communicationTraining,
      specializationCourses: employee.specializationCourses,
      dataIssue: "",
    });
  }
  writeJson(ACCOUNT_KEY, accounts);
  addSecurityAuditLog({
    action: "Update employee email",
    targetAccountId: existing?.id || `acc-${employee.id}`,
    targetEmployeeName: employee.fullName,
    description: "HR updated employee email from imported profile.",
  });
  return getEmployees().find((item) => item.id === employeeId);
}

export function getEmployeeByAccountId(accountId) {
  const account = getAccountById(accountId);
  if (!account) return null;
  const employees = getEmployees();
  return employees.find((employee) => employee.accountId === account.id)
    || employees.find((employee) => employee.email && account.email && employee.email.toLowerCase() === account.email.toLowerCase())
    || null;
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
  const normalizedEmail = String(identifier || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { ok: false, reason: "invalidEmail" };
  const account = findAccount(normalizedEmail);
  if (!account) {
    addSecurityAuditLog({ actorName: "Unknown user", actorRole: "anonymous", action: "Login failed", targetAccountId: "", targetEmployeeName: "Unknown", description: "Login failed with invalid credentials. Password is not stored.", result: "failed" });
    return { ok: false, reason: "invalidCredentials" };
  }
  if (account.email?.toLowerCase() === DEMO_HR_EMAIL) ensureDemoHrAccount();
  const freshAccount = findAccount(normalizedEmail) || account;
  if (["disabled", "inactive", "suspended"].includes(freshAccount.accountStatus)) return { ok: false, reason: "inactive" };
  if (["temporarilyLocked", "locked"].includes(freshAccount.accountStatus)) return { ok: false, reason: "locked" };
  if (["pendingActivation", "pending"].includes(freshAccount.accountStatus)) return { ok: false, reason: "pending" };
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
    return { ok: false, reason: locked ? "locked" : "invalidCredentials", attempts: failed };
  }
  const updated = updateAccount(freshAccount.id, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now() });
  addSecurityAuditLog({ actorName: freshAccount.fullName, actorRole: freshAccount.role, action: "Login successful", targetAccountId: freshAccount.id, targetEmployeeName: freshAccount.fullName, description: "Successful authentication. No password data was logged.", result: "success" });
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

const COURSES_KEY = "mykis.courses.v1";
const ENROLLMENTS_KEY = "mykis.enrollments.v1";
const NOTIFICATIONS_KEY = "mykis.notifications.v1";
const QUIZZES_KEY = "mykis.quizzes.v1";
const QUIZ_ATTEMPTS_KEY = "mykis.quizAttempts.v1";
const COURSE_CONTENT_KEY = "mykis.courseContent.v2";
const CONTENT_PROGRESS_KEY = "mykis.contentProgress.v2";
const LEARNING_ACTIVITY_KEY = "mykis.learningActivity.v2";
const LEARNING_SCHEMA_KEY = "mykis.learningSchemaVersion";
const TRAINING_REVISION_KEY = "mykis.trainingDataRevision.v1";
function bumpTrainingRevision(){writeJson(TRAINING_REVISION_KEY,Number(readJson(TRAINING_REVISION_KEY,0))+1);}

const seedCourses = [
  { id: "course-001", title: "Leadership Training Course", titleKr: "리더십 교육 과정", description: "Phát triển năng lực lãnh đạo, quản lý đội ngũ", category: "Kỹ năng mềm", format: "Offline", durationHours: 16, status: "published", createdBy: "Nguyễn Thị Cẩm Thanh", createdAt: "2026-01-10 08:00", updatedAt: null, updatedBy: null, imageUrl: "/images/leadership-training-course.png" },
  { id: "course-002", title: "Communication Training Course", titleKr: "커뮤니케이션 교육 과정", description: "Kỹ năng giao tiếp, lắng nghe, phản hồi", category: "Kỹ năng mềm", format: "Offline", durationHours: 12, status: "published", createdBy: "Nguyễn Thị Cẩm Thanh", createdAt: "2026-01-10 08:00", updatedAt: null, updatedBy: null, imageUrl: "/images/communication-training-course.png" },
  { id: "course-003", title: "Kiến thức chứng khoán cơ bản", titleKr: "", description: "Củng cố kiến thức nền tảng thị trường chứng khoán", category: "Chuyên môn", format: "Online", durationHours: 8, status: "published", createdBy: "Nguyễn Thị Cẩm Thanh", createdAt: "2026-02-01 08:00", updatedAt: null, updatedBy: null },
  { id: "course-004", title: "Ôn tập Chứng chỉ hành nghề Môi giới chứng khoán", titleKr: "", description: "Lộ trình ôn tập và bộ đề luyện thi UBCKNN", category: "Chứng chỉ", format: "Hybrid", durationHours: 40, status: "published", createdBy: "Nguyễn Thị Cẩm Thanh", createdAt: "2026-02-15 08:00", updatedAt: null, updatedBy: null },
  { id: "course-005", title: "Kỹ năng báo cáo và trình bày vấn đề", titleKr: "", description: "Chuẩn hóa kỹ năng báo cáo, phối hợp với cấp quản lý", category: "Kỹ năng mềm", format: "Online", durationHours: 6, status: "draft", createdBy: "Nguyễn Thị Cẩm Thanh", createdAt: "2026-03-01 08:00", updatedAt: null, updatedBy: null },
];

const seedEnrollments = [
  { id: "enr-001", courseId: "course-001", accountId: "acc-001", assignedBy: "acc-hr-demo", assignedAt: "2026-06-01 09:00", deadline: "2026-07-31", status: "inProgress", progressPercent: 60, completedAt: null, note: "" },
  { id: "enr-002", courseId: "course-002", accountId: "acc-001", assignedBy: "acc-hr-demo", assignedAt: "2026-06-01 09:00", deadline: "2026-07-31", status: "completed", progressPercent: 100, completedAt: "2026-06-15 17:00", note: "" },
  { id: "enr-003", courseId: "course-001", accountId: "acc-002", assignedBy: "acc-hr-demo", assignedAt: "2026-06-05 10:00", deadline: "2026-07-31", status: "completed", progressPercent: 100, completedAt: "2026-06-20 16:30", note: "" },
  { id: "enr-004", courseId: "course-003", accountId: "acc-002", assignedBy: "acc-hr-demo", assignedAt: "2026-06-05 10:00", deadline: "2026-08-15", status: "inProgress", progressPercent: 45, completedAt: null, note: "" },
  { id: "enr-005", courseId: "course-004", accountId: "acc-003", assignedBy: "acc-hr-demo", assignedAt: "2026-06-10 08:00", deadline: "2026-09-30", status: "notStarted", progressPercent: 0, completedAt: null, note: "" },
  { id: "enr-006", courseId: "course-002", accountId: "acc-004", assignedBy: "acc-hr-demo", assignedAt: "2026-06-10 08:00", deadline: "2026-07-15", status: "overdue", progressPercent: 30, completedAt: null, note: "Nhân viên báo bận dự án" },
  { id: "enr-007", courseId: "course-001", accountId: "acc-005", assignedBy: "acc-hr-demo", assignedAt: "2026-06-12 09:00", deadline: "2026-07-31", status: "inProgress", progressPercent: 75, completedAt: null, note: "" },
  { id: "enr-008", courseId: "course-003", accountId: "acc-hr-demo", assignedBy: "acc-hr-demo", assignedAt: "2026-06-15 10:00", deadline: "2026-08-31", status: "inProgress", progressPercent: 20, completedAt: null, note: "" },
];

const seedNotifications = [
  { id: "notif-001", type: "course_assigned", title: "Bạn vừa được giao khóa học mới", body: "Leadership Training Course — Deadline: 31/07/2026", targetAccountId: "acc-001", createdBy: "acc-hr-demo", createdAt: "2026-06-01 09:00", isRead: false },
  { id: "notif-002", type: "deadline_reminder", title: "Nhắc nhở: Khóa học sắp đến hạn", body: "Communication Training Course — Còn 7 ngày", targetAccountId: "acc-004", createdBy: "system", createdAt: "2026-06-08 08:00", isRead: false },
  { id: "notif-003", type: "course_completed", title: "Chúc mừng hoàn thành khóa học!", body: "Communication Training Course — Hoàn thành 100%", targetAccountId: "acc-001", createdBy: "system", createdAt: "2026-06-15 17:00", isRead: true },
];

const seedQuizzes = [{ id: "quiz-001", courseId: "course-001", title: "Leadership Essentials", description: "Đánh giá kiến thức sau khóa học", status: "published", passingScore: 70, timeLimitMinutes: 20, attemptsAllowed: 2, shuffleQuestions: false, createdBy: "acc-hr-demo", createdAt: "2026-06-01 08:00", updatedAt: null, updatedBy: null, questions: [{ id: "q-001", text: "Đâu là nền tảng của phản hồi hiệu quả?", type: "singleChoice", options: [{ id: "o-001", text: "Dữ kiện cụ thể" }, { id: "o-002", text: "Phán đoán cá nhân" }], correctOptionId: "o-001", explanation: "Phản hồi nên dựa trên hành vi và dữ kiện quan sát được.", points: 1 }] }];

const seedCourseContent = [
  { id:"content-001", courseId:"course-001", title:"Nền tảng lãnh đạo", type:"slide", order:1, required:true, completionWeight:1, minimumDurationSeconds:8, slides:[{id:"slide-001",title:"Vai trò của người lãnh đạo",alt:"Sơ đồ vai trò lãnh đạo tại KIS",minimumViewSeconds:8,order:1,content:"Lãnh đạo tạo sự rõ ràng về mục tiêu, trách nhiệm và phản hồi."},{id:"slide-002",title:"Phản hồi dựa trên dữ kiện",alt:"Ba bước phản hồi dựa trên dữ kiện",minimumViewSeconds:12,order:2,content:"Quan sát hành vi, mô tả tác động và thống nhất hành động tiếp theo."}] },
  { id:"content-002", courseId:"course-001", title:"Video: Trao đổi hiệu quả", type:"video", order:2, required:true, completionWeight:2, minimumDurationSeconds:20, sourceType:"uploaded", sourceUrl:"", transcript:"Trao đổi hiệu quả bắt đầu từ mục tiêu rõ ràng, lắng nghe và phản hồi dựa trên dữ kiện.", transcriptAlternativeAllowed:true, completionRule:{requiredPercent:90,maxPlaybackRate:1.25,minimumVolume:0.1} },
  { id:"content-003", courseId:"course-001", title:"Kiểm tra nhanh", type:"quiz", order:3, required:true, completionWeight:2, quizId:"quiz-001", completionRule:{requirePass:true} },
  { id:"content-004", courseId:"course-001", title:"Tổng kết và cam kết hành động", type:"slide", order:4, required:true, completionWeight:1, minimumDurationSeconds:8, slides:[{id:"slide-003",title:"Cam kết hành động",alt:"Danh sách cam kết sau khóa học",minimumViewSeconds:8,order:1,content:"Chọn một hành vi lãnh đạo bạn sẽ áp dụng trong tuần này."}] },
  { id:"content-005", courseId:"course-002", title:"Giao tiếp tại KIS", type:"slide", order:1, required:true, completionWeight:1, minimumDurationSeconds:8, slides:[{id:"slide-004",title:"Lắng nghe chủ động",alt:"Nguyên tắc lắng nghe chủ động",minimumViewSeconds:8,order:1,content:"Xác nhận điều đã nghe trước khi phản hồi hoặc đề xuất giải pháp."}] },
  { id:"content-006", courseId:"course-002", title:"Video YouTube mẫu", type:"video", order:2, required:true, completionWeight:2, minimumDurationSeconds:20, sourceType:"youtube", youtubeVideoId:"ysz5S6PUM-U", transcript:"Nội dung video có transcript thay thế cho người học cần hỗ trợ tiếp cận.", transcriptAlternativeAllowed:true, completionRule:{requiredPercent:90,maxPlaybackRate:1.25,minimumVolume:0.1} }
];

function seedLearningData() {
  if (!localStorage.getItem(COURSES_KEY)) writeJson(COURSES_KEY, seedCourses);
  if (!localStorage.getItem(ENROLLMENTS_KEY)) writeJson(ENROLLMENTS_KEY, seedEnrollments);
  if (!localStorage.getItem(NOTIFICATIONS_KEY)) writeJson(NOTIFICATIONS_KEY, seedNotifications);
  if (!localStorage.getItem(QUIZZES_KEY)) writeJson(QUIZZES_KEY, seedQuizzes);
  if (!localStorage.getItem(QUIZ_ATTEMPTS_KEY)) writeJson(QUIZ_ATTEMPTS_KEY, []);
  if (!localStorage.getItem(COURSE_CONTENT_KEY)) writeJson(COURSE_CONTENT_KEY, seedCourseContent);
  if (!localStorage.getItem(CONTENT_PROGRESS_KEY)) writeJson(CONTENT_PROGRESS_KEY, []);
  if (!localStorage.getItem(LEARNING_ACTIVITY_KEY)) writeJson(LEARNING_ACTIVITY_KEY, []);
  if (!localStorage.getItem(LEARNING_SCHEMA_KEY)) localStorage.setItem(LEARNING_SCHEMA_KEY, "2");
}

function getNextEntityId(items, prefix) {
  const maxSuffix = items.reduce((max, item) => {
    const match = typeof item?.id === "string" ? item.id.match(new RegExp(`^${prefix}-(\\d+)$`)) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(maxSuffix + 1).padStart(3, "0")}`;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidCourseStatus(status) {
  return ["draft", "published", "archived"].includes(status);
}

function readArray(key) {
  const value = readJson(key, []);
  return Array.isArray(value) ? value : [];
}

export function getCourses() {
  return readArray(COURSES_KEY).map(course=>({...course,deliveryMode:course.deliveryMode||String(course.format||"online").toLowerCase()}));
}

export function getCourseById(id) {
  if (!isNonEmptyString(id)) return null;
  return getCourses().find((course) => course.id === id.trim()) || null;
}

export function createCourse(data) {
  if (!data || !isNonEmptyString(data.title)) return null;
  const durationHours = Number(data.durationHours);
  if (!Number.isFinite(durationHours) || durationHours < 0 || !isValidCourseStatus(data.status)) return null;
  const courses = getCourses();
  const deliveryMode=["online","offline","hybrid"].includes(data.deliveryMode)?data.deliveryMode:"online";
  const course = {
    ...data,
    id: getNextEntityId(courses, "course"),
    title: data.title.trim(),
    durationHours,
    deliveryMode,
    createdAt: now(),
    updatedAt: null,
    updatedBy: data.updatedBy ?? null,
  };
  courses.push(course);
  writeJson(COURSES_KEY, courses);
  apiSyncCourse(course, data.createdBy || "hr");
  return course;
}

export function updateCourse(id, data) {
  if (!isNonEmptyString(id) || !data || typeof data !== "object") return null;
  const courses = getCourses();
  const index = courses.findIndex((course) => course.id === id.trim());
  if (index < 0) return null;
  if (Object.prototype.hasOwnProperty.call(data, "title") && !isNonEmptyString(data.title)) return null;
  if (Object.prototype.hasOwnProperty.call(data, "status") && !isValidCourseStatus(data.status)) return null;
  if(Object.prototype.hasOwnProperty.call(data,"deliveryMode")&&!["online","offline","hybrid"].includes(data.deliveryMode))return null;
  let durationHours = courses[index].durationHours;
  if (Object.prototype.hasOwnProperty.call(data, "durationHours")) {
    durationHours = Number(data.durationHours);
    if (!Number.isFinite(durationHours) || durationHours < 0) return null;
  }
  const { id: ignoredId, createdAt: ignoredCreatedAt, createdBy: ignoredCreatedBy, ...updates } = data;
  courses[index] = { ...courses[index], ...updates, durationHours, updatedAt: now() };
  writeJson(COURSES_KEY, courses);
  apiSyncCourse(courses[index], data.updatedBy || "hr");
  return courses[index];
}

export function deleteCourse(id) {
  if (!isNonEmptyString(id)) return false;
  const courses = getCourses();
  const filtered = courses.filter((course) => course.id !== id.trim());
  if (filtered.length === courses.length) return false;
  writeJson(COURSES_KEY, filtered);
  return true;
}

export function getEnrollments() {
  return readArray(ENROLLMENTS_KEY);
}

// One canonical, read-only LMS snapshot for public and authenticated dashboards.
export function getLmsOverviewStats() {
  const accounts = getAccounts();
  const courses = getCourses();
  const enrollments = getEnrollments();
  const attempts = getQuizAttempts();
  const activeEmployeeIds = new Set(accounts
    .filter((account) => account.role === "employee" && account.accountStatus === "active")
    .map((account) => account.id));
  const publishedCourseIds = new Set(courses.filter((course) => course.status === "published").map((course) => course.id));
  const validEnrollments = enrollments.filter((enrollment) => activeEmployeeIds.has(enrollment.accountId) && publishedCourseIds.has(enrollment.courseId));
  const normalized = validEnrollments.map((enrollment) => {
    const progress = calculateCourseProgress({ accountId: enrollment.accountId, courseId: enrollment.courseId });
    const overdue = !progress.completed && enrollment.deadline && new Date(enrollment.deadline).getTime() < Date.now();
    return { ...enrollment, progress, overdue };
  });
  const completedEnrollments = normalized.filter((row) => row.progress.completed).length;
  const submittedAttempts = attempts.filter((attempt) => attempt.submittedAt && attempt.gradingStatus === "graded" && typeof attempt.passed === "boolean");
  const scoreAttempts = submittedAttempts.filter((attempt) => Number.isFinite(Number(attempt.scorePercent)));
  return {
    totalActiveEmployees: activeEmployeeIds.size,
    totalPublishedCourses: publishedCourseIds.size,
    totalEnrollments: validEnrollments.length,
    completedEnrollments,
    inProgressEnrollments: normalized.filter((row) => !row.progress.completed && row.progress.percent > 0).length,
    overdueEnrollments: normalized.filter((row) => row.overdue).length,
    pendingGrading: attempts.filter((attempt) => attempt.submittedAt && attempt.gradingStatus === "pendingManual").length,
    completionRate: validEnrollments.length ? Math.round(completedEnrollments / validEnrollments.length * 100) : 0,
    totalQuizAttempts: submittedAttempts.length,
    quizPassRate: submittedAttempts.length ? Math.round(submittedAttempts.filter((attempt) => attempt.passed).length / submittedAttempts.length * 100) : 0,
    averageQuizScore: scoreAttempts.length ? Math.round(scoreAttempts.reduce((sum, attempt) => sum + Number(attempt.scorePercent), 0) / scoreAttempts.length) : 0,
  };
}

export function getEnrollmentsByAccountId(accountId) {
  if (!isNonEmptyString(accountId)) return [];
  const coursesById = new Map(getCourses().map((course) => [course.id, course]));
  return getEnrollments()
    .filter((enrollment) => enrollment.accountId === accountId.trim())
    .map((enrollment) => ({ ...enrollment, course: coursesById.get(enrollment.courseId) || null }));
}

export function getEnrollmentsByCourseId(courseId) {
  if (!isNonEmptyString(courseId)) return [];
  return getEnrollments().filter((enrollment) => enrollment.courseId === courseId.trim());
}

export function assignCourse(data) {
  if (!data || ![data.courseId, data.accountId, data.assignedBy, data.deadline].every(isNonEmptyString)) {
    return { ok: false, enrollment: null, reason: "invalid_data" };
  }
  const course = getCourseById(data.courseId);
  if (!course) return { ok: false, enrollment: null, reason: "course_not_found" };
  const enrollments = getEnrollments();
  const existing = enrollments.find((item) => item.courseId === data.courseId.trim() && item.accountId === data.accountId.trim());
  if (existing) return { ok: false, enrollment: existing, reason: "duplicate" };
  const enrollment = {
    id: getNextEntityId(enrollments, "enr"), courseId: data.courseId.trim(), accountId: data.accountId.trim(),
    assignedBy: data.assignedBy.trim(), assignedAt: now(), deadline: data.deadline.trim(), status: "notStarted",
    progressPercent: 0, completedAt: null, note: typeof data.note === "string" ? data.note : "",
  };
  enrollments.push(enrollment);
  writeJson(ENROLLMENTS_KEY, enrollments);
  apiSyncEnrollment(enrollment, data.assignedBy);
  createNotification({ type: "course_assigned", targetAccountId: enrollment.accountId, createdBy: enrollment.assignedBy, title: "Bạn vừa được giao khóa học mới", body: `${course.title} — Deadline: ${enrollment.deadline}` });
  return { ok: true, enrollment, reason: null };
}

export function updateEnrollmentProgress(id, progressPercent) {
  if (!isNonEmptyString(id)) return null;
  const progress = Number(progressPercent);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) return null;
  const enrollments = getEnrollments();
  const index = enrollments.findIndex((item) => item.id === id.trim());
  if (index < 0) return null;
  const wasCompleted = enrollments[index].status === "completed" && enrollments[index].progressPercent === 100;
  const status = progress === 0 ? "notStarted" : progress === 100 ? "completed" : "inProgress";
  enrollments[index] = { ...enrollments[index], progressPercent: progress, status, completedAt: progress === 100 ? (enrollments[index].completedAt || now()) : null };
  writeJson(ENROLLMENTS_KEY, enrollments);
  if (progress === 100 && !wasCompleted) {
    const course = getCourseById(enrollments[index].courseId);
    createNotification({ type: "course_completed", targetAccountId: enrollments[index].accountId, createdBy: "system", title: "Chúc mừng hoàn thành khóa học!", body: `${course?.title || "Khóa học"} — Hoàn thành 100%` });
  }
  return enrollments[index];
}

export function removeEnrollment(id) {
  if (!isNonEmptyString(id)) return false;
  const enrollments = getEnrollments();
  const filtered = enrollments.filter((item) => item.id !== id.trim());
  if (filtered.length === enrollments.length) return false;
  writeJson(ENROLLMENTS_KEY, filtered);
  return true;
}

export function getNotifications(accountId) {
  if (!isNonEmptyString(accountId)) return [];
  return getAllNotifications().filter((item) => item.targetAccountId === accountId.trim()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadCount(accountId) {
  return getNotifications(accountId).filter((item) => item.isRead === false).length;
}

export function markAsRead(notifId) {
  if (!isNonEmptyString(notifId)) return null;
  const notifications = getAllNotifications();
  const index = notifications.findIndex((item) => item.id === notifId.trim());
  if (index < 0) return null;
  if (!notifications[index].isRead) {
    notifications[index] = { ...notifications[index], isRead: true };
    writeJson(NOTIFICATIONS_KEY, notifications);
  }
  return notifications[index];
}

export function createNotification(data) {
  if (!data || ![data.type, data.title, data.targetAccountId].every(isNonEmptyString)) return null;
  const notifications = getAllNotifications();
  const notification = {
    id: getNextEntityId(notifications, "notif"), type: data.type.trim(), title: data.title.trim(),
    body: typeof data.body === "string" ? data.body : "", targetAccountId: data.targetAccountId.trim(),
    createdBy: isNonEmptyString(data.createdBy) ? data.createdBy.trim() : "system", createdAt: now(), isRead: false,
    actionUrl: isNonEmptyString(data.actionUrl) ? data.actionUrl.trim() : "",
    senderName: isNonEmptyString(data.senderName) ? data.senderName.trim() : "",
    expiresAt: isNonEmptyString(data.expiresAt) ? data.expiresAt.trim() : null,
    attachmentLabel: isNonEmptyString(data.attachmentLabel) ? data.attachmentLabel.trim() : "",
  };
  notifications.push(notification);
  writeJson(NOTIFICATIONS_KEY, notifications);
  return notification;
}

export function getNotificationHistory() {
  const rows = getAllNotifications();
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.campaignId || row.id;
    const current = groups.get(key) || { ...row, id: key, recipientCount: 0, readCount: 0 };
    current.recipientCount += 1;
    current.readCount += row.isRead ? 1 : 0;
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function sendNotificationCampaign(data) {
  if (getAccountById(data?.createdBy)?.role !== "hr" || !isNonEmptyString(data?.title) || !isNonEmptyString(data?.body)) return { ok: false, sent: 0 };
  const recipients = [...new Set((data.recipientIds || []).filter(isNonEmptyString))]
    .filter((id) => { const account = getAccountById(id); return account?.role === "employee" && account.accountStatus === "active"; });
  if (!recipients.length) return { ok: false, sent: 0 };
  const notifications = getAllNotifications();
  const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = now();
  recipients.forEach((accountId, index) => notifications.push({
    id: `${campaignId}-${index + 1}`, campaignId, accountId, targetAccountId: accountId,
    title: data.title.trim(), body: data.body.trim(), type: data.type || "hr_announcement",
    priority: data.priority || "normal", actionUrl: data.actionUrl || "", recipientType: data.recipientType || "individual",
    createdBy: data.createdBy, createdAt, sentAt: createdAt, expiresAt: data.expiresAt || null, status: "sent", isRead: false,
  }));
  writeJson(NOTIFICATIONS_KEY, notifications);
  addSecurityAuditLog({ action: "Send notification", targetAccountId: campaignId, targetEmployeeName: `${recipients.length} employees`, description: data.title });
  return { ok: true, sent: recipients.length, campaignId };
}

export function getAllNotifications() {
  return readArray(NOTIFICATIONS_KEY);
}

function validateQuiz(data) {
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  const validTypes = ["singleChoice", "multipleChoice", "trueFalse", "text"];
  return isNonEmptyString(data?.title) && isNonEmptyString(data?.courseId) && getCourseById(data.courseId)
    && Number(data.passingScore) >= 0 && Number(data.passingScore) <= 100
    && Number(data.timeLimitMinutes) > 0 && Number(data.attemptsAllowed) >= 1
    && (data.status !== "published" || questions.length > 0)
    && questions.every((q) => {
      if (!isNonEmptyString(q.text) || !validTypes.includes(q.type) || !(Number(q.points) > 0)) return false;
      if (q.type === "text") return true;
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some((o) => !isNonEmptyString(o.id) || !isNonEmptyString(o.text))) return false;
      const correctIds = q.type === "multipleChoice" ? q.correctOptionIds : [q.correctOptionId];
      return Array.isArray(correctIds) && correctIds.length > 0 && correctIds.every((id) => q.options.some((o) => o.id === id));
    });
}

export function getQuizzes() { return readArray(QUIZZES_KEY); }
export function getQuizById(id) { return getQuizzes().find((q) => q.id === id) || null; }
export function getQuizzesByCourseId(courseId) { return getQuizzes().filter((q) => q.courseId === courseId); }
export function createQuiz(data) {
  if (getAccountById(data?.createdBy)?.role !== "hr" || !validateQuiz(data)) return null;
  const quizzes = getQuizzes();
  const quiz = { ...data, id: getNextEntityId(quizzes, "quiz"), passingScore: Number(data.passingScore), timeLimitMinutes: Number(data.timeLimitMinutes), attemptsAllowed: Number(data.attemptsAllowed), createdAt: now(), updatedAt: null };
  quizzes.push(quiz); writeJson(QUIZZES_KEY, quizzes);
  if (quiz.status === "published") notifyQuizPublished(quiz);
  addSecurityAuditLog({ action: "Create quiz", targetAccountId: quiz.id, targetEmployeeName: quiz.title, description: "HR created a quiz.", result: "success" });
  return quiz;
}
export function updateQuiz(id, data) {
  if (getAccountById(data?.updatedBy)?.role !== "hr") return null;
  const quizzes = getQuizzes(); const index = quizzes.findIndex((q) => q.id === id); if (index < 0) return null;
  const next = { ...quizzes[index], ...data, id, updatedAt: now() }; if (!validateQuiz(next)) return null;
  const newlyPublished = quizzes[index].status !== "published" && next.status === "published";
  quizzes[index] = next; writeJson(QUIZZES_KEY, quizzes); if (newlyPublished) notifyQuizPublished(next);
  addSecurityAuditLog({ action: "Update quiz", targetAccountId: next.id, targetEmployeeName: next.title, description: "HR updated a quiz.", result: "success" }); return next;
}
export function deleteQuiz(id, deletedBy) {
  if (getAccountById(deletedBy)?.role !== "hr") return false;
  if (getQuizAttemptsByQuizId(id).length) return false;
  const quizzes = getQuizzes(); const next = quizzes.filter((q) => q.id !== id); if (next.length === quizzes.length) return false;
  writeJson(QUIZZES_KEY, next); addSecurityAuditLog({ action: "Delete quiz", targetAccountId: id, targetEmployeeName: id, description: "HR deleted a quiz.", result: "success" }); return true;
}
function notifyQuizPublished(quiz) { [...new Set(getEnrollmentsByCourseId(quiz.courseId).map((e) => e.accountId))].forEach((accountId) => createNotification({ type: "quiz_published", targetAccountId: accountId, title: "Bài kiểm tra mới đã sẵn sàng", body: quiz.title })); }
export function getQuizAttempts() { return readArray(QUIZ_ATTEMPTS_KEY); }
export function getQuizAttemptsByAccountId(accountId) { return getQuizAttempts().filter((a) => a.accountId === accountId); }
export function getQuizAttemptsByQuizId(quizId) { return getQuizAttempts().filter((a) => a.quizId === quizId); }
function quizPrerequisiteReason(quiz, accountId) {
  const enrollment = getEnrollmentsByAccountId(accountId).find((e) => e.courseId === quiz?.courseId);
  if (!enrollment) return "course_not_assigned";
  if (quiz.requireCourseCompletion && enrollment.status !== "completed") return "course_not_completed";
  if (quiz.prerequisiteQuizId && !getQuizAttemptsByAccountId(accountId).some((a) => a.quizId === quiz.prerequisiteQuizId && a.submittedAt && a.passed === true)) return "prerequisite_quiz_not_passed";
  return "";
}
export function canStartQuiz({ quizId, accountId }) {
  const quiz = getQuizById(quizId); const account = getAccountById(accountId);
  if (!quiz || quiz.status !== "published") return { ok: false, reason: "quiz_unavailable" };
  if (account?.role !== "employee") return { ok: false, reason: "forbidden" };
  const reason = quizPrerequisiteReason(quiz, accountId); if (reason) return { ok: false, reason };
  const submitted = getQuizAttemptsByAccountId(accountId).filter((a) => a.quizId === quizId && a.submittedAt);
  if (submitted.length >= quiz.attemptsAllowed) return { ok: false, reason: "attempt_limit" };
  return { ok: true, reason: "" };
}
function sanitizeQuiz(quiz) { return { ...quiz, questions: quiz.questions.map(({ correctOptionId, correctOptionIds, explanation, ...question }) => question) }; }
export function startQuizAttempt({ quizId, accountId }) {
  const quiz = getQuizById(quizId); const allowed = canStartQuiz({ quizId, accountId }); if (!allowed.ok) return null;
  const attempts = getQuizAttempts(); const existing = attempts.find((a) => a.quizId === quizId && a.accountId === accountId && !a.submittedAt);
  if (existing) return { ...existing, quiz: sanitizeQuiz(quiz) };
  const prior = attempts.filter((a) => a.quizId === quizId && a.accountId === accountId && a.submittedAt);
  const attempt = { id: getNextEntityId(attempts, "attempt"), quizId, courseId: quiz.courseId, accountId, startedAt: now(), submittedAt: null, answers: [], bookmarks: [], correctCount: null, totalQuestions: quiz.questions.length, earnedPoints: null, totalPoints: quiz.questions.reduce((s,q)=>s+Number(q.points||1),0), scorePercent: null, passed: null, gradingStatus: "inProgress", attemptNumber: prior.length + 1, durationSeconds: null, manualGrades: [] };
  attempts.push(attempt); writeJson(QUIZ_ATTEMPTS_KEY, attempts); return { ...attempt, quiz: sanitizeQuiz(quiz) };
}
export function saveQuizAttemptProgress({ attemptId, accountId, answers, bookmarks }) {
  const attempts=getQuizAttempts(); const index=attempts.findIndex((a)=>a.id===attemptId&&a.accountId===accountId&&!a.submittedAt); if(index<0)return null;
  attempts[index]={...attempts[index],answers:Array.isArray(answers)?answers:attempts[index].answers,bookmarks:Array.isArray(bookmarks)?[...new Set(bookmarks)]:attempts[index].bookmarks}; writeJson(QUIZ_ATTEMPTS_KEY,attempts); return attempts[index];
}
export function submitQuizAttempt({ attemptId, accountId, answers }) {
  const attempts = getQuizAttempts(); const index = attempts.findIndex((a) => a.id === attemptId && a.accountId === accountId && !a.submittedAt); if (index < 0) return null;
  const quiz = getQuizById(attempts[index].quizId); if (!quiz) return null;
  const safeAnswers = Array.isArray(answers) ? answers.map(({ questionId, selectedOptionId, selectedOptionIds, textAnswer }) => ({ questionId, selectedOptionId, selectedOptionIds: Array.isArray(selectedOptionIds) ? [...new Set(selectedOptionIds)] : undefined, textAnswer: typeof textAnswer === "string" ? textAnswer.trim() : undefined })) : [];
  let earnedPoints=0; let correctCount=0; let pendingManual=false;
  const gradedAnswers=quiz.questions.map((q)=>{const answer=safeAnswers.find((a)=>a.questionId===q.id)||{questionId:q.id}; if(q.type==="text"){pendingManual=true;return{...answer,isCorrect:null,awardedPoints:null};} let correct=false;if(q.type==="multipleChoice"){const chosen=[...(answer.selectedOptionIds||[])].sort();const expected=[...(q.correctOptionIds||[])].sort();correct=chosen.length===expected.length&&chosen.every((id,i)=>id===expected[i]);}else correct=answer.selectedOptionId===q.correctOptionId;if(correct){correctCount++;earnedPoints+=Number(q.points||1);}return{...answer,isCorrect:correct,awardedPoints:correct?Number(q.points||1):0};});
  const totalPoints=quiz.questions.reduce((s,q)=>s+Number(q.points||1),0); const scorePercent=totalPoints?Math.round(earnedPoints/totalPoints*100):0;
  attempts[index] = { ...attempts[index], answers: gradedAnswers, correctCount, totalQuestions: quiz.questions.length, earnedPoints, totalPoints, scorePercent, passed: pendingManual?null:scorePercent>=quiz.passingScore, gradingStatus:pendingManual?"pendingManual":"graded", submittedAt: now(), durationSeconds: Math.max(0, Math.round((Date.now() - new Date(attempts[index].startedAt.replace(" ", "T")).getTime()) / 1000)) };
  writeJson(QUIZ_ATTEMPTS_KEY, attempts); createNotification({ type: "quiz_result", targetAccountId: accountId, title: pendingManual?"Bài kiểm tra đang chờ chấm":attempts[index].passed?"Bạn đã đạt bài kiểm tra":"Kết quả bài kiểm tra", body: `${quiz.title}: ${pendingManual?"Chờ chấm":`${scorePercent}%`}` }); return attempts[index];
}
export function gradeQuizEssay({ attemptId, questionId, points, gradedBy }) {
  const grader=getAccountById(gradedBy); if(grader?.role!=="hr")return null; const attempts=getQuizAttempts();const index=attempts.findIndex((a)=>a.id===attemptId&&a.submittedAt);if(index<0)return null;const quiz=getQuizById(attempts[index].quizId);const question=quiz?.questions.find((q)=>q.id===questionId&&q.type==="text");const value=Number(points);if(!question||!Number.isFinite(value)||value<0||value>Number(question.points))return null;
  const answers=attempts[index].answers.map((a)=>a.questionId===questionId?{...a,awardedPoints:value,gradedBy,gradedAt:now()}:a);const pending=quiz.questions.some((q)=>q.type==="text"&&!answers.find((a)=>a.questionId===q.id&&Number.isFinite(a.awardedPoints)));const earnedPoints=answers.reduce((s,a)=>s+Number(a.awardedPoints||0),0);const scorePercent=attempts[index].totalPoints?Math.round(earnedPoints/attempts[index].totalPoints*100):0;attempts[index]={...attempts[index],answers,earnedPoints,scorePercent,gradingStatus:pending?"pendingManual":"graded",passed:pending?null:scorePercent>=quiz.passingScore};writeJson(QUIZ_ATTEMPTS_KEY,attempts);if(!pending)createNotification({type:"quiz_result",targetAccountId:attempts[index].accountId,title:attempts[index].passed?"Bạn đã đạt bài kiểm tra":"Kết quả bài kiểm tra",body:`${quiz.title}: ${scorePercent}%`});return attempts[index];
}
export function getQuizResult(attemptId, requesterAccountId) { const requester=getAccountById(requesterAccountId); return getQuizAttempts().find((a) => a.id === attemptId && a.submittedAt && (a.accountId===requesterAccountId||requester?.role==="hr")) || null; }

export function getCourseContent(courseId) { return readArray(COURSE_CONTENT_KEY).filter(x=>x.courseId===courseId).sort((a,b)=>a.order-b.order); }
export function createCourseContent(data) {
  if(!data?.courseId||!isNonEmptyString(data.title)||!["slide","video","quiz"].includes(data.type))return null;
  const rows=readArray(COURSE_CONTENT_KEY);
  const maxOrder=rows.filter(x=>x.courseId===data.courseId).reduce((m,x)=>Math.max(m,x.order||0),0);
  const item={id:`content-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,courseId:data.courseId,title:String(data.title).trim(),type:data.type,order:maxOrder+1,required:data.required!==false,completionWeight:Number(data.completionWeight)||1,minimumDurationSeconds:Number(data.minimumDurationSeconds)||8,...contentTypeDefaults(data)};
  rows.push(item);writeJson(COURSE_CONTENT_KEY,rows);apiSyncContent(item.courseId,[item],"hr");return item;
}
export function updateCourseContent(id, data) {
  const rows=readArray(COURSE_CONTENT_KEY);const index=rows.findIndex(x=>x.id===id);if(index<0)return null;
  const updated={...rows[index],...data,id,courseId:rows[index].courseId,type:rows[index].type};
  rows[index]=updated;writeJson(COURSE_CONTENT_KEY,rows);return updated;
}
export function deleteCourseContent(id) {
  const rows=readArray(COURSE_CONTENT_KEY);const index=rows.findIndex(x=>x.id===id);if(index<0)return false;
  rows.splice(index,1);writeJson(COURSE_CONTENT_KEY,rows);return true;
}
export function reorderCourseContent(courseId, orderedIds) {
  const rows=readArray(COURSE_CONTENT_KEY);
  orderedIds.forEach((id,i)=>{const index=rows.findIndex(x=>x.id===id&&x.courseId===courseId);if(index>=0)rows[index]={...rows[index],order:i+1};});
  writeJson(COURSE_CONTENT_KEY,rows);return getCourseContent(courseId);
}
function contentTypeDefaults(data) {
  if(data.type==="slide")return{slides:Array.isArray(data.slides)&&data.slides.length?data.slides:[{id:`slide-${Date.now()}`,title:String(data.slideTitle||data.title||"").trim(),alt:"",minimumViewSeconds:Number(data.minimumDurationSeconds)||8,order:1,content:String(data.slideContent||"").trim()}]};
  if(data.type==="video")return{sourceType:data.sourceType||"youtube",sourceUrl:String(data.sourceUrl||""),youtubeVideoId:String(data.youtubeVideoId||""),transcript:String(data.transcript||""),transcriptAlternativeAllowed:data.transcriptAlternativeAllowed!==false,completionRule:{requiredPercent:Number(data.requiredPercent)||90,maxPlaybackRate:1.25,minimumVolume:0.1}};
  if(data.type==="quiz")return{quizId:String(data.quizId||""),completionRule:{requirePass:data.requirePass!==false}};
  return{};
}
export function getContentProgress(accountId, courseId) { return readArray(CONTENT_PROGRESS_KEY).filter(x=>x.accountId===accountId&&(!courseId||x.courseId===courseId)); }
export function getLearningActivity({accountId="",courseId=""}={}) { return readArray(LEARNING_ACTIVITY_KEY).filter(x=>(!accountId||x.accountId===accountId)&&(!courseId||x.courseId===courseId)).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)); }
export function logLearningActivity(data) { const rows=readArray(LEARNING_ACTIVITY_KEY); const row={id:crypto.randomUUID?.()||`activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,occurredAt:now(),metadata:{},...data}; rows.push(row); writeJson(LEARNING_ACTIVITY_KEY,rows); return row; }
export function saveContentProgress(data) {
  if(!data?.accountId||!data?.courseId||!data?.contentId)return null;
  const rows=readArray(CONTENT_PROGRESS_KEY); const index=rows.findIndex(x=>x.accountId===data.accountId&&x.courseId===data.courseId&&x.contentId===data.contentId);
  const prior=index>=0?rows[index]:{id:crypto.randomUUID?.()||`cp-${Date.now()}`,activeSeconds:0,completionPercent:0,completed:false,metadata:{}};
  const next={...prior,...data,metadata:{...prior.metadata,...data.metadata},lastActivityAt:now()}; if(next.completed&&!next.completedAt)next.completedAt=now();
  if(index>=0)rows[index]=next;else rows.push(next); writeJson(CONTENT_PROGRESS_KEY,rows); bumpTrainingRevision(); syncEnrollmentProgress(data.accountId,data.courseId); return next;
}
export function calculateCourseProgress({courseId,accountId}) {
  const content=getCourseContent(courseId).filter(x=>x.required!==false); const states=getContentProgress(accountId,courseId); const attempts=getQuizAttemptsByAccountId(accountId);
  const total=content.reduce((s,x)=>s+Number(x.completionWeight||1),0); const complete=content.reduce((s,x)=>{const done=x.type==="quiz"?attempts.some(a=>a.quizId===x.quizId&&a.submittedAt&&(x.completionRule?.requirePass?a.passed===true:a.gradingStatus!=="pendingManual")):states.some(p=>p.contentId===x.id&&p.completed);return s+(done?Number(x.completionWeight||1):0);},0);
  const pending=content.some(x=>x.type==="quiz"&&attempts.some(a=>a.quizId===x.quizId&&a.gradingStatus==="pendingManual")); return {percent:total?Math.round(complete/total*100):0,completed:total>0&&complete===total&&!pending,pendingGrading:pending};
}
function syncEnrollmentProgress(accountId,courseId){const result=calculateCourseProgress({accountId,courseId});const rows=getEnrollments();const index=rows.findIndex(x=>x.accountId===accountId&&x.courseId===courseId);if(index<0)return;const wasDone=rows[index].status==="completed";rows[index]={...rows[index],progressPercent:result.percent,status:result.completed?"completed":result.percent?"inProgress":"notStarted",completedAt:result.completed?(rows[index].completedAt||now()):null};writeJson(ENROLLMENTS_KEY,rows);if(result.completed&&!wasDone)createNotification({type:"course_completed",targetAccountId:accountId,title:"Chúc mừng hoàn thành khóa học!",body:`${getCourseById(courseId)?.title||"Khóa học"} — 100%`});}
export function resetLearningProgress({performedBy,targetAccountId,courseId,reason,contentId=""}){if(getAccountById(performedBy)?.role!=="hr"||!isNonEmptyString(reason)||!getCourseById(courseId))return null;let rows=readArray(CONTENT_PROGRESS_KEY);rows=rows.filter(x=>!(x.accountId===targetAccountId&&x.courseId===courseId&&(!contentId||x.contentId===contentId)));writeJson(CONTENT_PROGRESS_KEY,rows);syncEnrollmentProgress(targetAccountId,courseId);const event=logLearningActivity({eventType:"reset_learning_progress",accountId:targetAccountId,courseId,contentId:contentId||null,metadata:{performedBy,reason}});addSecurityAuditLog({action:"reset_learning_progress",targetAccountId,targetEmployeeName:getAccountById(targetAccountId)?.fullName||targetAccountId,description:`Course ${courseId} reset. Reason: ${reason}`});return event;}
