/**
 * Notification service — reads/writes Supabase via Worker API.
 * No localStorage dependency.
 */

import { sessionService } from "./sessionService.js";

const BASE = "/api/notifications";
const API_BASE = "/api";

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

export const notificationService = {
  async list(accountId) {
    try {
      const params = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
      return await apiFetch(params);
    } catch {
      return [];
    }
  },

  async get(id, accountId) {
    const all = await this.list(accountId);
    return all.find((n) => n.id === id) || null;
  },

  async markRead(id) {
    try {
      await apiFetch("", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async markUnread(id) {
    try {
      await apiFetch("", {
        method: "PATCH",
        body: JSON.stringify({ id, read: false }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async archive(id) {
    try {
      await apiFetch("", {
        method: "PATCH",
        body: JSON.stringify({ id, archived: true }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async markAllRead(accountId) {
    try {
      await apiFetch("", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true, accountId }),
      });
      return true;
    } catch {
      return false;
    }
  },

  async create(notification) {
    try {
      return await apiFetch("", {
        method: "POST",
        body: JSON.stringify(notification),
      });
    } catch {
      return null;
    }
  },

  async monitor() {
    try {
      const res = await fetch(`${API_BASE}/admin/notifications/monitor`, { headers: authHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    } catch {
      return null;
    }
  },

  async runReminders() {
    try {
      const res = await fetch(`${API_BASE}/admin/notifications/run-reminders`, { method: "POST", headers: authHeaders(), body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    } catch {
      return null;
    }
  },
};
