import { sessionService } from "./sessionService.js";

function authHeaders(json = true) {
  const session = sessionService.getValidSession();
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (session?.supabaseAccessToken) headers.Authorization = `Bearer ${session.supabaseAccessToken}`;
  headers["X-Account-Id"] = session?.accountId || "";
  headers["X-Account-Role"] = session?.role || "employee";
  return headers;
}

function qs(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value != null && value !== "") params.set(key, value);
  return params.toString();
}

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...authHeaders(options.body !== undefined), ...options.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export const auditService = {
  list(filters) { return api(`/api/admin/audit-logs?${qs(filters)}`); },
  detail(id) { return api(`/api/admin/audit-logs/${encodeURIComponent(id)}`); },
  overview() { return api("/api/admin/audit-logs/overview"); },
  filters() { return api("/api/admin/audit-logs/filters"); },
  async export(format, filters) {
    const res = await fetch("/api/admin/audit-logs/export", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ format, filters }),
    });
    if (!res.ok) throw new Error("AUDIT_EXPORT_FAILED");
    return res.blob();
  },
};
