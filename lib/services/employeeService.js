/**
 * Employee service — reads/writes Supabase via Worker API.
 * No localStorage dependency.
 * Photo upload still uses blobStore (R2 blob) as intended.
 */

import { saveEmployeePhoto, deleteEmployeePhoto } from "../blobStore.js";
import { sessionService } from "./sessionService.js";

const BASE = "/api/employees";

function authHeaders() {
  const session = sessionService.getValidSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.supabaseAccessToken) {
    headers["Authorization"] = `Bearer ${session.supabaseAccessToken}`;
  }
  headers["X-Account-Id"] = session?.accountId || "";
  headers["X-Account-Role"] = session?.role || "employee";
  return headers;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...authHeaders(), ...options.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const employeeService = {
  async list() {
    try {
      const data = await apiFetch("");
      return data.employees || data || [];
    } catch {
      return [];
    }
  },

  async get(id) {
    const all = await this.list();
    return all.find((e) => e.id === id) || null;
  },

  async create(data) {
    const id = data.id || `emp-${crypto.randomUUID()}`;
    const fullName = (data.fullName || data.full_name || "").trim();
    const email = (data.email || "").trim();
    if (!fullName) return { ok: false, error: "MISSING_FULL_NAME" };
    if (!email) return { ok: false, error: "MISSING_EMAIL" };

    const payload = {
      id,
      full_name: fullName,
      email,
      employee_code: data.employeeCode || data.employee_code || null,
      role: "employee",
      department: data.department || null,
      position: data.position || null,
      account_status: data.accountStatus || data.account_status || "active",
      joined_date: data.joinDate || data.joined_date || null,
      // Ensure notes is initialized to {} so the list query's NOT ILIKE filter
      // (which returns NULL for null columns) does not exclude this profile.
      notes: {},
    };

    try {
      await apiFetch(`/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    } catch (err) {
      const msg = String(err.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already")) {
        return { ok: false, error: "duplicate_email" };
      }
      return { ok: false, error: msg || "validation_error" };
    }

    // Generate and set temporary password
    const temporaryPassword = `KIS@${Math.random().toString(36).slice(2, 8)}26`;
    try {
      const res = await fetch("/api/admin/hr-account-actions", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action: "reset-password", targetId: id, newPassword: temporaryPassword, requireChange: true }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        return { ok: false, error: b.error || "PASSWORD_SET_FAILED" };
      }
    } catch (err) {
      return { ok: false, error: "PASSWORD_SET_FAILED" };
    }

    return {
      ok: true,
      account: { id, fullName, email },
      temporaryPassword,
    };
  },

  async update(employeeId, data) {
    try {
      const payload = {
        full_name: data.fullName || data.full_name,
        email: data.email,
        employee_code: data.employeeCode || data.employee_code,
        department: data.department,
        position: data.position,
        phone: data.phone,
        joined_date: data.joinedDate || data.joined_date,
        manager_name: data.managerName || data.manager_name,
        location: data.location,
        notes: data.notes,
      };
      await apiFetch(`/${employeeId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async setStatus(accountId, status) {
    try {
      await apiFetch(`/${accountId}`, {
        method: "PATCH",
        body: JSON.stringify({ account_status: status }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async uploadPhoto(employeeId, file) {
    const photoBlobId = await saveEmployeePhoto(file);
    await apiFetch(`/${employeeId}`, {
      method: "PATCH",
      body: JSON.stringify({ photoBlobId, photoFileName: file.name, photoUpdatedAt: new Date().toISOString() }),
    });
    return photoBlobId;
  },
};
