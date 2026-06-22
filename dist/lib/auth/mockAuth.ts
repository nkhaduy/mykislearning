export * from "./passwordPolicy";
export * from "./permissions";

export type AccountStatus = "active" | "pendingActivation" | "temporarilyLocked" | "passwordResetRequired" | "disabled";
export type AccountRole = "employee" | "hr" | "manager" | "superAdmin";

export type MockAccount = {
  employeeCode: string;
  fullName: string;
  email: string;
  accountStatus: AccountStatus;
  role: AccountRole;
  passwordHash: string;
  failedLoginAttempts: number;
  lastFailedLoginAt: string | null;
  lastLoginAt: string | null;
  passwordResetRequired: boolean;
  temporaryPasswordGeneratedAt: string | null;
  lockedUntil: string | null;
  createdAt: string;
  activatedAt: string | null;
  createdBy: string;
  updatedBy: string;
  mfaStatus: string;
};

export type SecurityAuditLog = {
  time: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  description: string;
  channel: string;
  device: string;
  result: "Success" | "Failed";
};

export declare const authAccounts: MockAccount[];
export declare const securityAuditLog: SecurityAuditLog[];
export declare function validatePassword(password: string, temporaryPassword?: string): { passed: boolean; checks: Array<{ key: string; passed: boolean }> };
export declare function generateTemporaryPassword(): string;
export declare function checkLoginCredentials(identifier: string, password: string): { ok: boolean; reason: string; account?: MockAccount; attempts?: number };
export declare function lockAccount(account: MockAccount): void;
export declare function unlockAccount(employeeCode: string, actor?: string): MockAccount | null;
export declare function requestPasswordReset(identifier: string, actor?: string): boolean;
export declare function forcePasswordChange(employeeCode: string, actor?: string): MockAccount | null;
export declare function resetEmployeePassword(employeeCode: string, options?: { temporaryPassword?: string; requireChange?: boolean; actor?: string }): { account: MockAccount; temporaryPassword: string } | null;
export declare function addSecurityAuditLog(entry: Partial<SecurityAuditLog>): void;
