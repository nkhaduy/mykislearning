import * as XLSX from "xlsx";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const EXPORT_ROW_LIMIT = 5000;
const SORT_FIELDS = new Set(["occurred_at", "action", "category", "severity", "source", "status"]);
const FILTERS = {
  actor_role: "actor_role",
  action: "action",
  category: "category",
  severity: "severity",
  entity_type: "entity_type",
  entity_id: "entity_id",
  source: "source",
  status: "status",
  request_id: "request_id",
};

function safeDate(value, fallback) {
  const d = new Date(value || fallback);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

export function parseAuditFilters(url, { exportMode = false } = {}) {
  const now = new Date();
  const fromDefault = new Date(now.getTime() - 30 * 86400000).toISOString();
  const from = safeDate(url.searchParams.get("date_from"), fromDefault);
  const to = safeDate(url.searchParams.get("date_to"), now.toISOString());
  if (from > to) {
    const err = new Error("INVALID_DATE_RANGE");
    err.status = 400;
    throw err;
  }
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = exportMode ? EXPORT_ROW_LIMIT : Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT));
  const sortBy = url.searchParams.get("sortBy") || "occurred_at";
  if (!SORT_FIELDS.has(sortBy)) {
    const err = new Error("INVALID_SORT_FIELD");
    err.status = 400;
    throw err;
  }
  const search = String(url.searchParams.get("search") || "").trim();
  if (search.length > 120) {
    const err = new Error("SEARCH_TOO_LONG");
    err.status = 400;
    throw err;
  }
  return { from, to, page, pageSize, sortBy, sortDir: url.searchParams.get("sortDir") === "asc" ? "asc" : "desc", search };
}

function applyAuditQuery(query, url, filters) {
  query = query.gte("occurred_at", filters.from).lte("occurred_at", filters.to);
  for (const [param, column] of Object.entries(FILTERS)) {
    const value = String(url.searchParams.get(param) || "").trim();
    if (value) query = query.eq(column, value);
  }
  const actorId = String(url.searchParams.get("actor_id") || "").trim();
  if (actorId) query = query.eq("actor_user_id", actorId);
  if (filters.search) {
    const term = filters.search.replace(/[%(),]/g, "").slice(0, 120);
    query = query.or(`actor_display_name_snapshot.ilike.%${term}%,entity_id.ilike.%${term}%,request_id.ilike.%${term}%,action.ilike.%${term}%,entity_display_name_snapshot.ilike.%${term}%`);
  }
  return query;
}

export async function listAuditLogs(supabase, url) {
  const filters = parseAuditFilters(url);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let query = supabase.from("audit_logs")
    .select("id, occurred_at, actor_user_id, actor_role, actor_display_name_snapshot, action, category, severity, entity_type, entity_id, entity_display_name_snapshot, request_id, correlation_id, source, status, error_code", { count: "exact" });
  query = applyAuditQuery(query, url, filters)
    .order(filters.sortBy, { ascending: filters.sortDir === "asc" })
    .range(from, to);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data || [], total: count || 0, page: filters.page, pageSize: filters.pageSize };
}

export async function getAuditLog(supabase, id) {
  const { data, error } = await supabase.from("audit_logs").select("*").eq("id", id).single();
  if (error) {
    const err = new Error("AUDIT_LOG_NOT_FOUND");
    err.status = 404;
    throw err;
  }
  return data;
}

export async function auditOverview(supabase) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const [total, critical, failedLogin, role, exports, manual, scheduler, daily, cats] = await Promise.all([
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso).eq("severity", "critical"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso).eq("action", "auth.login_failed"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso).eq("action", "account.role_changed"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso).in("action", ["report.exported", "audit.exported"]),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso).in("action", ["compliance.manual_completion", "quiz.result_overridden"]),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }).gte("occurred_at", todayIso).eq("action", "system.scheduler_run_failed"),
    supabase.from("audit_logs").select("occurred_at").gte("occurred_at", new Date(Date.now() - 6 * 86400000).toISOString()).limit(2000),
    supabase.from("audit_logs").select("category").gte("occurred_at", new Date(Date.now() - 6 * 86400000).toISOString()).limit(2000),
  ]);
  const byDay = {};
  for (const row of daily.data || []) byDay[String(row.occurred_at).slice(0, 10)] = (byDay[String(row.occurred_at).slice(0, 10)] || 0) + 1;
  const byCategory = {};
  for (const row of cats.data || []) byCategory[row.category || "administrative"] = (byCategory[row.category || "administrative"] || 0) + 1;
  return {
    totalToday: total.count || 0,
    criticalToday: critical.count || 0,
    failedLoginsToday: failedLogin.count || 0,
    roleChangesToday: role.count || 0,
    reportExportsToday: exports.count || 0,
    manualOverridesToday: manual.count || 0,
    schedulerErrorsToday: scheduler.count || 0,
    eventsByDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    topCategories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([category, count]) => ({ category, count })),
  };
}

function protectFormula(value) {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function exportAuditLogs(supabase, url, format = "csv") {
  const filters = parseAuditFilters(url, { exportMode: true });
  let query = supabase.from("audit_logs")
    .select("occurred_at, actor_display_name_snapshot, actor_role, action, category, severity, entity_type, entity_id, request_id, correlation_id, source, status, error_code")
    .limit(filters.pageSize)
    .order(filters.sortBy, { ascending: filters.sortDir === "asc" });
  query = applyAuditQuery(query, url, filters);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data || []).map((r) => ({
    occurred_at: r.occurred_at,
    actor: r.actor_display_name_snapshot || "",
    actor_role: r.actor_role || "",
    action: r.action,
    category: r.category,
    severity: r.severity,
    entity_type: r.entity_type || "",
    entity_id: r.entity_id || "",
    request_id: r.request_id || "",
    correlation_id: r.correlation_id || "",
    source: r.source,
    status: r.status,
    error_code: r.error_code || "",
  }));
  if (format === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, protectFormula(v)]))));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    return { body: XLSX.write(wb, { type: "array", bookType: "xlsx" }), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "audit-logs.xlsx", rowCount: rows.length };
  }
  const headers = Object.keys(rows[0] || { occurred_at: "", actor: "", actor_role: "", action: "", category: "", severity: "", entity_type: "", entity_id: "", request_id: "", correlation_id: "", source: "", status: "", error_code: "" });
  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => `"${protectFormula(row[h]).replace(/"/g, '""')}"`).join(","))].join("\n");
  return { body: csv, contentType: "text/csv; charset=utf-8", filename: "audit-logs.csv", rowCount: rows.length };
}
