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
    const payload = {
      id: data.id || `emp-${crypto.randomUUID()}`,
      full_name: data.fullName || data.full_name || "",
      email: data.email || "",
      employee_code: data.employeeCode || data.employee_code || null,
      role: "employee",
      department: data.department || null,
      position: data.position || null,
      account_status: "active",
    };
    await apiFetch(`/${payload.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { ok: true, employee: payload };
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
