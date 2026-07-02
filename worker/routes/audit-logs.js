import { json, corsHeaders, corsPreflight, methodNotAllowed } from "../services/responses.js";
import { getSupabase } from "../services/supabase.js";
import { requireHr } from "../middleware/auth.js";
import { auditOverview, exportAuditLogs, getAuditLog, listAuditLogs } from "../services/audit-query-service.js";
import { writeAuditLog } from "../services/audit-service.js";

export async function handleAuditLogs(request, env) {
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return corsPreflight();
  const acct = await requireHr(request, env);
  if (!acct) return json({ error: "HR_ONLY" }, 403);

  const url = new URL(request.url);
  const path = url.pathname;
  const supabase = getSupabase(env);

  try {
    if (path === "/api/admin/audit-logs/overview") {
      if (method !== "GET") return methodNotAllowed();
      return json(await auditOverview(supabase));
    }
    if (path === "/api/admin/audit-logs/filters") {
      if (method !== "GET") return methodNotAllowed();
      return json({
        categories: ["authentication", "account", "employee", "course", "quiz", "learning_path", "compliance", "certificate", "report", "notification", "training_session", "system", "administrative", "security"],
        severities: ["info", "warning", "critical"],
        sources: ["web", "api", "cron", "system", "migration"],
        statuses: ["success", "failed", "partial", "skipped"],
      });
    }
    if (path === "/api/admin/audit-logs/export") {
      if (method !== "POST") return methodNotAllowed();
      const body = await request.clone().json().catch(() => ({}));
      const format = body.format === "xlsx" ? "xlsx" : "csv";
      const exportUrl = new URL(request.url);
      for (const [key, value] of Object.entries(body.filters || {})) {
        if (value != null && value !== "") exportUrl.searchParams.set(key, String(value));
      }
      const file = await exportAuditLogs(supabase, exportUrl, format);
      await writeAuditLog(supabase, request, {
        actor: acct,
        action: "audit.exported",
        entityType: "audit_logs",
        entityDisplayName: "Audit Logs",
        metadata: { format, row_count: file.rowCount, filters: body.filters || {} },
      }, { critical: true });
      return new Response(file.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "no-store",
          "Access-Control-Expose-Headers": "Content-Disposition, X-Request-ID, X-Correlation-ID",
        },
      });
    }
    if (path === "/api/admin/audit-logs") {
      if (method !== "GET") return methodNotAllowed();
      return json(await listAuditLogs(supabase, url));
    }
    const match = path.match(/^\/api\/admin\/audit-logs\/([^/]+)$/);
    if (match) {
      if (method !== "GET") return methodNotAllowed();
      return json(await getAuditLog(supabase, decodeURIComponent(match[1])));
    }
    return json({ error: "NOT_FOUND" }, 404);
  } catch (error) {
    return json({ error: error.message || "AUDIT_QUERY_FAILED" }, error.status || 500);
  }
}
